/**
 * Firestore hujjatidagi Timestamp maydonlarini (masalan `createdAt`)
 * JSON orqali xavfsiz uzatiladigan ISO-sana matniga aylantiradi - aks
 * holda Cloud Function javobi frontendda ishlatib bo'lmaydigan
 * shaklda qaytishi mumkin.
 */
function sanitizeFirestoreData(data) {
  if (!data) return data;
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value.toDate === "function") {
      result[key] = value.toDate().toISOString();
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Telegram Bot API orqali xabar yuborish yordamchisi. Node 20'da
 * `fetch` global sifatida mavjud, qo'shimcha kutubxona talab
 * qilinmaydi.
 *
 * `options` — ixtiyoriy, boyitilgan xabarlar uchun (masalan banner
 * rasmli CRM broadcast xabarlari): banner rasm bo'lsa `sendPhoto`,
 * aks holda oddiy `sendMessage` ishlatiladi. Inline tugma va Markdown
 * formati ham shu orqali qo'llab-quvvatlanadi. Bu parametr
 * berilmasa, funksiya oddiy matnli xabar sifatida ishlaydi.
 */
async function sendTelegramMessage(token, chatId, text, options = {}) {
  const { bannerImageUrl, buttonText, buttonUrl, inlineKeyboard, replyMarkup: rawReplyMarkup } = options;

  // `inlineKeyboard` — haqiqiy interaktiv (`callback_data`) tugmalar
  // qatorini beradi: oddiy URL-ochuvchi tugma (`buttonUrl`) dan farqli
  // ravishda, bosilganda Telegram URL ochmaydi, aksincha webhook'ga
  // "callback_query" yuboradi. Berilsa, `buttonText`/`buttonUrl`
  // juftligidan ustun turadi.
  //
  // `replyMarkup` — matn kiritish maydoni ustidagi doimiy "reply
  // keyboard" (`{keyboard:[[...]], resize_keyboard:true}`) uchun -
  // `inline_keyboard`dan farqli shakl. Berilsa, o'zgarishsiz
  // ishlatiladi va yuqoridagi ikkalasidan ham ustun turadi.
  const replyMarkup = rawReplyMarkup !== undefined
    ? rawReplyMarkup
    : inlineKeyboard
    ? { inline_keyboard: inlineKeyboard }
    : buttonText && buttonUrl
      ? { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] }
      : undefined;

  const method = bannerImageUrl ? "sendPhoto" : "sendMessage";
  const buildBody = (withMarkdown) => (bannerImageUrl
    ? { chat_id: chatId, photo: bannerImageUrl, caption: text, ...(withMarkdown ? { parse_mode: "Markdown" } : {}), reply_markup: replyMarkup }
    : { chat_id: chatId, text, ...(withMarkdown ? { parse_mode: "Markdown" } : {}), reply_markup: replyMarkup });

  // 4-BOT EKOTIZIM AUDITI (P1) — TRANZIT (vaqtinchalik) xatoliklar
  // uchun qayta urinish: Telegram'ning o'zi so'rovlar sonini
  // cheklashi (429, ko'pincha "Retry-After" sarlavhasi bilan birga
  // keladi) yoki uning serverida vaqtinchalik nosozlik (5xx) — bunday
  // hollarda BITTA urinish xabarni butunlay yo'qotib qo'yishi mumkin
  // edi. Endi qisqa orqaga chekinish (backoff) bilan yana ikki marta
  // qayta urinamiz (jami 3 marta) — lekin ANIQ, doimiy xatoliklar
  // uchun (masalan "chat not found", noto'g'ri token — HTTP 400/401/403)
  // QAYTA URINILMAYDI, chunki bu holatlarda qayta urinish ma'nosiz va
  // funksiyani keraksiz uzaytiradi ("no infinite retry on permanent
  // failure" talabi).
  const MAX_TRANSIENT_RETRIES = 2;
  async function attemptRequest(withMarkdown) {
    let lastData = null;
    for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES; attempt++) {
      const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(withMarkdown)),
      });
      const data = await res.json();
      lastData = data;
      const isTransient = res.status === 429 || res.status >= 500;
      if (data.ok || !isTransient || attempt === MAX_TRANSIENT_RETRIES) {
        return data;
      }
      const retryAfterSeconds = Number(data.parameters?.retry_after) || 0;
      const backoffMs = retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 250 * 3 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
    return lastData;
  }

  try {
    const data = await attemptRequest(true);

    // Agar Markdown formati xato bo'lsa (xabar matnida maxsus belgilar
    // bo'lishi mumkin), oddiy matn sifatida qayta urinamiz — shunda
    // xabar butunlay yuborilmasdan qolib ketmaydi.
    if (!data.ok && data.description?.includes("parse")) {
      const retryData = await attemptRequest(false);
      return { chatId, ok: Boolean(retryData.ok), description: retryData.description };
    }

    return { chatId, ok: Boolean(data.ok), description: data.description };
  } catch (err) {
    return { chatId, ok: false, error: err.message };
  }
}

