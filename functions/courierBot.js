const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin, db, BOT_TOKEN, COURIER_BOT_TOKEN, COURIER_TELEGRAM_WEBHOOK_SECRET } = require("./lib/admin");
const { sendTelegramMessage, answerCallbackQuery, editTelegramMessageText, buildSellerAppLink } = require("./lib/helpers");
const { applyCourierOrderAction, buildCourierActionKeyboard, COURIER_ACTION_LABELS, handleCourierLiveLocationUpdate } = require("./couriers");
const { isDuplicateUpdate } = require("./lib/webhookDedup");

/**
 * Kuryer boti — `zeloshop_kuryer_bot`, `courierBotWebhook`.
 *
 * `telegramApproval.js`/`telegramBotMenu.js` bilan bir xil naqsh
 * (webhook + `X-Telegram-Bot-Api-Secret-Token` tekshiruvi + "reply
 * keyboard" menyu), lekin butunlay boshqa, mustaqil bot (o'z tokeni,
 * o'z webhook maxfiy kaliti), chunki Telegram har bir bot uchun faqat
 * bitta webhook manzilini qo'llab-quvvatlaydi. Bu bot barcha
 * sotuvchilarning barcha kuryerlari uchun umumiy (platforma
 * darajasida, sotuvchining shaxsiy `customBot.js` boti emas).
 *
 * Ikki xil tezkor amal yo'li mavjud:
 *   1) Botning o'zidagi inline tugmalar (`cor:<amal>:<orderId>`) -
 *      Mini App'ni ochmasdan, bitta bosish bilan holat yangilanadi.
 *   2) "📦 Yetkazmalarim" tugmasi - to'liq Mini App'ni ochadi
 *      (`/courier` yo'li, `src/features/courier/*`), batafsil
 *      ro'yxat/tafsilot uchun.
 * Ikkalasi ham bir xil asosiy mantiqni (`couriers.js`dagi
 * `applyCourierOrderAction`) chaqiradi - kod duplikatsiyasi yo'q.
 */

const MENU_MY_DELIVERIES_TEXT = "📦 Yetkazmalarim";

/**
 * Sof funksiya - asosiy (doimiy) kuryer menyusi. Hozircha bitta
 * tugma - kelajakda kengaytirilishi mumkin (masalan "Bugungi
 * daromad" kabi).
 */
function buildCourierMenuKeyboard() {
  return { keyboard: [[{ text: MENU_MY_DELIVERIES_TEXT }]], resize_keyboard: true };
}

async function sendCourierReply(token, chatId, text, keyboard) {
  await sendTelegramMessage(token, chatId, text, { replyMarkup: keyboard });
}

/**
 * Sof funksiya - "/start <payload>" buyrug'idagi taklif tokenini
 * ajratadi va undan sotuvchi ID'sini (token prefiksi) o'qiydi.
 * `couriers.js`dagi `handleCreateCourierInvite`ning
 * "{sellerId}_{tasodifiy}" formati bilan mos.
 */
function parseInvitePayload(payload) {
  if (!payload || typeof payload !== "string") return null;
  const idx = payload.indexOf("_");
  if (idx <= 0) return null;
  const sellerId = payload.slice(0, idx);
  return { sellerId, token: payload };
}

/**
 * Sof funksiya - Telegram'dan kelgan `callback_data`ni
 * ("cor:delivered:abc123") ajratadi.
 */
function parseCourierCallbackData(data) {
  if (!data || typeof data !== "string") return null;
  const parts = data.split(":");
  if (parts.length < 3) return null;
  const [prefix, action, ...rest] = parts;
  const orderId = rest.join(":");
  if (prefix !== "cor" || !action || !orderId) return null;
  return { action, orderId };
}

/**
 * "/start" buyrug'i - ikkita holat: (a) kuryer allaqachon ulangan -
 * shunchaki menyuni qayta ko'rsatamiz (idempotent, boshqa bot
 * fayllaridagi "/start" naqshi bilan bir xil); (b) hali ulanmagan -
 * taklif tokenini tekshirib, muvaffaqiyatli bo'lsa `couriers/{id}`
 * hujjatini yaratamiz.
 */
