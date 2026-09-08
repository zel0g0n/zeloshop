const { onRequest } = require("firebase-functions/v2/https");
const { db, CUSTOM_BOT_WEBHOOK_SECRET } = require("./lib/admin");
const { decodeDeepLinkPath } = require("./lib/helpers");
const { isDuplicateUpdate } = require("./lib/webhookDedup");
const { SENTRY_DSN, initSentry, Sentry } = require("./lib/sentry");

/**
 * SOTUVCHINING SHAXSIY BOTI UCHUN WEBHOOK (2026-09, sotuvchi so'roviga
 * ko'ra qo'shildi).
 *
 * MUAMMO (foydalanuvchi tomonidan aniqlangan): kanal postidagi va
 * "ulashish"dagi "Sotib olish" tugmasi ZeloShop'ning umumiy boti
 * (`zeloshop_bot`) orqali ochilardi — TO'G'RI sellerning do'koni/
 * mahsuloti ko'rsatilsa ham, bot CHROME'I (nomi, rasmi) ZeloShop'niki
 * bo'lib qolardi, sellerning O'Z brendi emas.
 *
 * NEGA BUTUNLAY YANGI FAYL/INFRATUZILMA KERAK EDI: sellerning shaxsiy
 * boti (`customBot.js`) ilgari HECH QANDAY kiruvchi xabarni qabul
 * qilmasdi (webhook yo'q edi) — faqat "Menu tugmasi" (doim bir xil,
 * do'kon BOSH sahifasini ochadigan) sozlangan edi. Https URL-tugma
 * (`?startapp=...`) esa sellerning botida ISHLAMAYDI, chunki
 * `startapp` faqat BotFather orqali qo'lda ro'yxatdan o'tkazilgan
 * Mini App'da ishlaydi (`src/utils/shareLink.js`dagi izohga qarang) —
 * sellerning oddiy boti buni talab qilmaydi.
 *
 * YECHIM: kanal/ulashish tugmasi endi oddiy `https://t.me/<bot>?start=
 * <payload>` havolasiga ishora qiladi (`buildSellerBotDeepLink`,
 * `lib/helpers.js`) — bosilganda sellerning O'Z boti bilan XUSUSIY
 * chat ochiladi va `/start <payload>` yuboriladi. Shu YERDA (WEBHOOK)
 * buni qabul qilib, javobida HAQIQIY Mini App tugmasini
 * (`web_app` turidagi inline tugma) yuboramiz — bu tur XUSUSIY
 * chatda `/newapp`siz ham ishlaydi (Telegram Bot API cheklovi: `web_app`
 * tugma FAQAT xususiy chatlarda ishlaydi — aynan shuning uchun bu
 * kanal postining O'ZIDA emas, shu yerda, foydalanuvchi botga o'tib
 * "Start" bosgandan KEYIN yuboriladi).
 *
 * XAVFSIZLIK: `telegramCallbackWebhook`/`courierBotWebhook` bilan BIR
 * XIL naqsh — har bir so'rov `X-Telegram-Bot-Api-Secret-Token`
 * sarlavhasi orqali tekshiriladi. FARQ: bu YAGONA webhook YUZLAB
 * TURLI sellerning botlaridan so'rov qabul qiladi (har biri O'Z
 * tokeni bilan `setWebhook` qilingan, lekin BIR XIL umumiy maxfiy
 * kalit bilan) — qaysi sellerga tegishli ekanini URL yo'lidagi
 * `sellerId`dan bilamiz (`connectCustomBot` shu ID bilan ro'yxatdan
 * o'tkazadi). `sellerId` o'zi maxfiy EMAS (URL'da ochiq ko'rinadi) —
 * xavfsizlik chegarasi FAQAT maxfiy `secret_token`ning O'ZI, uni
 * bilmagan hech kim bu manzilga soxta so'rov yubora olmaydi.
 */
/**
 * Sof(ga yaqin) mantiq — Firestore'dan o'qiydi va (agar kerak bo'lsa)
 * Telegram'ga BITTA `sendMessage` so'rovi yuboradi, lekin Express
 * `req`/`res` bilan ISHLAMAYDI — shu orqali `staffBot.js`/`courierBot.js`
 * bilan BIR XIL naqshda, Express'ni mock qilmasdan TO'G'RIDAN-TO'G'RI
 * sinaladi (`__tests__/customBotWebhook.test.js`).
 *
 * @param {string} sellerId
 * @param {{text?: string, chat?: {id: number|string}}} message - Telegram
 *   `update.message` obyekti.
 */