/**
 * `startapp` qiymatini ajratadi. To'rt xil shaklda bo'lishi mumkin:
 *   - "sellerId" - oddiy do'kon havolasi
 *   - "sellerId_rReferrerId" - mijozlar uchun referal havolasi
 *   - "sellerId_pEncodedPath" - chuqur havola (masalan bitta
 *     kategoriya yoki mahsulotga to'g'ridan-to'g'ri olib boradi)
 *   - "sellerId_i" - SOTUVCHINI taklif qilish havolasi (`sellerId` bu
 *     yerda "qaysi do'konga o'tish kerak" emas, balki "kim taklif
 *     qilgan sotuvchi" degani - `sellerReferrals.js`ga qarang)
 *
 * sellerId va referrerId — ikkalasi ham faqat raqamlardan iborat
 * Telegram foydalanuvchi ID'lari, shuning uchun "_r"/"_i" ajratkichlari
 * ular bilan hech qachon to'qnashmaydi - bu formatni oddiy va ishonchli
 * qiladi.
 *
 * "_p" segmenti ichidagi yo'l (masalan "/category/Skincare") Telegram
 * `start_param` faqat harf/raqam/pastki chiziq/tire qabul qilishi
 * sababli base64url (URL-xavfsiz) shaklida kodlangan bo'ladi -
 * `encodeDeepLinkPath`/`decodeDeepLinkPath` bilan bir xil kodlashdan
 * foydalaniladi (frontend: `src/utils/deepLink.js`).
 */
function parseStartParam(raw) {
  if (!raw || typeof raw !== "string") {
    return { sellerId: null, referrerId: null, deepLinkPath: null, sellerInviterId: null };
  }

  const pathIdx = raw.indexOf("_p");
  if (pathIdx !== -1) {
    const sellerId = raw.slice(0, pathIdx) || null;
    const encodedPath = raw.slice(pathIdx + 2) || null;
    return { sellerId, referrerId: null, deepLinkPath: decodeDeepLinkPath(encodedPath), sellerInviterId: null };
  }

  // MUHIM: "_i" tekshiruvi "_r"dan OLDIN keladi - bu havolada
  // "qaysi do'konga o'tish" degan ma'no UMUMAN yo'q, shuning uchun
  // `sellerId` maydoni bu holatda ATAYLAB `null` qaytariladi (aks
  // holda chaqiruvchi kod - masalan `auth.js` - buni xato ravishda
  // "mijoz X do'konini ko'rmoqchi" deb talqin qilib qo'yishi mumkin).
  const inviteIdx = raw.indexOf("_i");
  if (inviteIdx !== -1) {
    const sellerInviterId = raw.slice(0, inviteIdx) || null;
    return { sellerId: null, referrerId: null, deepLinkPath: null, sellerInviterId };
  }

  const idx = raw.indexOf("_r");
  if (idx === -1) return { sellerId: raw, referrerId: null, deepLinkPath: null, sellerInviterId: null };
  const sellerId = raw.slice(0, idx) || null;
  const referrerId = raw.slice(idx + 2) || null;
  return { sellerId, referrerId, deepLinkPath: null, sellerInviterId: null };
}

