const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin, db, BOT_TOKEN, GEMINI_API_KEY, TELEGRAM_WEBHOOK_SECRET } = require("./lib/admin");
const { sendTelegramMessage, answerCallbackQuery, editTelegramMessageText } = require("./lib/helpers");
const { getSellerCustomBotToken, sendCustomerNotification } = require("./lib/customerNotify");
const { todayDocId, trackCrmMessageRecipients, logNotification } = require("./lib/dailyStats");
const { collectAttentionSegmentClientIds, craftCrmCampaign } = require("./aiCeo");
const { handleTelegramMessage } = require("./telegramBotMenu");
const { checkRateLimit } = require("./lib/rateLimit");
const { createPendingAction, approveAction, rejectAction } = require("./lib/aiApprovalEngine");
const { executeAdCampaign } = require("./lib/aiActionExecutors");
// 50-100+ faol sotuvchida ketma-ket ishlov berish standart 60s
// `onSchedule` timeout'idan oshib ketishi mumkin edi - batafsil
// izoh: `lib/batchProcess.js`.
const { processBatched } = require("./lib/batchProcess");
const { isDuplicateUpdate } = require("./lib/webhookDedup");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * AI CEO — 3-qism: Telegram orqali "bir tugmali tasdiqlash".
 *
 * Sotuvchi Mini App'ni ochmasdan, to'g'ridan-to'g'ri o'z Telegram
 * chatida AI CEO tayyorlagan (VIP yoki "uxlab qolgan" mijozlar uchun)
 * tayyor kampaniya matnini ko'radi va bitta tugma bosib ("✅
 * Tasdiqlash va yuborish") uni yuboradi - yoki "❌ Bekor qilish" bosib
 * rad etadi. Bu, Tier-2 ("AI tayyorlaydi, sotuvchi bir marta
 * tasdiqlaydi") darajasining Mini App'ni ochishni talab qilmaydigan
 * shakli.
 *
 * Nega `onRequest` (kodning boshqa hamma joyida faqat `onCall`
 * ishlatiladi): Telegram Bot API "webhook" mexanizmi xom HTTP
 * so'rovini talab qiladi (Firebase'ning o'z `onCall` protokolini
 * Telegram serverlari bilmaydi) - shu yagona, texnik jihatdan zaruriy
 * sabab bilan `onRequest`dan foydalanadigan yagona joy. CORS
 * xavfsizligi bu yerda tegishli emas (Telegram brauzer emas,
 * server-serverga so'rov) - o'rniga xavfsizlik boshqa yo'l bilan
 * ta'minlanadi: har bir so'rov `X-Telegram-Bot-Api-Secret-Token`
 * sarlavhasi orqali tekshiriladi (`registerTelegramWebhook` orqali
 * Telegram'ga ro'yxatdan o'tkazilgan maxfiy token bilan
 * solishtiriladi) - shu tokenni bilmagan hech kim bu manzilga soxta
 * so'rov yubora olmaydi.
 *
 * Xavfsizlik, ikkinchi qatlam (sellerId'ni ishonch bilan aniqlash):
 * Telegram callback_query'dagi `from.id` - tugmani bosgan
 * foydalanuvchining Telegram serveri tomonidan tasdiqlangan ID'si
 * (soxtalashtirib bo'lmaydi). Bizning tizimda sotuvchining o'z
 * Telegram ID'si `sellerId` bilan bir xil (butun kodning o'rnatilgan
 * konventsiyasi, `notifications.js` va boshqa joylarda ham
 * ishlatilgan) - shuning uchun `callback_query.from.id`
 * to'g'ridan-to'g'ri, qo'shimcha tekshiruvsiz, ishonchli sellerId
 * sifatida ishlatiladi.
 *
 * Nega faqat CRM segment kampaniyasi (chegirma/aksiya emas): bu
 * xavfsiz, qaytariladigan harakat turi (bitta Telegram xabari -
 * moliyaviy majburiyat yo'q), Tier-1/Tier-2 mezonlariga mos. Mahsulot
 * narxini o'zgartirish (chegirma) esa haqiqiy moliyaviy ta'sirga ega
 * va qaytarilishi aniq emas - shuning uchun bu funksiya doirasidan
 * ataylab chetlashtirilgan (Mini App ichidagi "Bugungi rejalar"
 * markazida, alohida, sotuvchi to'liq nazorat qiladigan shaklda
 * qoladi).
 *
 * Qo'shimcha cheklov: bu funksiya faqat platformaning umumiy boti
 * (`BOT_TOKEN`) orqali ishlaydi - agar sotuvchi shaxsiy bot ulagan
 * bo'lsa ham, webhook faqat bitta (umumiy) botga ro'yxatdan
 * o'tkazilgan bo'lishi mumkin (Telegram cheklovi), shuning uchun bu
 * ataylab shunday qoldirilgan.
 */

// Bitta sotuvchi uchun bir kunda yaratiladigan pending action soni
// tabiiy ravishda cheklangan (atigi 2 ta segment - vip/churn), shuning
// uchun alohida sotuvchi darajasidagi cheklov kerak emas. Umumiy
// sotuvchilar soni bo'yicha xarajat esa quyidagi ikki bosqichli filtr
// (`aiCeoEnabled` va `aiCeoTelegramApprovalEnabled`, ikkalasi ham
// standart holatda o'chiq) bilan nazorat qilinadi.
const SEGMENT_TITLES = {
  vip: "VIP mijozlar",
  churn: "uxlab qolgan mijozlar",
};

/**
 * Sof funksiya - bitta segment uchun Telegram xabari matnini va
 * inline tugmalar qatorini tuzadi. To'g'ridan-to'g'ri test qilinadi.
 */
function buildApprovalMessage({ segment, segmentCount, title, message, reasoning, dateId }) {
  const text = `🤖 *AI CEO tavsiyasi*\n\n${SEGMENT_TITLES[segment] || segment} (${segmentCount} ta) uchun tayyor kampaniya:\n\n*${title}*\n${message}${reasoning ? `\n\n_Nega bu taktika: ${reasoning}_` : ""}`;
  const inlineKeyboard = [[
    { text: "✅ Tasdiqlash va yuborish", callback_data: `a:${segment}:${dateId}` },
    { text: "❌ Bekor qilish", callback_data: `x:${segment}:${dateId}` },
  ]];
  return { text, inlineKeyboard };
}

/**
 * Bitta sotuvchi uchun: mavjud "diqqat talab qiladi" segmentlaridan
 * (VIP/uxlab qolgan) har biri uchun AI CEO orqali TAYYOR kampaniya
 * matni yaratadi, kutilayotgan harakat sifatida Firestore'ga yozadi,
 * va Telegram'ga interaktiv tugmali xabar yuboradi.
 *
 * Xarajat nazorati: ikki bosqichli filtr (aiCeoEnabled va
 * aiCeoTelegramApprovalEnabled, ikkalasi ham standart o'chiq) -
 * boshqa hamma sotuvchi uchun bu funksiya hech narsa qilmaydi va
 * hech qanday Gemini/Firestore so'rovi qilinmaydi.
 */
async function processSellerApprovalDigest(sellerDoc) {
  const seller = sellerDoc.data();
  const sellerId = sellerDoc.id;

  if (seller.aiCeoEnabled !== true) return;
  if (seller.aiCeoTelegramApprovalEnabled !== true) return;

  const customersSnap = await db.collection("sellers").doc(sellerId).collection("customers").get();
  const customers = customersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const { vipClientIds, churnClientIds } = collectAttentionSegmentClientIds(customers, Date.now());

  const dateId = todayDocId();
  const token = BOT_TOKEN.value();
  const segments = [
    { key: "vip", ids: vipClientIds },
    { key: "churn", ids: churnClientIds },
  ];

  for (const { key, ids } of segments) {
    if (ids.length === 0) continue;
    try {
      const draft = await craftCrmCampaign(key, ids.length, seller.storeName, null);

      // Rasmiy Approval Engine orqali (`lib/aiApprovalEngine.js`) -
      // sxema validatsiyasi, risk darajasi, holat mashinasi va audit
      // logi bilan, lekin XATTI-HARAKATI o'zgarmagan (har doim MEDIUM
      // xavf -> WAITING_APPROVAL -> eski `status: "pending"` maydoni
      // ham to'ldiriladi, orqaga mos).
      await createPendingAction(db, admin, {
        sellerId,
        actionType: "crmCampaign",
        payload: { segment: key, title: draft.title, message: draft.message, targetClientIds: ids, dateId },
      });

      const { text, inlineKeyboard } = buildApprovalMessage({
        segment: key, segmentCount: ids.length, title: draft.title, message: draft.message,
        reasoning: draft.reasoning, dateId,
      });
      await sendTelegramMessage(token, sellerId, text, { inlineKeyboard });
    } catch (err) {
      console.error(`AI CEO Telegram tasdiqlash xabari xatosi (sotuvchi ${sellerId}, segment ${key}):`, err);
    }
  }
}

exports.sendAiCeoApprovalDigest = onSchedule(
  {
    schedule: "30 20 * * *", timeZone: "Asia/Tashkent", region: "asia-south1", secrets: [BOT_TOKEN, GEMINI_API_KEY, SENTRY_DSN],
    // 50-100+ faol sotuvchida ketma-ket ishlov berish standart 60s
    // timeout'dan oshib ketishi mumkin edi - qo'shimcha xavfsizlik
    // zaxirasi (batafsil izoh: `lib/batchProcess.js`).
    timeoutSeconds: 300,
  },
  withSentry(async () => {
    // Xarajat nazorati (kolleksiya darajasida): faqat
    // `aiCeoEnabled == true` sotuvchilarni so'raymiz - qolganlar
    // uchun bitta hujjat ham o'qilmaydi. Ichkarida yana
    // `aiCeoTelegramApprovalEnabled` bo'yicha ikkinchi filtr bor.
    const eligibleSellersSnap = await db.collection("sellers").where("aiCeoEnabled", "==", true).get();
    if (eligibleSellersSnap.empty) return;

    // Sotuvchilar orasida umumiy o'zgaruvchan holat yo'q (har biri
    // o'z pending action'ini yozadi), shuning uchun oddiy PARALEL
    // guruhlash yetarli - alohida sotuvchi bo'yicha guruhlash shart
    // emas (solishtiring: `carts.js`dagi `sellerId` bo'yicha guruhlash).
    const result = await processBatched(eligibleSellersSnap.docs, async (sellerDoc) => {
      try {
        await processSellerApprovalDigest(sellerDoc);
      } catch (err) {
        console.error(`AI CEO Telegram tasdiqlash raqami xatosi (sotuvchi ${sellerDoc.id}):`, err);
        throw err;
      }
    });
    console.log(`sendAiCeoApprovalDigest: ${result.successCount}/${result.total} sotuvchi muvaffaqiyatli, ${result.failureCount} xato`);
  })
);

/**
 * Sof funksiya - Telegram'dan kelgan `callback_data`ni ("a:vip:2026-08-23"
 * yoki "x:churn:2026-08-23") ajratadi. Noto'g'ri formatda bo'lsa
 * `null` qaytaradi.
 */
function parseCallbackData(data) {
  if (!data || typeof data !== "string") return null;
  const parts = data.split(":");
  if (parts.length !== 3) return null;
  const [action, segment, dateId] = parts;
  if (action !== "a" && action !== "x") return null;
  if (segment !== "vip" && segment !== "churn") return null;
  return { approve: action === "a", segment, dateId, actionId: `crm_${segment}_${dateId}` };
}

/**
 * Tasdiqlangan CRM kampaniyasini yuboradi. `notifications.js`dagi
 * `handleSendCrmNotification`ning "yuborish" qismi bilan bir xil
 * mantiq, lekin mustaqil nusxa — bu yerda `targetClientIds` sotuvchi
 * ilovadan yuborgan ishonchsiz qiymat emas, balki server tomonida
 * `sellers/{id}/customers` yig'ma kolleksiyasidan hisoblangan,
 * allaqachon ishonchli ro'yxat — shuning uchun qo'shimcha "buyurtma
 * tarixida bormi" tekshiruvi bu yerda ortiqcha.
 */
async function executeCrmCampaignSend({ sellerId, targetClientIds, title, message }) {
  // Bu funksiya mijozlarga (targetClientIds) yuboradi - inline
  // tugmasiz oddiy xabar, shuning uchun yuqoridagi izohdagi "webhook
  // faqat bitta botga ro'yxatdan o'tgan" cheklovi bu yerga daxldor
  // emas (u faqat callback_query tugmali sotuvchi-digest xabariga
  // tegishli) - avval sotuvchining shaxsiy boti orqali yuboriladi,
  // platforma boti faqat zaxira (batafsil izoh: `lib/customerNotify.js`).
  const customBotToken = await getSellerCustomBotToken(sellerId);
  const text = `*${title}*\n\n${message}`;
  const results = await Promise.all(targetClientIds.map((id) => sendCustomerNotification(customBotToken, id, text)));
  const successfulIds = targetClientIds.filter((id, i) => results[i]?.ok);

  await trackCrmMessageRecipients(sellerId, successfulIds);
  await Promise.all(successfulIds.map((id) => logNotification({
    sellerId, clientId: id, type: "crmBroadcast", title, message, delivered: true,
  })));

  return { sent: successfulIds.length, total: targetClientIds.length };
}

/**
 * Bitta kutilayotgan (pending) harakatni tasdiqlash/rad etishning
 * YAGONA, umumiy mantig'i — Telegram tugmasi ORQALI (webhook) HAM,
 * Mini App'ning o'zidan (`respondToAiCeoPendingAction` onCall,
 * "Universal Inbox" MVP - ZeloShop TOP 15, #12) HAM shu funksiya
 * chaqiriladi. Ikki chaqiruvchi bir xil natijaga kelishi (masalan bir
 * xil "allaqachon hal qilingan" xatosi) shart bo'lgani uchun, mantiq
 * BIR MARTA shu yerda yozilgan.
 *
 * ENDI - rasmiy Approval Engine (`lib/aiApprovalEngine.js`) ustidan
 * YUPQA moslashtiruvchi (adapter): asosiy mantiq (holat mashinasi,
 * muddat tekshiruvi, audit logi, ijro) markazlashtirilgan, bu funksiya
 * FAQAT natijani ikkala eski chaqiruvchi kutayotgan TEKIS (flat)
 * shaklga ({executed, sent, total}) qaytaradi - orqaga mos.
 *
 * @returns {Promise<{ok: false} | {ok: true, executed: boolean, failed?: boolean, sent?: number, total?: number, error?: string, action: object}>}
 */
async function resolvePendingAction({ sellerId, actionId, approve }) {
  if (approve) {
    const result = await approveAction(db, admin, {
      sellerId,
      actionId,
      approvedBy: sellerId,
      executors: {
        // `crmCampaign` uchun ijro shu FAYLNING O'ZIDA qoladi (yuqoridagi
        // `executeCrmCampaignSend`) - keraksiz kod ko'chirish/circular
        // require'lardan qochish uchun.
        crmCampaign: (ctx) => executeCrmCampaignSend({
          sellerId: ctx.sellerId,
          targetClientIds: ctx.actionDoc.targetClientIds || [],
          title: ctx.actionDoc.title,
          message: ctx.actionDoc.message,
        }),
        // `adCampaign` - YANGI turi, ijrosi `lib/aiActionExecutors.js`da
        // (haqiqiy promokod + CRM broadcast).
        adCampaign: (ctx) => executeAdCampaign({ sellerId: ctx.sellerId, payload: ctx.actionDoc }),
      },
    });
    if (!result.ok) return { ok: false };
    if (result.failed) {
      return { ok: true, executed: false, failed: true, action: result.action, error: result.error };
    }
    return { ok: true, executed: true, sent: result.result?.sent, total: result.result?.total, action: result.action };
  }

  const result = await rejectAction(db, admin, { sellerId, actionId, rejectedBy: sellerId });
  if (!result.ok) return { ok: false };
  return { ok: true, executed: false, action: result.action };
}

/**
 * Telegram webhook — ikki turdagi yangilanishni qabul qiladi:
 * `callback_query` (inline tugma bosilishi - CRM tasdiqlash oqimi)
 * va `message` (oddiy xabar/rasm - bot "menyu" tugmalari va rasm
 * yig'ish oqimi, `telegramBotMenu.js`ga delegatsiya qilinadi). Boshqa
 * barcha yangilanish turlari e'tiborsiz qoldiriladi (200 bilan, chunki
 * Telegram muvaffaqiyatsiz javobni qayta-qayta urinishga harakat
 * qiladi — buni oldini olish uchun har doim 200 qaytaramiz).
 *
 * `message` turining kelishi uchun, webhook `allowed_updates`ga
 * "message" qo'shilgan holda ro'yxatdan o'tkazilgan bo'lishi kerak
 * (`registerTelegramWebhook` - eski, "message"siz ro'yxatga olingan
 * webhook'lar uchun Telegram bu yangilanish turini umuman
 * yubormaydi).
 */
exports.telegramCallbackWebhook = onRequest(
  { region: "asia-south1", secrets: [BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, GEMINI_API_KEY] },
  async (req, res) => {
    // Xavfsizlik: bu yagona `onRequest` (kodning qolgan qismi faqat
    // `onCall` ishlatadi) — shuning uchun manba tekshiruvi shu yerda,
    // qo'lda amalga oshirilishi shart.
    const providedSecret = req.get("X-Telegram-Bot-Api-Secret-Token");
    if (providedSecret !== TELEGRAM_WEBHOOK_SECRET.value()) {
      res.status(401).send("unauthorized");
      return;
    }

    // 4-BOT EKOTIZIM AUDITI (P1) — Telegram BIR XIL yangilanishni
    // (tarmoq muammosi tufayli) qayta yuborishi mumkin; batafsil izoh:
    // `lib/webhookDedup.js`. Dublikat bo'lsa, hech narsa qayta
    // ishlanmasdan darhol 200 qaytariladi.
    if (await isDuplicateUpdate("main", req.body?.update_id)) {
      res.status(200).send("ok");
      return;
    }

    const message = req.body?.message;
    if (message) {
      try {
        await handleTelegramMessage(BOT_TOKEN.value(), message);
      } catch (err) {
        console.error("Telegram xabarini (bot menyusi) qayta ishlashda xatolik:", err);
      }
      res.status(200).send("ok");
      return;
    }

    const callbackQuery = req.body?.callback_query;
    if (!callbackQuery) {
      // Boshqa yangilanish turi - e'tiborsiz qoldiramiz, lekin
      // Telegram qayta urinmasligi uchun 200.
      res.status(200).send("ok");
      return;
    }

    try {
      const sellerId = String(callbackQuery.from?.id || "");
      const chatId = callbackQuery.message?.chat?.id;
      const messageId = callbackQuery.message?.message_id;
      const parsed = parseCallbackData(callbackQuery.data);
      const token = BOT_TOKEN.value();

      if (!sellerId || !parsed) {
        await answerCallbackQuery(token, callbackQuery.id, "Noma'lum amal.");
        res.status(200).send("ok");
        return;
      }

      const result = await resolvePendingAction({ sellerId, actionId: parsed.actionId, approve: parsed.approve });

      if (!result.ok) {
        await answerCallbackQuery(token, callbackQuery.id, "Bu tavsiya endi amal qilmaydi.");
        res.status(200).send("ok");
        return;
      }

      const { action } = result;
      if (result.executed) {
        await answerCallbackQuery(token, callbackQuery.id, `✅ Yuborildi: ${result.sent}/${result.total}`);
        if (chatId && messageId) {
          await editTelegramMessageText(token, chatId, messageId, `✅ *Yuborildi* — ${result.sent}/${result.total} ta mijozga\n\n*${action.title}*\n${action.message}`);
        }
      } else if (result.failed) {
        // YANGI: haqiqiy ijro xatosi (masalan promokod yaratib
        // bo'lmadi) - sotuvchi rad etganidan (`❌ Bekor qilindi`) ANIQ
        // farqlanishi kerak, aks holda sotuvchi buni o'zi bekor qilgan
        // deb noto'g'ri tushunadi.
        await answerCallbackQuery(token, callbackQuery.id, "⚠️ Ijro xatosi yuz berdi. Keyinroq qayta urinib ko'ring.");
        if (chatId && messageId) {
          await editTelegramMessageText(token, chatId, messageId, `⚠️ *Ijro xatosi*\n\n*${action.title}*\n${action.message}`);
        }
      } else {
        await answerCallbackQuery(token, callbackQuery.id, "❌ Bekor qilindi.");
        if (chatId && messageId) {
          await editTelegramMessageText(token, chatId, messageId, `❌ *Bekor qilindi*\n\n*${action.title}*\n${action.message}`);
        }
      }

      res.status(200).send("ok");
    } catch (err) {
      console.error("Telegram callback_query qayta ishlashda xatolik:", err);
      // Xato bo'lsa ham 200 qaytaramiz - Telegram'ning cheksiz qayta
      // urinishiga yo'l qo'ymaslik uchun (xato allaqachon logga
      // yozildi, keyinroq diagnostika qilinadi).
      res.status(200).send("ok");
    }
  }
);

/**
 * Bir martalik sozlash: Telegram'ga "har bir inline tugma bosilganda,
 * shu manzilga xabar yubor" deb aytadigan `setWebhook` chaqiruvi.
 * Faqat platforma administratorlari chaqira oladi (`admins`
 * kolleksiyasi orqali tekshiriladi, xuddi `contactAdmin`dagi kabi
 * naqsh). Deploy qilingandan keyin bir marta chaqirilishi kerak
 * (funksiya URL manzili faqat deploy qilingandan keyin ma'lum
 * bo'lgani uchun, bu ishni deploy vaqtida avtomatik qilib bo'lmaydi).
 */
async function handleRegisterTelegramWebhook(request) {
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
  const webhookUrl = `https://asia-south1-${projectId}.cloudfunctions.net/telegramCallbackWebhook`;

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN.value()}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: TELEGRAM_WEBHOOK_SECRET.value(),
      // "message" turi shu ro'yxatda bo'lishi kerak - bot "menyu"
      // tugmalari (`telegramBotMenu.js`) va rasm yig'ish oqimi
      // ishlashi uchun, Telegram oddiy xabar/rasm yangilanishlarini
      // ham webhook'ga yuborishi shart. Bu funksiya avval
      // "message"siz chaqirilgan bo'lsa, qayta chaqirilishi kerak
      // (eski ro'yxatga olish "message" turini butunlay tashlab
      // yuborardi).
      allowed_updates: ["callback_query", "message"],
    }),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new HttpsError("internal", `Telegram webhook o'rnatilmadi: ${data.description || "noma'lum sabab"}`);
  }
  return { ok: true, webhookUrl };
}