async function handleCustomBotStartMessage(sellerId, message) {
  const text = typeof message?.text === "string" ? message.text.trim() : "";
  const chatId = message?.chat?.id;

  // Faqat "/start" buyrug'ini qayta ishlaymiz (payload bilan yoki
  // payloadsiz) — boshqa har qanday matn/xabar turi e'tiborsiz
  // qoldiriladi (bu bot to'liq suhbat botini emas, faqat "do'konni
  // ochish" ko'prigi vazifasini bajaradi).
  if (!chatId || !text.startsWith("/start")) {
    return;
  }

  const [sellerSnap, customBotSnap] = await Promise.all([
    db.collection("sellers").doc(sellerId).get(),
    db.collection("sellers").doc(sellerId).collection("private").doc("customerBot").get(),
  ]);

  const botToken = customBotSnap.exists ? customBotSnap.data().botToken : null;
  if (!botToken) {
    // Bot uzilgan/ulanmagan holatda ham bo'lishi mumkin (masalan
    // webhook eski ma'lumot bilan hali faol) — hech narsa qila olmaymiz.
    return;
  }

  const storeName = sellerSnap.exists ? sellerSnap.data().storeName : null;

  // "/start" dan keyingi payload (bo'sh bo'lishi mumkin — oddiy
  // "Start" bosilganda). Telegram buni bo'sh joy bilan ajratib
  // yuboradi: "/start p_XYZ".
  const payload = text.slice("/start".length).trim();
  const encodedPath = payload.startsWith("p") ? payload.slice(1) : "";
  const decodedPath = encodedPath ? decodeDeepLinkPath(encodedPath) : null;

  const webAppUrl = decodedPath
    ? `https://commerce-zelo.web.app/?ownerSellerId=${sellerId}&deepLinkPath=${encodeURIComponent(decodedPath)}`
    : `https://commerce-zelo.web.app/?ownerSellerId=${sellerId}`;

  const greetingText = decodedPath
    ? `🛍 Xush kelibsiz! ${storeName ? `*${storeName}*dagi ` : ""}mahsulotni ko'rish uchun pastdagi tugmani bosing.`
    : `🛍 ${storeName ? `*${storeName}*ga` : "Do'konga"} xush kelibsiz! Pastdagi tugma orqali kataloglarni ko'ring.`;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: greetingText,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "🛒 Do'konni ochish", web_app: { url: webAppUrl } }]],
      },
    }),
  });
}

async function handleCustomBotWebhook(req, res) {
  const providedSecret = req.get("X-Telegram-Bot-Api-Secret-Token");
  if (providedSecret !== CUSTOM_BOT_WEBHOOK_SECRET.value()) {
    res.status(401).send("unauthorized");
    return;
  }

  // `req.path` — `/customBotWebhook/{sellerId}` manzilidagi
  // `{sellerId}` qismi (Cloud Run to'liq yo'lni funksiyaga uzatadi).
  const sellerId = String(req.path || "").replace(/^\/+/, "").split("/")[0];
  if (!sellerId) {
    // sellerId'siz so'rov — noto'g'ri ro'yxatga olingan webhook
    // bo'lishi mumkin, lekin Telegram qayta urinmasligi uchun baribir 200.
    res.status(200).send("ok");
    return;
  }

  if (await isDuplicateUpdate(`customBot_${sellerId}`, req.body?.update_id)) {
    res.status(200).send("ok");
    return;
  }

  try {
    await handleCustomBotStartMessage(sellerId, req.body?.message);
    res.status(200).send("ok");
  } catch (err) {
    console.error("Sotuvchi botining webhook so'rovini qayta ishlashda xatolik:", err);
    initSentry();
    Sentry.captureException(err, { extra: { sellerId } });
    // Xato bo'lsa ham 200 — Telegram'ning cheksiz qayta urinishiga
    // yo'l qo'ymaslik uchun (boshqa webhook'larimiz bilan bir xil naqsh).
    res.status(200).send("ok");
  }
}

exports.customBotWebhook = onRequest(
  { region: "asia-south1", secrets: [CUSTOM_BOT_WEBHOOK_SECRET, SENTRY_DSN] },
  handleCustomBotWebhook
);

exports._testables = { handleCustomBotWebhook, handleCustomBotStartMessage };