/**
 * `src/config/telegram.js`dagi BOT_USERNAME/APP_SHORT_NAME bilan bir
 * xil bo'lishi shart (loyihada frontend+backend duplikatsiyasi naqshi
 * qo'llaniladi, masalan `deliveryTiers.js`da ham). Bot username
 * o'zgartirilsa, ikkala joyni ham yangilash kerak.
 */
const BOT_USERNAME = "zeloshop_bot";
const APP_SHORT_NAME = "shop";

/**
 * `src/utils/deepLink.js`dagi `encodeDeepLinkPath`ning server tomoni -
 * ilova ichki yo'lini (masalan "/product/abc123") Telegram
 * `start_param`ga joylash uchun base64url (URL-xavfsiz) shaklda
 * kodlaydi. `decodeDeepLinkPath` bilan mos kodlash ishlatiladi.
 */
function encodeDeepLinkPath(path) {
  if (!path) return "";
  const base64 = Buffer.from(path, "utf-8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * `src/utils/shareLink.js`dagi `buildDeepLink`ning server tomoni -
 * backenddan (masalan avtomatik kanal posti, `productAutomation.js`)
 * do'kon ichidagi ma'lum bir sahifaga (masalan bitta mahsulotga)
 * to'g'ridan-to'g'ri ochiladigan Telegram havolasi kerak bo'lganda
 * ishlatiladi - frontend kodi bunday joyda ishga tushmaydi.
 */
function buildDeepLink(sellerId, path) {
  if (!sellerId || !path) return null;
  return `https://t.me/${BOT_USERNAME}/${APP_SHORT_NAME}?startapp=${sellerId}_p${encodeDeepLinkPath(path)}`;
}

/**
 * SOTUVCHINING SHAXSIY BOTI orqali ochiladigan havola (2026-09,
 * sotuvchi so'roviga ko'ra qo'shildi — kanal posti/ulashishdagi
 * "Sotib olish" tugmasi ZeloShop'ning umumiy boti o'rniga sellerning
 * O'ZINING botiga olib borishi uchun).
 *
 * NEGA `buildDeepLink`dan (yuqorida) FARQLI, `?startapp=`EMAS,
 * `?start=` ishlatiladi: `startapp` faqat botda BotFather orqali
 * qo'lda ro'yxatdan o'tkazilgan Mini App ("/newapp") bo'lsagina
 * ishlaydi — sotuvchining shaxsiy boti buni talab qilmaydi
 * (`connectCustomBot` oqimi ataylab shunday soddalashtirilgan,
 * `src/utils/shareLink.js`dagi izohga qarang). Oddiy `?start=` esa
 * HAR QANDAY botda ishlaydi — bosilganda bot bilan shaxsiy chat
 * ochiladi va `/start <payload>` buyrug'i yuboriladi, buni esa
 * ENDI `customBotWebhook.js` QABUL QILADI va javobida haqiqiy Mini
 * App tugmasini (`web_app` turidagi inline tugma — bu XUSUSIY chatda
 * `/newapp`siz ham ishlaydi) yuboradi.
 *
 * `botUsername` — `sellers/{id}.customBotUsername` (ommaviy maydon,
 * `customBot.js`da yoziladi). Agar sotuvchi hali shaxsiy botini
 * ulamagan bo'lsa, chaqiruvchi kod (`productAutomation.js`,
 * `shareProductAsPost.js`) buning o'rniga `buildDeepLink`ga
 * (umumiy ZeloShop boti) qaytishi kerak — bu funksiya shunchaki
 * `null` qaytaradi, xato tashlamaydi.
 */
function buildSellerBotDeepLink(botUsername, path) {
  if (!botUsername) return null;
  const payload = path ? `p${encodeDeepLinkPath(path)}` : "";
  return payload
    ? `https://t.me/${botUsername}?start=${payload}`
    : `https://t.me/${botUsername}`;
}

/**
 * Platform ilovasini (Mini App) bevosita, `start_param`siz ochadigan
 * havola. `buildDeepLink`dan farqi: `buildDeepLink` orqali ochilgan
 * sahifa `SessionContext.jsx`da har doim "mijoz" sifatida
 * (`isSeller:false`) ochiladi (chuqur havolalar do'stlar bilan
 * ulashish uchun mo'ljallangan, hatto qabul qiluvchi o'zi boshqa
 * joyda sotuvchi bo'lsa ham). Bu funksiya esa Telegram bot
 * tugmasining `web_app` turida ishlatiladi (masalan
 * `telegramBotMenu.js`dagi "Buyurtmalarni ko'rish" tugmasi) -
 * bosilganda ilova odatiy autentifikatsiyadan (Telegram initData →
 * Firebase custom token, `start_param`siz) o'tadi, ya'ni sotuvchi
 * o'zining sotuvchi profilida ochiladi - xuddi mavjud "Do'konni
 * ochish" BotFather menyu tugmasi kabi.
 */
function buildSellerAppLink(path) {
  return `https://commerce-zelo.web.app${path || ""}`;
}

/**
 * Base64url (URL-xavfsiz, "+"/"/" belgilarisiz) kodlashdan yo'lni
 * qaytaradi. Agar kod noto'g'ri/buzilgan bo'lsa, `null` qaytaradi -
 * xato tashlamaydi (chuqur havola ishlamasa ham, oddiy do'kon
 * ochilishi davom etishi kerak).
 */
function decodeDeepLinkPath(encoded) {
  if (!encoded) return null;
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(base64, "base64").toString("utf-8");
    // Xavfsizlik: faqat ilova ICHKI yo'liga o'xshagan qatorlarni
    // qabul qilamiz ("/" bilan boshlanadi) - tashqi URL'larga
    // yo'naltirishning oldini olish uchun.
    //
    // XAVFSIZLIK (2026-09 audit, P2): oldin FAQAT `startsWith("/")`
    // tekshirilardi — bu "//evil.com" (PROTOKOLGA NISBIY URL, ya'ni
    // brauzer buni "https://evil.com" deb talqin qiladi) kabi
    // qatorlarni HAM noto'g'ri o'tkazib yuborardi, chunki u ham "/"
    // bilan boshlanadi. Bu keyinchalik `RootEntry.jsx`dagi
    // `<Navigate to={deepLinkPath} />`ga yetib borib, qurbonning
    // brauzerida `SecurityError` (yoki React Router versiyasiga qarab,
    // haqiqiy tashqi manzilga navigatsiya) bilan natijalanardi — bu
    // zararli Telegram chuqur havolasi (deep link) orqali qurbonni
    // BOSHQA saytga olib chiqishi mumkin bo'lgan xavfli holat edi.
    // Endi ikkinchi belgi ("/" yoki teskari qiya chiziq "\\" — ba'zi
    // brauzerlar buni ham "/" sifatida talqin qiladi) BO'LMASLIGI ham
    // tekshiriladi — faqat HAQIQIY, BITTA "/" bilan boshlangan ICHKI
    // yo'llar o'tadi.
    if (!decoded.startsWith("/")) return null;
    if (decoded.length > 1 && (decoded[1] === "/" || decoded[1] === "\\")) return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Telegram inline tugma bosilganda ("callback_query") majburiy
 * javob — Telegram HAR BIR callback_query'ga `answerCallbackQuery`
 * chaqirilishini talab qiladi, aks holda foydalanuvchi ekranida
 * tugma "yuklanmoqda..." holatida cheksiz osilib qoladi. `text`
 * berilsa, ekranning tepasida kichik bildirishnoma (toast) sifatida
 * ko'rinadi (masalan "✅ Yuborildi").
 */
async function answerCallbackQuery(token, callbackQueryId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text: text || undefined }),
    });
  } catch (err) {
    console.error("Telegram callback_query javobida xatolik:", err);
  }
}

