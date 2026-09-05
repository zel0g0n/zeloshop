const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin, db, STAFF_BOT_TOKEN, STAFF_TELEGRAM_WEBHOOK_SECRET } = require("./lib/admin");
const { sendTelegramMessage, answerCallbackQuery, editTelegramMessageText, buildSellerAppLink } = require("./lib/helpers");
const { applyStaffOrderAction } = require("./staff");
const { isDuplicateUpdate } = require("./lib/webhookDedup");
const { getTariffLimits } = require("./lib/tariffs");
const { normalizeStaffPermissions } = require("./lib/staffRoles");

/**
 * Xodim boti — foydalanuvchi BotFather orqali alohida yaratadigan
 * bot (`STAFF_BOT_TOKEN`), `courierBot.js` bilan AYNAN BIR XIL naqsh
 * (webhook + `X-Telegram-Bot-Api-Secret-Token` tekshiruvi + "reply
 * keyboard" menyu). Barcha sotuvchilarning barcha xodimlari SHU
 * BITTA botdan foydalanadi.
 *
 * Ikki xil tezkor amal yo'li mavjud:
 *   1) Botning o'zidagi inline tugma ("stf:confirm:<orderId>") - Mini
 *      App'ni ochmasdan, bitta bosish bilan YANGI buyurtma qabul
 *      qilinadi.
 *   2) "🧑‍💼 Ilovani ochish" tugmasi - to'liq Mini App'ni ochadi
 *      (`/staff` yo'li, `src/features/staff/*`), buyurtma/mahsulot
 *      boshqaruvi uchun (ruxsatiga qarab).
 */

const MENU_OPEN_APP_TEXT = "🧑‍💼 Ilovani ochish";

function buildStaffMenuKeyboard() {
  return { keyboard: [[{ text: MENU_OPEN_APP_TEXT }]], resize_keyboard: true };
}

async function sendStaffReply(token, chatId, text, keyboard) {
  await sendTelegramMessage(token, chatId, text, { replyMarkup: keyboard });
}

/**
 * Sof funksiya - "/start <payload>" buyrug'idagi taklif tokenidan
 * sotuvchi ID'sini (token prefiksi) o'qiydi. `staff.js`dagi
 * `handleCreateStaffInvite`ning "{sellerId}_{tasodifiy}" formati
 * bilan mos.
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
 * ("stf:confirm:abc123") ajratadi.
 */
function parseStaffCallbackData(data) {
  if (!data || typeof data !== "string") return null;
  const parts = data.split(":");
  if (parts.length < 3) return null;
  const [prefix, action, ...rest] = parts;
  const orderId = rest.join(":");
  if (prefix !== "stf" || !action || !orderId) return null;
  return { action, orderId };
}

/**
 * "/start" buyrug'i — ikkita holat: (a) xodim allaqachon ulangan -
 * shunchaki menyuni qayta ko'rsatamiz (idempotent); (b) hali
 * ulanmagan - taklif tokenini tekshirib, muvaffaqiyatli bo'lsa
 * `staff/{id}` hujjatini yaratamiz.
 *
 * MUHIM: limit (Z-Tariflarga qarab, `lib/tariffs.js`) BU YERDA, taklif
 * QABUL QILINAYOTGANDA yana bir bor (ISHONCHLI ravishda) tekshiriladi -
 * `staff.js`dagi `handleCreateStaffInvite`da tekshiruv faqat tezkor
 * UX xabari uchun, poyga holatidan (bir nechta taklif parallel
 * ishlatilishi) himoya QILMAYDI.
 */