exports.registerTelegramWebhook = onCall(
  { region: "asia-south1", secrets: [BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, SENTRY_DSN] },
  withSentry(handleRegisterTelegramWebhook)
);

/**
 * SOTUVCHI — Mini App'ning o'zidan (Telegram bot xabaridagi tugmasiz)
 * kutilayotgan AI CEO harakatini tasdiqlaydi yoki rad etadi.
 *
 * "Universal Inbox" MVP (ZeloShop TOP 15, #12) — OLDIN bu harakatlar
 * FAQAT Telegram botning o'zida ko'rinar va hal qilinardi (sotuvchi
 * Mini App'ni umuman ochmasa ham); endi BIR XIL ma'lumot
 * (`sellers/{id}/aiCeoPendingActions`) Mini App ichidagi birlashtirilgan
 * bildirishnomalar oqimida ham ko'rinadi va shu yerdan ham hal
 * qilinishi mumkin — ikkalasi ham BIR XIL `resolvePendingAction`
 * mantig'idan foydalanadi, shuning uchun ikki yo'l orasida hech qanday
 * xatti-harakat farqi yo'q.
 */
async function handleRespondToAiCeoPendingAction(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Bu funksiyani ishlatish uchun tizimga kirgan bo'lishingiz kerak.");
  }
  const sellerId = request.auth.uid;
  await checkRateLimit(`respondToAiCeoPendingAction:${sellerId}`, 30, 3600);

  const { actionId, approve } = request.data || {};
  if (!actionId || typeof actionId !== "string" || typeof approve !== "boolean") {
    throw new HttpsError("invalid-argument", "actionId va approve (true/false) ko'rsatilishi shart.");
  }

  const result = await resolvePendingAction({ sellerId, actionId, approve });
  if (!result.ok) {
    throw new HttpsError("failed-precondition", "Bu tavsiya endi amal qilmaydi (avval hal qilingan yoki topilmadi).");
  }
  return { executed: result.executed, sent: result.sent, total: result.total, failed: result.failed, error: result.error };
}

exports.respondToAiCeoPendingAction = onCall(
  { region: "asia-south1", secrets: [BOT_TOKEN, SENTRY_DSN] },
  withSentry(handleRespondToAiCeoPendingAction)
);

exports._testables = {
  buildApprovalMessage, processSellerApprovalDigest, parseCallbackData,
  executeCrmCampaignSend, handleRegisterTelegramWebhook, resolvePendingAction,
  handleRespondToAiCeoPendingAction,
};
