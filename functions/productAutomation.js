const { randomUUID } = require("crypto");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { admin, db, BOT_TOKEN, GEMINI_API_KEY } = require("./lib/admin");
const { buildDeepLink } = require("./lib/helpers");
const { checkRateLimit } = require("./lib/rateLimit");
const { incrementDailyStat } = require("./lib/dailyStats");
// Mahsulot qo'shilganda, uning asosiy rasmidan avtomatik "Instagram
// reklama surati" generatsiya qilish - batafsil izoh:
// `lib/aiImage.js`. `generateProductStoryImage` esa xuddi shu
// tamoyilda, lekin 9:16 "Story" formatida - quyidagi
// `maybeGenerateStoryImage`ga qarang (#116).
const { generateProductAdImage, generateProductStoryImage } = require("./lib/aiImage");
const { fetchTrustedImage } = require("./lib/safeFetch");
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
 * Yangi mahsulot uchun kanal post matnini quradi. Sof funksiya -
 * to'g'ridan-to'g'ri test qilinadi.
 *
 * Zaxira soni ("nechta dona bor") rasm+narxdan tashqari qo'shiladi -
 * agar `stock` maydoni haqiqiy son sifatida berilgan bo'lsa (0 ham
 * haqiqiy qiymat, shuning uchun aniq `Number.isFinite` tekshiruvi
 * ishlatiladi, `if (product.stock)` emas, chunki 0 "falsy" bo'lib
 * noto'g'ri o'tkazib yuborilardi). "Sotib olish" tugmasi matnga emas -
 * alohida `postToConnectedChannel`dagi `reply_markup`ga qo'shiladi
 * (Telegram tugmalari matn ichida bo'lmaydi).
 */
function buildProductChannelPost(product) {
  const name = product?.name || "Yangi mahsulot";
  const price = Number(product?.discountPrice) > 0 && Number(product.discountPrice) < Number(product.price)
    ? Number(product.discountPrice)
    : Number(product?.price) || 0;
  const hasDiscount = Number(product?.discountPrice) > 0 && Number(product.discountPrice) < Number(product?.price);
  const hashtag = categoryToHashtag(product?.category);
  const stock = Number(product?.stock);

  const lines = [`🆕 ${name}`, ""];
  if (product?.description) {
    const shortDesc = product.description.length > 150 ? `${product.description.slice(0, 150).trim()}...` : product.description;
    lines.push(shortDesc, "");
  }
  if (hasDiscount) {
    lines.push(`💰 ${price.toLocaleString()} so'm  (avvalgi narx: ${Number(product.price).toLocaleString()} so'm)`);
  } else {
    lines.push(`💰 ${price.toLocaleString()} so'm`);
  }
  if (Number.isFinite(stock) && stock >= 0) {
    lines.push(`📦 Zaxirada: ${stock.toLocaleString()} dona`);
  }
  if (hashtag) lines.push("", hashtag);

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
 * Sotuvchining ulangan kanaliga (agar bor bo'lsa) post yuboradi.
 * Xato bo'lsa, jim log yozadi - trigger funksiyasi hech qachon
 * foydalanuvchiga ko'rinadigan xato bermasligi kerak (fon jarayoni).
 *
 * `buttonUrl` (ixtiyoriy) - berilsa, xabar ostiga "Sotib olish"
 * inline tugmasi qo'shiladi (Telegram'da matn ichiga havola qo'yib
 * bo'lmaydi - shuning uchun alohida `reply_markup`).
 */
async function postToConnectedChannel(sellerId, caption, imageUrl, buttonUrl) {
  const [sellerSnap, customBotSnap] = await Promise.all([
    db.collection("sellers").doc(sellerId).get(),
    db.collection("sellers").doc(sellerId).collection("private").doc("customerBot").get(),
  ]);

  if (!sellerSnap.exists || sellerSnap.data().aiCeoEnabled !== true) return;

  const customBot = customBotSnap.exists ? customBotSnap.data() : null;
  if (!customBot?.botToken || !customBot?.connectedChannelUsername) return;

  const replyMarkup = buttonUrl ? { inline_keyboard: [[{ text: "🛒 Sotib olish", url: buttonUrl }]] } : undefined;

  try {
    const endpoint = imageUrl ? "sendPhoto" : "sendMessage";
    const body = imageUrl
      ? { chat_id: customBot.connectedChannelUsername, photo: imageUrl, caption: caption.slice(0, 1024), reply_markup: replyMarkup }
      : { chat_id: customBot.connectedChannelUsername, text: caption.slice(0, 4096), reply_markup: replyMarkup };

    const res = await fetch(`https://api.telegram.org/bot${customBot.botToken}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) console.error(`Avtomatik kanal posti muvaffaqiyatsiz (sotuvchi ${sellerId}):`, data.description);
  } catch (err) {
    console.error(`Avtomatik kanal postida xatolik (sotuvchi ${sellerId}):`, err);
    initSentry();
    Sentry.captureException(err, { extra: { sellerId } });
  }
}

/**
 * Mahsulotning asosiy rasmidan avtomatik "Instagram reklama surati"
 * generatsiya qiladi va natijani (agar muvaffaqiyatli bo'lsa)
 * `products/{productId}`ga `aiAdImageUrl` sifatida yozadi.
 *
 * Xavfsizlik/xarajat nazorati (`postToConnectedChannel`dagi kabi
 * tamoyillar, lekin mustaqil, alohida tekshiruv - ikkalasi bir-
 * biriga bog'liq emas, shuning uchun kanal ulanmagan bo'lsa ham
 * reklama rasmi baribir generatsiya qilinadi):
 * - Faqat `aiCeoEnabled === true` sotuvchilar uchun (premium
 *   xususiyat - rasm generatsiyasi matn generatsiyasidan sezilarli
 *   qimmatroq).
 * - Sotuvchi uchun kunlik chegarasi bor (`checkRateLimit`) -
 *   nazoratsiz xarajatning oldini olish uchun (masalan ketma-ket ko'p
 *   mahsulot qo'shilsa).
 * - Asosiy rasm (`product.image`) bo'lmasa - hech narsa qilinmaydi
 *   (generatsiya qiladigan narsa yo'q).
 * - Har qanday xato (Gemini, Storage, tarmoq) faqat log yoziladi -
 *   bu fon jarayoni, mahsulot allaqachon muvaffaqiyatli yaratilgan,
 *   reklama surati esa qo'shimcha, ixtiyoriy boyitish, xolos.
 */
async function maybeGenerateAdImage(sellerId, productId, product) {
  if (!sellerId || !productId || !product?.image) return;

  const sellerSnap = await db.collection("sellers").doc(sellerId).get();
  if (!sellerSnap.exists || sellerSnap.data().aiCeoEnabled !== true) return;

  try {
    await checkRateLimit(`autoAdImage:${sellerId}`, 30, 24 * 60 * 60);
  } catch (err) {
    console.warn(`Reklama rasmi kunlik chegarasidan oshib ketdi (${sellerId}):`, err.message);
    return;
  }

  try {
    // RASM RESIZE (2026-09 audit): bu yerda qo'shimcha resize QILINMAYDI
    // — `product.image` allaqachon YUKLASH oqimida (`useUploadStorage.jsx`
    // → `compressImage`, maks. 1000x1000, sifat 0.75) siqilgan holda
    // Storage'ga yozilgan, shuning uchun Gemini'ga bu yerda ham kichik
    // hajmda yuboriladi — qayta siqish ortiqcha CPU sarflaydigan,
    // foydasiz qadam bo'lar edi.
    const imageRes = await fetchTrustedImage(product.image);
    const sourceBuffer = Buffer.from(await imageRes.arrayBuffer());
    const sourceMimeType = imageRes.headers.get("content-type") || "image/jpeg";

    const { imageBase64, mimeType } = await generateProductAdImage({
      imageBase64: sourceBuffer.toString("base64"),
      imageMimeType: sourceMimeType,
      productName: product.name,
      category: product.category,
    });

    const extension = mimeType.split("/").pop() || "png";
    const filePath = `products/${sellerId}/ai-ad-${productId}.${extension}`;
    const downloadToken = randomUUID();
    const bucket = admin.storage().bucket();
    await bucket.file(filePath).save(Buffer.from(imageBase64, "base64"), {
      metadata: {
        contentType: mimeType,
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      },
    });
    // `storage.rules`dagi `products/{sellerId}/{fileName}` yo'li
    // allaqachon `allow read: if true` - shuning uchun bu URL hech
    // qanday qo'shimcha qoida o'zgarishisiz, mavjud mahsulot rasmlari
    // bilan bir xil formatda ochiq o'qiladi.
    const adImageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`;

    await db.collection("products").doc(productId).update({
      aiAdImageUrl: adImageUrl,
      aiAdImageGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await incrementDailyStat(sellerId, "aiCeoAutoAdImagesGenerated");
  } catch (err) {
    console.error(`Reklama rasmi generatsiyasida xatolik (${sellerId}/${productId}):`, err);
    initSentry();
    Sentry.captureException(err, { extra: { sellerId, productId } });
  }
}

/**
 * Mahsulotning asosiy rasmidan avtomatik 9:16 "Story" (Instagram/
 * Telegram Stories) formatidagi reklama surati generatsiya qiladi va
 * natijani `products/{productId}`ga `aiStoryImageUrl` sifatida yozadi
 * — xuddi `storyImage.js`dagi SOTUVCHI QO'LDA so'raganda ishlaydigan
 * `generateStoryImage`ning natijasi bilan BIR XIL maydonga (shuning
 * uchun mavjud UI, masalan story-yuklab-olish tugmasi, avtomatik
 * yaratilgan rasmni ham darhol taniydi — alohida frontend o'zgarish
 * shart emas).
 *
 * NEGA `storyImage.js`dagi ASL QARORDAN FARQLI (u yerda "avtomatik
 * EMAS, faqat so'ralganda" deb ATAYLAB yozilgan edi — sabab: "ko'p
 * mahsulot hech qachon story sifatida ulashilmaydi, shuning uchun
 * har birida avtomatik generatsiya - behuda xarajat"): bu haqiqiy
 * xavotir hali ham TO'G'RI, shuning uchun bu funksiya faqat sotuvchi
 * buni ALOHIDA, ATAYLAB yoqqan bo'lsagina (`aiAutoStoryImageEnabled
 * === true`, standart bo'yicha O'CHIQ — opt-in) ishlaydi. Ya'ni: kim
 * uchun bu xarajat arziydi (masalan doim story orqali reklama
 * qiladigan sotuvchi) — o'zi ONGLI ravishda yoqadi; qolganlar uchun
 * hech narsa o'zgarmaydi, xuddi ilgarigidek faqat qo'lda so'ralganda
 * ishlaydi.
 *
 * Qolgan xavfsizlik/xarajat nazorati - `maybeGenerateAdImage`dagi
 * bilan bir xil tamoyillar (mustaqil, alohida tekshiruv - reklama
 * rasmi generatsiyasidan BUTUNLAY erkin, biri ishlamasa ham ikkinchisi
 * davom etadi).
 */
async function maybeGenerateStoryImage(sellerId, productId, product) {
  if (!sellerId || !productId || !product?.image) return;

  const sellerSnap = await db.collection("sellers").doc(sellerId).get();
  if (!sellerSnap.exists) return;
  const seller = sellerSnap.data();
  if (seller.aiCeoEnabled !== true || seller.aiAutoStoryImageEnabled !== true) return;

  try {
    await checkRateLimit(`autoStoryImage:${sellerId}`, 30, 24 * 60 * 60);
  } catch (err) {
    console.warn(`Avtomatik story rasm kunlik chegarasidan oshib ketdi (${sellerId}):`, err.message);
    return;
  }

  try {
    // RASM RESIZE: yuqoridagi `maybeGenerateAdImage`dagi izohga qarang —
    // `product.image` yuklashda allaqachon siqilgan, qo'shimcha resize
    // shart emas.
    const imageRes = await fetchTrustedImage(product.image);
    const sourceBuffer = Buffer.from(await imageRes.arrayBuffer());
    const sourceMimeType = imageRes.headers.get("content-type") || "image/jpeg";

    const { imageBase64, mimeType } = await generateProductStoryImage({
      imageBase64: sourceBuffer.toString("base64"),
      imageMimeType: sourceMimeType,
      productName: product.name,
      category: product.category,
    });

    const extension = mimeType.split("/").pop() || "png";
    const filePath = `products/${sellerId}/ai-story-${productId}.${extension}`;
    const downloadToken = randomUUID();
    const bucket = admin.storage().bucket();
    await bucket.file(filePath).save(Buffer.from(imageBase64, "base64"), {
      metadata: {
        contentType: mimeType,
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      },
    });
    const storyImageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`;

    await db.collection("products").doc(productId).update({
      aiStoryImageUrl: storyImageUrl,
      aiStoryImageGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await incrementDailyStat(sellerId, "aiCeoAutoStoryImagesGenerated");
  } catch (err) {
    console.error(`Avtomatik story rasm generatsiyasida xatolik (${sellerId}/${productId}):`, err);
    initSentry();
    Sentry.captureException(err, { extra: { sellerId, productId } });
  }
}

exports.onProductCreated = onDocumentCreated(
  { document: "products/{productId}", region: "asia-south1", secrets: [BOT_TOKEN, GEMINI_API_KEY, SENTRY_DSN] },
  withSentry(async (event) => {
    const product = event.data?.data();
    if (!product?.sellerId) return;
    const caption = buildProductChannelPost(product);
    // "Sotib olish" tugmasi - do'kondagi o'sha mahsulot sahifasiga
    // to'g'ridan-to'g'ri ochiladigan chuqur havola (`/product/{id}`,
    // xaridor tugmani bosishi bilan Mini App o'sha mahsulot
    // kartochkasida ochiladi - `src/utils/shareLink.js`dagi
    // `buildDeepLink` bilan bir xil format, faqat server tomonida).
    const buttonUrl = buildDeepLink(product.sellerId, `/product/${event.params.productId}`);
    await postToConnectedChannel(product.sellerId, caption, product.image || null, buttonUrl);
    await maybeGenerateAdImage(product.sellerId, event.params.productId, product);
    await maybeGenerateStoryImage(product.sellerId, event.params.productId, product);
  })
);

exports.onCouponCreated = onDocumentCreated(
  { document: "sellers/{sellerId}/coupons/{code}", region: "asia-south1", secrets: [BOT_TOKEN, SENTRY_DSN] },
  withSentry(async (event) => {
    const coupon = event.data?.data();
    const sellerId = event.params.sellerId;
    if (!coupon) return;
    const caption = buildCouponChannelPost(coupon);
    await postToConnectedChannel(sellerId, caption, null, null);
  })
);

exports._testables = { buildProductChannelPost, buildCouponChannelPost, categoryToHashtag, maybeGenerateAdImage, maybeGenerateStoryImage };