/**
 * Allaqachon yuborilgan Telegram xabarining matnini (va, agar
 * `inlineKeyboard` berilmasa, tugmalarini ham) yangilaydi. "Bir
 * tugmali tasdiqlash" oqimida — sotuvchi tugmani bosgach, xabar
 * "✅ Yuborildi" / "❌ Bekor qilindi" holatiga o'zgaradi va tugmalar
 * olib tashlanadi (qayta bosilib, ikki marta yuborilishining oldini
 * olish uchun — `inlineKeyboard` berilmasa, standart holatda bo'sh
 * qatorga o'rnatiladi).
 */
async function editTelegramMessageText(token, chatId, messageId, text, { inlineKeyboard = [] } = {}) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: inlineKeyboard },
      }),
    });
  } catch (err) {
    console.error("Telegram xabarini tahrirlashda xatolik:", err);
  }
}

/**
 * Telegramning o'zining "jonli joylashuv" (Live Location) xabarini
 * yuboradi. Statik xarita-rasm o'rniga, Telegram ichida native,
 * avtomatik yangilanadigan pufakcha mijozning chatiga to'g'ridan-
 * to'g'ri yuboriladi (frontend Mini App xaritasidan tashqari,
 * qo'shimcha imkoniyat sifatida).
 *
 * `livePeriodSeconds` — soniyalarda (Telegram talabi: 60-86400
 * oralig'ida). Muvaffaqiyatli bo'lsa yuborilgan xabar ID'sini
 * ("message_id") qaytaradi — buni keyinchalik
 * `editTelegramLiveLocation`/`stopTelegramLiveLocation` uchun
 * saqlab qo'yish kerak. Xatolik bo'lsa `null` qaytaradi — chaqiruvchi
 * buni muhim bo'lmagan xatolik sifatida ko'rib davom etishi kerak,
 * chunki asosiy funksionallik (Firestore yozuvi) bunga bog'liq emas.
 */
