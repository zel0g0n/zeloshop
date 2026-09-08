const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { db, BOT_TOKEN } = require("./lib/admin");
const { buildDeepLink, buildSellerBotDeepLink } = require("./lib/helpers");
const { formatAttributesLine } = require("./lib/attributeLabels");
const { withSentry, SENTRY_DSN, initSentry, Sentry } = require("./lib/sentry");

/**
 * AI CEO — avtomatik kanal postlari (Firestore trigger'lar).
 *
 * Mahsulot/kupon yaratish hozirgi holatda mijoz tomonidan
 * to'g'ridan-to'g'ri Firestore'ga yoziladi (Cloud Function orqali
 * emas), shuning uchun "yaratilganda avtomatik kanalga post
 * qilish"ni frontend kodiga qo'shib bo'lmaydi (bot tokeni faqat
 * serverda saqlanadi). Buning o'rniga Firestore trigger ishlatiladi:
 * hujjat yaratilishi bilan bu funksiya avtomatik ishga tushadi, mijoz
 * tomoni buni bilmaydi ham. Bu, mahsulot yaratishning ikkala yo'lini
 * ham (oddiy "Yangi tovar" formasi va AI CEO "Tez qo'shish" tasdiqlash
 * oqimi) bir vaqtda qamrab oladi - ikkalasi ham oxir-oqibat bir xil
 * `products` kolleksiyasiga yozadi.
 *
 * Xavfsizlik va xarajat nazorati:
 * - Faqat `aiCeoEnabled === true` sotuvchilar uchun ishlaydi (premium
 *   xususiyat sifatida).
 * - Faqat sotuvchi kanal ulagan bo'lsa post qilinadi - aks holda,
 *   funksiya hech narsa qilmasdan darhol chiqadi.
 * - Har bir hujjat uchun faqat bir marta ishga tushadi (Firestore
 *   trigger tabiati shunday - qayta ishga tushish xavfi yo'q).
 *
 * Ataylab qilingan cheklov: bu yerda faqat kanalga post qilinadi,
 * har bir xaridorga alohida xabar yuborilmaydi. Sabab: agar sotuvchi
 * ketma-ket bir necha kupon/mahsulot qo'shsa (masalan sinov paytida),
 * bu har safar barcha mijozlarga (potentsial minglab) xabar
 * yuborilishiga olib kelardi - nazoratsiz xarajat va spam xavfi.
 * Xaridorlarga alohida broadcast yuborish CRM Hub'dagi mavjud,
 * sotuvchi o'zi boshlaydigan oqim orqali amalga oshiriladi.
 */

const MAX_HASHTAG_LENGTH = 30;
// Telegram `sendMediaGroup` — bitta albom (post)da 2 tadan 10 tagacha
// media qabul qiladi (1 tasi bo'lsa alohida `sendPhoto` ishlatiladi,
// pastga qarang). Mahsulot rasmlari allaqachon 4 tadan oshmaydi
// (`heroImage.js`/`updateProductFull.js`dagi "birinchi rasm = asosiy"
// qoidasi), shuning uchun bu chegara amalda hech qachon cheklamaydi.
const MAX_TELEGRAM_ALBUM_SIZE = 10;
// 2026-09 (foydalanuvchi so'ragan "sotuvga qaratilgan" post uslubi):
// zaxira shu sondan KAM/TENG bo'lsagina "Faqat N ta qoldi!" tarzidagi
// urgentlik uslubi ishlatiladi — KATTA zaxirada bunday yozish yolg'on
// taassurot qoldirardi (haqiqiy son bilan mos kelmaydigan "kam qoldi"
// signali), shuning uchun bu chegara MUHIM, o'zboshimcha emas.
const LOW_STOCK_URGENCY_THRESHOLD = 10;

/**
 * Kategoriya nomini Telegram hashtag'ga aylantiradi (bo'sh joy va
 * maxsus belgilarni olib tashlaydi). Sof funksiya.
 */
function categoryToHashtag(category) {
  if (!category) return "";
  const cleaned = category
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]/gu, "") // faqat harf/raqam qoldiriladi
    .slice(0, MAX_HASHTAG_LENGTH);
  return cleaned ? `#${cleaned}` : "";
}