async function handleStaffStartCommand(token, staffTgId, chatId, payload) {
  const existingSnap = await db.collection("staff").doc(staffTgId).get();
  if (existingSnap.exists) {
    const staff = existingSnap.data();
    await sendStaffReply(
      token, chatId,
      `Xush kelibsiz, ${staff.name || ""}! Quyidagi tugmadan foydalaning.`,
      buildStaffMenuKeyboard()
    );
    return;
  }

  const parsed = parseInvitePayload(payload);
  if (!parsed) {
    await sendStaffReply(
      token, chatId,
      "Assalomu alaykum! Bu bot faqat do'kon egangiz yuborgan TAKLIF HAVOLASI orqali ishlaydi. Iltimos, sotuvchingizdan havola so'rang.",
      undefined
    );
    return;
  }

  const inviteRef = db.collection("sellers").doc(parsed.sellerId).collection("staffInvites").doc(parsed.token);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists || inviteSnap.data().used) {
    await sendStaffReply(
      token, chatId,
      "Bu taklif havolasi yaroqsiz yoki allaqachon ishlatilgan. Sotuvchingizdan yangi havola so'rang.",
      undefined
    );
    return;
  }

  const sellerSnap = await db.collection("sellers").doc(parsed.sellerId).get();
  const maxStaff = getTariffLimits(sellerSnap.exists ? sellerSnap.data() : {}).maxStaff;

  const existingStaffForSellerSnap = await db.collection("staff").where("sellerId", "==", parsed.sellerId).get();
  if (existingStaffForSellerSnap.size >= maxStaff) {
    await sendStaffReply(
      token, chatId,
      `Bu do'kon uchun xodimlar soni limiti (${maxStaff} ta) allaqachon to'lgan. Sotuvchingiz bilan bog'laning.`,
      undefined
    );
    return;
  }

  const invite = inviteSnap.data();
  const storeName = sellerSnap.exists ? sellerSnap.data().storeName : null;

  await db.collection("staff").doc(staffTgId).set({
    sellerId: parsed.sellerId,
    name: invite.name,
    phone: invite.phone || null,
    status: "active",
    permissions: normalizeStaffPermissions(invite.permissions),
    // 2026-09 punkt-royxati, 2-band ("Advanced Team & RBAC") — taklif
    // yaratishda tanlangan rol YORLIG'I (masalan "marketing_manager"),
    // FAQAT ko'rsatish/UI qulayligi uchun (batafsil izoh: `lib/staffRoles.js`).
    role: invite.role || null,
    linkedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await inviteRef.update({
    used: true,
    usedAt: admin.firestore.FieldValue.serverTimestamp(),
    staffId: staffTgId,
  });

  await sendStaffReply(
    token, chatId,
    `Xush kelibsiz, ${invite.name}!${storeName ? ` Endi "${storeName}" do'koni uchun` : " Endi"} xodim sifatida ulandingiz. Quyidagi tugmadan ilovani ochishingiz mumkin.`,
    buildStaffMenuKeyboard()
  );
}

/**
 * "🧑‍💼 Ilovani ochish" tugmasi - Mini App'ning `/staff` sahifasini
 * ochadigan `web_app` tugmasi bilan xabar yuboradi.
 */
async function handleOpenAppButton(token, chatId) {
  await sendTelegramMessage(token, chatId, "Ilovani ochish uchun pastdagi tugmani bosing.", {
    inlineKeyboard: [[{ text: "🧑‍💼 Ilovani ochish", web_app: { url: buildSellerAppLink("/staff") } }]],
  });
}

async function handleStaffTelegramMessage(token, message) {
  const staffTgId = String(message?.from?.id || "");
  const chatId = message?.chat?.id;
  if (!staffTgId || !chatId) return;

  const text = (message.text || "").trim();
  if (!text) return;

  if (text === "/start" || text.startsWith("/start ")) {
    const payload = text.length > 6 ? text.slice(6).trim() : null;
    await handleStaffStartCommand(token, staffTgId, chatId, payload || null);
    return;
  }

  if (text === MENU_OPEN_APP_TEXT) {
    await handleOpenAppButton(token, chatId);
    return;
  }

  // Boshqa erkin matn - faqat allaqachon ulangan xodimlarga menyuni
  // eslatib qo'yamiz (ulanmagan begona odamlarga jim qolamiz).
  const staffSnap = await db.collection("staff").doc(staffTgId).get();
  if (staffSnap.exists) {
    await sendStaffReply(token, chatId, "Quyidagi tugmadan foydalaning.", buildStaffMenuKeyboard());
  }
}

exports.staffBotWebhook = onRequest(
  { region: "asia-south1", secrets: [STAFF_BOT_TOKEN, STAFF_TELEGRAM_WEBHOOK_SECRET] },
  async (req, res) => {
    const providedSecret = req.get("X-Telegram-Bot-Api-Secret-Token");
    if (providedSecret !== STAFF_TELEGRAM_WEBHOOK_SECRET.value()) {
      res.status(401).send("unauthorized");
      return;
    }

    // 4-BOT EKOTIZIM AUDITI (P1) — batafsil izoh: `lib/webhookDedup.js`.
    if (await isDuplicateUpdate("staff", req.body?.update_id)) {
      res.status(200).send("ok");
      return;
    }

    const token = STAFF_BOT_TOKEN.value();
    const message = req.body?.message;

    if (message) {
      try {
        await handleStaffTelegramMessage(token, message);
      } catch (err) {
        console.error("Xodim botiga xabarni qayta ishlashda xatolik:", err);
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
      const staffTgId = String(callbackQuery.from?.id || "");
      const chatId = callbackQuery.message?.chat?.id;
      const messageId = callbackQuery.message?.message_id;
      const parsed = parseStaffCallbackData(callbackQuery.data);

      if (!staffTgId || !parsed || parsed.action !== "confirm") {
        await answerCallbackQuery(token, callbackQuery.id, "Noma'lum amal.");
        res.status(200).send("ok");
        return;
      }

      const actionResult = await applyStaffOrderAction({ staffId: staffTgId, orderId: parsed.orderId });
      await answerCallbackQuery(token, callbackQuery.id, "✅ Qabul qilindi");

      if (chatId && messageId) {
        // Xom Firestore ID kesimisi o'rniga `orderNumber` (2026-09
        // punkt-royxati, 6-band) — `applyStaffOrderAction`ning o'zi
        // qaytaradi.
        await editTelegramMessageText(
          token, chatId, messageId,
          `✅ Qabul qilindi\n\nBuyurtma №${actionResult.orderNumber || "-"}.`,
          { inlineKeyboard: [] }
        );
      }
      res.status(200).send("ok");
    } catch (err) {
      console.error("Xodim botining callback_query'sida xatolik:", err);
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
 * Bir martalik sozlash - `registerCourierBotWebhook`ning xodim boti
 * uchun aynan nusxasi.
 */
async function handleRegisterStaffBotWebhook(request) {
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
  const webhookUrl = `https://asia-south1-${projectId}.cloudfunctions.net/staffBotWebhook`;

  const res = await fetch(`https://api.telegram.org/bot${STAFF_BOT_TOKEN.value()}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: STAFF_TELEGRAM_WEBHOOK_SECRET.value(),
      allowed_updates: ["callback_query", "message"],
    }),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new HttpsError("internal", `Telegram webhook o'rnatilmadi: ${data.description || "noma'lum sabab"}`);
  }
  return { ok: true, webhookUrl };
}

exports.registerStaffBotWebhook = onCall(
  { region: "asia-south1", secrets: [STAFF_BOT_TOKEN, STAFF_TELEGRAM_WEBHOOK_SECRET] },
  handleRegisterStaffBotWebhook
);

exports._testables = {
  buildStaffMenuKeyboard, parseInvitePayload, parseStaffCallbackData,
  handleStaffStartCommand, handleOpenAppButton, handleStaffTelegramMessage,
  handleRegisterStaffBotWebhook, MENU_OPEN_APP_TEXT,
};