async function sendTelegramLiveLocation(token, chatId, lat, lng, livePeriodSeconds) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendLocation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, latitude: lat, longitude: lng, live_period: livePeriodSeconds }),
    });
    const data = await res.json();
    return data.ok ? data.result?.message_id ?? null : null;
  } catch (err) {
    console.error("Telegram jonli joylashuvni yuborishda xatolik:", err);
    return null;
  }
}

/**
 * Avval `sendTelegramLiveLocation` orqali yuborilgan xabarni YANGI
 * koordinatalar bilan yangilaydi. MUHIM: buni FAQAT o'sha xabarni
 * yuborgan BOT (bir xil token) chaqira oladi.
 */
async function editTelegramLiveLocation(token, chatId, messageId, lat, lng) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/editMessageLiveLocation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, latitude: lat, longitude: lng }),
    });
  } catch (err) {
    console.error("Telegram jonli joylashuvni yangilashda xatolik:", err);
  }
}

/**
 * Yetkazma yakunlanganda (`delivered`/`failed`) jonli joylashuvni
 * ANIQ to'xtatadi — aks holda pufakcha `live_period` muddati
 * tugagunicha (soatlab) "jonli" ko'rinishda osilib qolar edi, garchi
 * kuryer allaqachon to'xtagan bo'lsa ham (chalg'ituvchi UX).
 */
async function stopTelegramLiveLocation(token, chatId, messageId) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/stopMessageLiveLocation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
  } catch (err) {
    console.error("Telegram jonli joylashuvni to'xtatishda xatolik:", err);
  }
}

module.exports = {
  sanitizeFirestoreData, sendTelegramMessage, parseStartParam,
  answerCallbackQuery, editTelegramMessageText,
  encodeDeepLinkPath, decodeDeepLinkPath, buildDeepLink, buildSellerBotDeepLink, buildSellerAppLink,
  sendTelegramLiveLocation, editTelegramLiveLocation, stopTelegramLiveLocation,
};