async function handleStartCommand(token, courierTgId, chatId, payload) {
  const existingSnap = await db.collection("couriers").doc(courierTgId).get();
  if (existingSnap.exists) {
    const courier = existingSnap.data();
    await sendCourierReply(
      token, chatId,
      `Xush kelibsiz, ${courier.name || ""}! Quyidagi tugmadan foydalaning.`,
      buildCourierMenuKeyboard()
    );
    return;
  }

  const parsed = parseInvitePayload(payload);
  if (!parsed) {
    await sendCourierReply(
      token, chatId,
      "Assalomu alaykum! Bu bot faqat do'kon egangiz yuborgan TAKLIF HAVOLASI orqali ishlaydi. Iltimos, sotuvchingizdan havola so'rang.",
      undefined
    );
    return;
  }

  const inviteRef = db.collection("sellers").doc(parsed.sellerId).collection("courierInvites").doc(parsed.token);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists || inviteSnap.data().used) {
    await sendCourierReply(
      token, chatId,
      "Bu taklif havolasi yaroqsiz yoki allaqachon ishlatilgan. Sotuvchingizdan yangi havola so'rang.",
      undefined
    );
    return;
  }

  const invite = inviteSnap.data();
  const sellerSnap = await db.collection("sellers").doc(parsed.sellerId).get();
  const storeName = sellerSnap.exists ? sellerSnap.data().storeName : null;

  await db.collection("couriers").doc(courierTgId).set({
    sellerId: parsed.sellerId,
    name: invite.name,
    phone: invite.phone || null,
    status: "active",
    linkedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await inviteRef.update({
    used: true,
    usedAt: admin.firestore.FieldValue.serverTimestamp(),
    courierId: courierTgId,
  });

  await sendCourierReply(
    token, chatId,
    `Xush kelibsiz, ${invite.name}!${storeName ? ` Endi "${storeName}" do'koni uchun` : " Endi"} kuryer sifatida ulandingiz. Sizga yangi yetkazma biriktirilganda shu yerda darhol xabar beramiz.`,
    buildCourierMenuKeyboard()
  );
}

/**
 * "📦 Yetkazmalarim" tugmasi - Mini App'ning `/courier` sahifasini
 * ochadigan `web_app` tugmasi bilan xabar yuboradi. Oldindan sanoq
 * hisoblanmaydi (masalan "sizda N ta faol yetkazma bor") - `courierId`
 * bo'yicha faol/nofaol holatlarni ajratib sanash qo'shimcha kompozit
 * indeks talab qiladi; Mini App'ning o'zi ochilgach, ro'yxatni to'liq
 * va aniq ko'rsatadi.
 */
async function handleMyDeliveriesButton(token, chatId) {
  await sendTelegramMessage(token, chatId, "Yetkazmalaringizni ko'rish uchun pastdagi tugmani bosing.", {
    inlineKeyboard: [[{ text: "📦 Yetkazmalarni ko'rish", web_app: { url: buildSellerAppLink("/courier") } }]],
  });
}

/**
 * Telegramning jonli joylashuvi haqida kelgan yangilanishni (birinchi
 * ulashish - `message.location`, yoki keyingi davriy yangilanishlar -
 * `edited_message.location`) `couriers.js`ga yo'naltiradi. Ikkalasi
 * ham bir xil shaklda keladi (`{latitude, longitude, live_period,
 * ...}`), shuning uchun bitta funksiya ikkalasini ham qamrab oladi.
 *
 * Bu jim (silent) yo'l - javob xabari yo'q, chunki Telegram jonli
 * joylashuvning har bir yangilanishida kuryerga xabar yuborsak, bu
 * juda tez-tez (har necha soniyada) va bezovta qiluvchi bo'lar edi.
 */
async function handleCourierLiveLocationMessage(fromId, location) {
  const courierTgId = String(fromId || "");
  if (!courierTgId || !location) return;
  const { latitude, longitude } = location;
  if (typeof latitude !== "number" || typeof longitude !== "number") return;
  await handleCourierLiveLocationUpdate({ courierId: courierTgId, lat: latitude, lng: longitude });
}

/**
 * Telegram webhook'ga kelgan `message` turidagi yangilanish uchun
 * ASOSIY yo'naltiruvchi.
 */
async function handleCourierTelegramMessage(token, message) {
  const courierTgId = String(message?.from?.id || "");
  const chatId = message?.chat?.id;
  if (!courierTgId || !chatId) return;

  const text = (message.text || "").trim();
  if (!text) return;

  if (text === "/start" || text.startsWith("/start ")) {
    const payload = text.length > 6 ? text.slice(6).trim() : null;
    await handleStartCommand(token, courierTgId, chatId, payload || null);
    return;
  }

  if (text === MENU_MY_DELIVERIES_TEXT) {
    await handleMyDeliveriesButton(token, chatId);
    return;
  }

  // Boshqa erkin matn - faqat allaqachon ulangan kuryerlarga menyuni
  // eslatib qo'yamiz (ulanmagan begona odamlarga jim qolamiz).
  const courierSnap = await db.collection("couriers").doc(courierTgId).get();
  if (courierSnap.exists) {
    await sendCourierReply(token, chatId, "Quyidagi tugmadan foydalaning.", buildCourierMenuKeyboard());
  }
}

/**
 * Telegram webhook — `telegramApproval.js`dagi `telegramCallbackWebhook`
 * bilan bir xil naqsh, lekin butunlay mustaqil bot/token/webhook
 * maxfiy kaliti bilan.
 *
 * `edited_message` turidagi yangilanishlar ham qabul qilinadi
 * (`handleRegisterCourierBotWebhook`dagi `allowed_updates`ga qarang) -
 * Telegramning jonli joylashuv yangilanishlari aynan shu shaklda
 * keladi (kuryer birinchi marta ulashganda - oddiy
 * `message.location`, keyingi har bir davriy yangilanishda -
 * `edited_message.location`).
 */
exports.courierBotWebhook = onRequest(
  { region: "asia-south1", secrets: [COURIER_BOT_TOKEN, COURIER_TELEGRAM_WEBHOOK_SECRET, BOT_TOKEN] },
  async (req, res) => {
    const providedSecret = req.get("X-Telegram-Bot-Api-Secret-Token");
    if (providedSecret !== COURIER_TELEGRAM_WEBHOOK_SECRET.value()) {
      res.status(401).send("unauthorized");
      return;
    }

    // 4-BOT EKOTIZIM AUDITI (P1) — batafsil izoh: `lib/webhookDedup.js`.
    // Telegram bir xil yangilanishni qayta yuborsa (tarmoq muammosi),
    // kuryerga/mijozga/sotuvchiga bildirishnoma IKKINCHI marta
    // ketmasligi uchun.
    if (await isDuplicateUpdate("courier", req.body?.update_id)) {
      res.status(200).send("ok");
      return;
    }

    const token = COURIER_BOT_TOKEN.value();
    const message = req.body?.message;

    if (message?.location) {
      try {
        await handleCourierLiveLocationMessage(message.from?.id, message.location);
      } catch (err) {
        console.error("Kuryerning (birinchi) jonli joylashuvini qayta ishlashda xatolik:", err);
      }
      res.status(200).send("ok");
      return;
    }

    if (message) {
      try {
        await handleCourierTelegramMessage(token, message);
      } catch (err) {
        console.error("Kuryer botiga xabarni qayta ishlashda xatolik:", err);
      }
      res.status(200).send("ok");
      return;
    }

    const editedMessage = req.body?.edited_message;
    if (editedMessage?.location) {
      try {
        await handleCourierLiveLocationMessage(editedMessage.from?.id, editedMessage.location);
      } catch (err) {
        console.error("Kuryerning jonli joylashuv yangilanishini qayta ishlashda xatolik:", err);
      }
      res.status(200).send("ok");
      return;
    }

    const callbackQuery = req.body?.callback_query;
    if (!callbackQuery) {
      res.status(200).send("ok");
      return;
    }

    try {
      const courierTgId = String(callbackQuery.from?.id || "");
      const chatId = callbackQuery.message?.chat?.id;
      const messageId = callbackQuery.message?.message_id;
      const parsed = parseCourierCallbackData(callbackQuery.data);

      if (!courierTgId || !parsed) {
        await answerCallbackQuery(token, callbackQuery.id, "Noma'lum amal.");
        res.status(200).send("ok");
        return;
      }

      const actionResult = await applyCourierOrderAction({ courierId: courierTgId, orderId: parsed.orderId, action: parsed.action });
      const label = COURIER_ACTION_LABELS[parsed.action] || parsed.action;
      await answerCallbackQuery(token, callbackQuery.id, label);

      if (chatId && messageId) {
        // Ikki bosqichli holat: "picked_up" muvaffaqiyatli bo'lsa,
        // xabar yakuniy emas - u endi "picked_up" bosqichi tugmalariga
        // (Yetkazildi/Yetkaza olmadim) almashtiriladi.
        // "delivered"/"failed"/"declined" esa yakuniy - tugmalar olib
        // tashlanadi (`couriers.js`dagi `buildCourierActionKeyboard`
        // izohiga qarang).
        const isFinal = ["delivered", "failed", "declined"].includes(parsed.action);
        // Xom Firestore ID kesimisi o'rniga `orderNumber` (2026-09
        // punkt-royxati, 6-band) — `applyCourierOrderAction`ning o'zi
        // qaytaradi.
        await editTelegramMessageText(
          token, chatId, messageId,
          `${label}\n\nBuyurtma №${actionResult.orderNumber || "-"}.`,
          { inlineKeyboard: isFinal ? [] : buildCourierActionKeyboard(parsed.orderId, "picked_up") }
        );
      }
      res.status(200).send("ok");
    } catch (err) {
      console.error("Kuryer botining callback_query'sida xatolik:", err);
      try {
        await answerCallbackQuery(token, callbackQuery.id, err.message || "Xatolik yuz berdi.");
      } catch {
        // hech narsa qilmaymiz - xato allaqachon logga yozildi
      }
      res.status(200).send("ok");
    }
  }
);

/**
 * Bir martalik sozlash - `registerTelegramWebhook`ning kuryer boti
 * uchun aynan nusxasi.
 */
async function handleRegisterCourierBotWebhook(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const adminSnap = await db.collection("admins").doc(request.auth.uid).get();
  if (!adminSnap.exists) {
    throw new HttpsError("permission-denied", "Bu amal faqat administratorlar uchun.");
  }

  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  if (!projectId) {
    throw new HttpsError("internal", "Loyiha ID'sini aniqlab bo'lmadi.");
  }
  const webhookUrl = `https://asia-south1-${projectId}.cloudfunctions.net/courierBotWebhook`;

  const res = await fetch(`https://api.telegram.org/bot${COURIER_BOT_TOKEN.value()}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: COURIER_TELEGRAM_WEBHOOK_SECRET.value(),
      // "edited_message" ro'yxatga kiritilmasa, Telegram kuryerning
      // jonli joylashuv yangilanishlarini (davriy pozitsiya
      // yangilanishlari `edited_message` sifatida keladi)
      // webhook'imizga umuman yubormaydi, jim ravishda.
      allowed_updates: ["callback_query", "message", "edited_message"],
    }),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new HttpsError("internal", `Telegram webhook o'rnatilmadi: ${data.description || "noma'lum sabab"}`);
  }
  return { ok: true, webhookUrl };
}

exports.registerCourierBotWebhook = onCall(
  { region: "asia-south1", secrets: [COURIER_BOT_TOKEN, COURIER_TELEGRAM_WEBHOOK_SECRET] },
  handleRegisterCourierBotWebhook
);

exports._testables = {
  buildCourierMenuKeyboard, parseInvitePayload, parseCourierCallbackData,
  handleStartCommand, handleMyDeliveriesButton, handleCourierTelegramMessage,
  handleRegisterCourierBotWebhook, handleCourierLiveLocationMessage, MENU_MY_DELIVERIES_TEXT,
};