/**
 * Telegram `parse_mode: "HTML"` bilan yuborilayotgan matnga
 * qo'shilayotgan, FOYDALANUVCHI (sotuvchi) YOZGAN har qanday matnni
 * (mahsulot nomi, tavsifi) xavfsiz qiladi — aks holda, masalan,
 * tavsifida "<" yoki "&" belgisi bo'lgan mahsulot posti Telegram
 * tomonidan "can't parse entities" xatosi bilan RAD ETILAR edi.
 */
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Yangi mahsulot uchun kanal post matnini quradi. Sof funksiya -
 * to'g'ridan-to'g'ri test qilinadi.
 *
 * 2026-09: nom va narx `<b>` (qalin) bilan ajratiladi, chiroyliroq
 * ko'rinish uchun — `postToConnectedChannel` bu postni endi
 * `parse_mode: "HTML"` bilan yuboradi, shuning uchun foydalanuvchi
 * yozgan qismlar (nom, tavsif) `escapeHtml` orqali xavfsizlashtiriladi.
 *
 * Zaxira soni ("nechta dona bor") rasm+narxdan tashqari qo'shiladi -
 * agar `stock` maydoni haqiqiy son sifatida berilgan bo'lsa (0 ham
 * haqiqiy qiymat, shuning uchun aniq `Number.isFinite` tekshiruvi
 * ishlatiladi, `if (product.stock)` emas, chunki 0 "falsy" bo'lib
 * noto'g'ri o'tkazib yuborilardi). "Sotib olish" tugmasi matnga emas -
 * alohida `postToConnectedChannel`dagi `reply_markup`ga qo'shiladi
 * (Telegram tugmalari matn ichida bo'lmaydi).
 *
 * 2026-09: sotuvchi to'ldirgan `product.attributes` (brend, teri turi,
 * hajm va sh.k. — dinamik "15-niche" maydonlari, `lib/attributeLabels.js`
 * orqali o'zbekcha yorliqqa aylantiriladi) va `product.variants`
 * (rang/o'lcham kabi tanlovlar) — ikkalasi ham, TO'LDIRILGAN bo'lsagina,
 * postga qo'shiladi (bo'sh bo'lsa - qatorlar UMUMAN chiqmaydi).
 *
 * 2026-09 (foydalanuvchi so'ragan "sotuvga qaratilgan" post uslubi
 * andozasi asosida): ANIQ, MAHSULOT MA'LUMOTIDAN hisoblab chiqarsa
 * bo'ladigan qismlar QO'SHILDI — "siz X so'm tejaysiz" (chegirma
 * summasi), va zaxira KAM bo'lsa "Faqat N ta qoldi!" urgentlik uslubi.
 * ATAYLAB QO'SHILMAGAN qismlar (andozada bor edi, lekin HAR BIR
 * sotuvchi/mahsulot uchun HAQIQAT bo'lishi kafolatlanmagan): "Bepul
 * yetkazib berish", "N kun qaytarish kafolati", "Original mahsulot"
 * kabi da'volar — bularni qattiq yozib qo'yish ba'zi sotuvchilar uchun
 * YOLG'ON va'da bo'lib chiqishi mumkin edi. Xuddi shunday, "@shopbot —
 * 'So'z' deb yozing" kabi kalit-so'z orqali buyurtma qabul qilish —
 * bunday funksiya botlarimizda HALI MAVJUD EMAS (haqiqiy, ishlaydigan
 * yagona yo'l — pastdagi "Sotib olish" tugmasi, `buttonUrl`).
 */
function buildProductChannelPost(product) {
  const name = product?.name || "Yangi mahsulot";
  const originalPrice = Number(product?.price) || 0;
  const hasDiscount = Number(product?.discountPrice) > 0 && Number(product.discountPrice) < originalPrice;
  const price = hasDiscount ? Number(product.discountPrice) : originalPrice;
  const savings = hasDiscount ? originalPrice - price : 0;
  const hashtag = categoryToHashtag(product?.category);
  // Brend nomidan HAM hashtag yasaladi (agar sotuvchi to'ldirgan bo'lsa) -
  // kategoriya hashtagiga QO'SHIMCHA, uni ALMASHTIRMAYDI.
  const brandHashtag = product?.attributes?.brand ? categoryToHashtag(product.attributes.brand) : "";
  const stock = Number(product?.stock);

  // 2026-09 (foydalanuvchi savoli: "nega tavsif to'liq ko'rinmayabdi"):
  // ILGARI bu yerda tavsif QO'SHIMCHA, o'zboshimcha 150 belgiga
  // qisqartirilardi — bu Telegram'ning HAQIQIY cheklovi EMAS edi
  // (haqiqiy limit — pastda, `postToConnectedChannel`dagi
  // `caption.slice(0, 1024)`, Telegram'ning rasm/albom izohi uchun
  // MAKSIMAL uzunligi). Demak tavsif ko'pincha 1024 belgiga SIG'GANIDA
  // HAM, behuda 150 belgida kesilardi. Endi tavsif TO'LIQ qo'shiladi —
  // faqat postning umumiy uzunligi HAQIQATAN 1024 belgidan oshsa,
  // pastdagi yagona, haqiqiy chegara ishga tushadi.
  // Sarlavha emojisi: chegirma bo'lsa 🔥 ("aksiya" hissi), bo'lmasa 🆕.
  const lines = [`${hasDiscount ? "🔥" : "🆕"} <b>${escapeHtml(name)}</b>`, ""];
  if (product?.description) {
    lines.push(escapeHtml(product.description), "");
  }
  if (hasDiscount) {
    lines.push(`💰 <b>${price.toLocaleString()} so'm</b>  (avvalgi narx: ${originalPrice.toLocaleString()} so'm)`);
    lines.push(`🎁 Siz <b>${savings.toLocaleString()} so'm</b> tejaysiz!`);
  } else {
    lines.push(`💰 <b>${price.toLocaleString()} so'm</b>`);
  }
  if (Number.isFinite(stock) && stock >= 0) {
    lines.push(
      stock > 0 && stock <= LOW_STOCK_URGENCY_THRESHOLD
        ? `⏰ Omborda: Faqat <b>${stock.toLocaleString()}</b> ta qoldi!`
        : `📦 Zaxirada: ${stock.toLocaleString()} dona`
    );
  }

  // 2026-09 (foydalanuvchi savoli: "sotuvchi qo'shimcha xususiyatlarni
  // to'ldirgan bo'lsa-chi, shuni hisobga oldingmi?"): ILGARI bu yerda
  // `product.attributes` (brend, teri turi, hajm va h.k. — "15-niche
  // universal platforma" dinamik maydonlari) VA `product.variants`
  // (rang/o'lcham kabi tanlovlar) UMUMAN ko'rsatilmasdi — sotuvchi
  // qanchalik to'liq to'ldirgan bo'lmasin, postda faqat nom/tavsif/
  // narx/zaxira ko'rinardi. Endi ikkalasi ham qo'shiladi (agar
  // to'ldirilgan bo'lsa) — yorliqlar `lib/attributeLabels.js`dan
  // (frontend'dagi `productAttributes.*` bilan BIR XIL o'zbekcha so'z).
  const attributesLine = formatAttributesLine(product?.attributes);
  if (attributesLine) lines.push(`📋 ${escapeHtml(attributesLine)}`);

  if (Array.isArray(product?.variants) && product.variants.length > 0) {
    lines.push(`🎨 Variantlar: ${product.variants.map((v) => escapeHtml(String(v))).join(", ")}`);
  }

  const hashtags = [hashtag, brandHashtag].filter(Boolean).join(" ");
  if (hashtags) lines.push("", hashtags);

  return lines.join("\n");
}

/**
 * Yangi kupon/aksiya uchun kanal post matnini quradi. Sof funksiya.
 */
function buildCouponChannelPost(coupon) {
  const code = coupon?.code || "";
  const discountLabel = coupon?.discountType === "fixed"
    ? `${Number(coupon.discountValue).toLocaleString()} so'm chegirma`
    : `${Number(coupon.discountValue)}% chegirma`;

  const lines = [
    "🎁 Yangi aksiya!",
    "",
    `Promokod: ${code}`,
    discountLabel,
  ];
  if (coupon?.expiresAt) {
    lines.push("", `Amal qilish muddati: ${new Date(coupon.expiresAt).toLocaleDateString("uz-UZ")}gacha`);
  }
  lines.push("", "Checkout'da promokod maydoniga kiriting!");

  return lines.join("\n");
}

/**
 * Telegram Bot API'ga bitta so'rov yuboradi va javobni qaytaradi -
 * `postToConnectedChannel` ichida bir necha marta (albom + tugma
 * xabari) chaqirilishi mumkin bo'lgani uchun ALOHIDA, kichik
 * yordamchiga chiqarilgan.
 */
async function callTelegramApi(botToken, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

/**
 * Sotuvchining ulangan kanaliga (agar bor bo'lsa) post yuboradi.
 * Xato bo'lsa, jim log yozadi - trigger funksiyasi hech qachon
 * foydalanuvchiga ko'rinadigan xato bermasligi kerak (fon jarayoni).
 *
 * @param {string} sellerId
 * @param {object} options
 * @param {string} options.caption - post matni.
 * @param {string[]} [options.images] - mahsulotning BARCHA rasmlari
 *   (ixtiyoriy). 2026-09, foydalanuvchi so'rovi bilan qo'shildi: OLDIN
 *   faqat BITTA (asosiy) rasm yuborilardi - endi mahsulotning HAMMA
 *   rasmlari BITTA postda (Telegram albom, `sendMediaGroup`) ko'rinadi.
 * @param {string} [options.productPath] - berilsa, "Sotib olish" inline
 *   tugmasi qo'shiladi va shu ICHKI yo'lga (masalan `/product/{id}`)
 *   ochiladi. Havola QAYSI BOT orqali ochilishi shu funksiya ICHIDA
 *   hal qilinadi (pastga qarang) - chaqiruvchi tayyor URL emas, ICHKI
 *   yo'lning O'ZINI beradi.
 * @param {"HTML"} [options.parseMode] - berilsa, `caption` HTML
 *   formatlash (`<b>` va sh.k.) bilan yuboriladi (kupon postlarida
 *   ishlatilmaydi - ular oddiy matn, formatlash shart emas).
 *
 * 2026-09 (foydalanuvchi so'rovi: "Sotib olish tugmasi sellerning
 * O'ZINING boti orqali ochilsin, ZeloShop'ning umumiy boti emas"):
 * agar sotuvchi o'z botini ulagan bo'lsa (`customBotUsername`),
 * tugma ENDI o'sha botga (`buildSellerBotDeepLink`, `?start=...`)
 * ochiladi - bosilganda bot bilan xususiy chat ochiladi va
 * `customBotWebhook.js` HAQIQIY Mini App tugmasi bilan javob beradi.
 * Sotuvchi hali shaxsiy bot ulamagan bo'lsa, xavfsiz zaxira sifatida
 * ZeloShop'ning umumiy boti (`buildDeepLink`) ishlatiladi - shu orqali
 * tugma HAR DOIM ISHLAYDI, hech qachon "o'lik" havolaga aylanmaydi.
 *
 * MUHIM, TELEGRAM API CHEKLOVI: `sendMediaGroup` (bir nechta rasmni
 * BITTA albom sifatida yuborish) `reply_markup` (inline tugma)ni
 * QO'LLAB-QUVVATLAMAYDI - bu Telegram'ning o'zining API cheklovi,
 * bizning kodimizdagi kamchilik emas. Shuning uchun 2+ rasm bo'lganda:
 * (1) avval albom (barcha rasm + izoh, faqat BIRINCHI elementda)
 * yuboriladi, (2) darhol ORQASIDAN, "Sotib olish" tugmasi bilan QISQA,
 * MAZMUNLI (bo'sh "👆" belgi EMAS - foydalanuvchi buni "keraksiz
 * stiker" deb ta'riflagan edi) alohida xabar yuboriladi - kanalda
 * bular ketma-ket, BITTA vizual blok sifatida ko'rinadi. Faqat BITTA
 * rasm bo'lsa (eng ko'p uchraydigan holat), bu ikkinchi xabar shart
 * emas - `sendPhoto`ning o'zi `reply_markup`ni qo'llab-quvvatlaydi,
 * xuddi ilgarigidek BITTA so'rovda ketadi.
 */
async function postToConnectedChannel(sellerId, { caption, images, productPath, parseMode } = {}) {
  const [sellerSnap, customBotSnap] = await Promise.all([
    db.collection("sellers").doc(sellerId).get(),
    db.collection("sellers").doc(sellerId).collection("private").doc("customerBot").get(),
  ]);

  if (!sellerSnap.exists || sellerSnap.data().aiCeoEnabled !== true) return;

  const customBot = customBotSnap.exists ? customBotSnap.data() : null;
  if (!customBot?.botToken || !customBot?.connectedChannelUsername) return;

  const chatId = customBot.connectedChannelUsername;
  const buttonUrl = productPath
    ? (buildSellerBotDeepLink(sellerSnap.data().customBotUsername, productPath) || buildDeepLink(sellerId, productPath))
    : null;
  const replyMarkup = buttonUrl ? { inline_keyboard: [[{ text: "🛒 Sotib olish", url: buttonUrl }]] } : undefined;
  const imageList = (Array.isArray(images) ? images : (images ? [images] : []))
    .filter(Boolean)
    .slice(0, MAX_TELEGRAM_ALBUM_SIZE);

  try {
    if (imageList.length >= 2) {
      // ALBOM: barcha rasmlar BITTA postda. Izoh FAQAT birinchi
      // elementga qo'yiladi - Telegram uni butun albomning izohi
      // sifatida ko'rsatadi (qolgan elementlarga izoh qo'shilsa,
      // ular alohida-alohida ko'rinib, tartibsizlik keltirib chiqarardi).
      const media = imageList.map((url, index) => ({
        type: "photo",
        media: url,
        ...(index === 0 ? { caption: caption.slice(0, 1024), parse_mode: parseMode } : {}),
      }));
      const albumData = await callTelegramApi(customBot.botToken, "sendMediaGroup", { chat_id: chatId, media });
      if (!albumData.ok) console.error(`Avtomatik kanal albomi muvaffaqiyatsiz (sotuvchi ${sellerId}):`, albumData.description);

      if (replyMarkup) {
        // Telegram `sendMediaGroup`ga `reply_markup` qo'shishga
        // RUXSAT BERMAYDI (yuqoridagi izohga qarang) - shuning uchun
        // tugma albomdan DARHOL keyin, qisqa, alohida xabar sifatida.
        // MATN — ataylab bo'sh emoji ("👆") EMAS, HAQIQIY, mazmunli
        // chaqiruv matni (foydalanuvchi so'rovi bilan tuzatildi).
        const btnData = await callTelegramApi(customBot.botToken, "sendMessage", {
          chat_id: chatId,
          text: "🛒 Sotib olish uchun pastdagi tugmani bosing:",
          reply_markup: replyMarkup,
        });
        if (!btnData.ok) console.error(`Avtomatik kanal tugma xabari muvaffaqiyatsiz (sotuvchi ${sellerId}):`, btnData.description);
      }
    } else {
      const endpoint = imageList.length === 1 ? "sendPhoto" : "sendMessage";
      const body = imageList.length === 1
        ? { chat_id: chatId, photo: imageList[0], caption: caption.slice(0, 1024), parse_mode: parseMode, reply_markup: replyMarkup }
        : { chat_id: chatId, text: caption.slice(0, 4096), parse_mode: parseMode, reply_markup: replyMarkup };

      const data = await callTelegramApi(customBot.botToken, endpoint, body);
      if (!data.ok) console.error(`Avtomatik kanal posti muvaffaqiyatsiz (sotuvchi ${sellerId}):`, data.description);
    }
  } catch (err) {
    console.error(`Avtomatik kanal postida xatolik (sotuvchi ${sellerId}):`, err);
    initSentry();
    Sentry.captureException(err, { extra: { sellerId } });
  }
}

exports.onProductCreated = onDocumentCreated(
  { document: "products/{productId}", region: "asia-south1", secrets: [BOT_TOKEN, SENTRY_DSN] },
  withSentry(async (event) => {
    const product = event.data?.data();
    if (!product?.sellerId) return;
    const caption = buildProductChannelPost(product);
    // "Sotib olish" tugmasi - do'kondagi o'sha mahsulot sahifasiga
    // to'g'ridan-to'g'ri ochiladigan ICHKI yo'l (`/product/{id}`) -
    // QAYSI BOT orqali ochilishini `postToConnectedChannel`ning O'ZI
    // hal qiladi (sotuvchining shaxsiy boti bo'lsa - o'sha, aks holda
    // ZeloShop'ning umumiy boti, batafsil izoh shu funksiyada).
    const productPath = `/product/${event.params.productId}`;
    // Mahsulotning BARCHA rasmlari (birinchi = asosiy) - foydalanuvchi
    // so'rovi bilan, faqat bitta asosiy rasm o'rniga.
    const images = Array.isArray(product.images) && product.images.length > 0
      ? product.images
      : (product.image ? [product.image] : []);
    await postToConnectedChannel(product.sellerId, { caption, images, productPath, parseMode: "HTML" });
    // AI RASM GENERATSIYASI (avtomatik reklama surati + avtomatik Story
    // rasmi) 2026-09, sotuvchi so'roviga ko'ra BUTUNLAY OLIB TASHLANDI
    // (Gemini API kvotasi bilan bog'liq muammolar sababli, "rasm
    // generatsiya qilish kerak emas" deb ANIQ belgilandi). Shu bilan
    // birga, qo'lda chaqiriladigan "AI asosiy rasm" (`heroImage.js`) va
    // uning barcha frontend qismlari ham o'chirildi.
  })
);

exports.onCouponCreated = onDocumentCreated(
  { document: "sellers/{sellerId}/coupons/{code}", region: "asia-south1", secrets: [BOT_TOKEN, SENTRY_DSN] },
  withSentry(async (event) => {
    const coupon = event.data?.data();
    const sellerId = event.params.sellerId;
    if (!coupon) return;
    const caption = buildCouponChannelPost(coupon);
    await postToConnectedChannel(sellerId, { caption });
  })
);

exports._testables = { buildProductChannelPost, buildCouponChannelPost, categoryToHashtag, escapeHtml, postToConnectedChannel };
