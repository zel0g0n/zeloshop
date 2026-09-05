const { onSchedule } = require("firebase-functions/v2/scheduler");
const { BOT_TOKEN } = require("./lib/admin");
const { sendTelegramMessage } = require("./lib/helpers");
const { getSellerCustomBotToken, sendCustomerNotification } = require("./lib/customerNotify");
const { logNotification } = require("./lib/dailyStats");
const { fetchDueRetries, recordAttemptResult } = require("./lib/notificationRetryQueue");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * 4-BOT EKOTIZIM AUDITI (P2) — `lib/notificationRetryQueue.js`ga
 * yozilgan, muvaffaqiyatsiz bo'lgan bildirishnomalarni davriy ravishda
 * QAYTA URINADI. Batafsil arxitektura izohi: `lib/notificationRetryQueue.js`.
 *
 * Har 10 daqiqada ishga tushadi — bu, navbatdagi eng qisqa backoff
 * (10 daqiqa) bilan MOS, shuning uchun birinchi qayta urinish
 * imkon qadar tezroq amalga oshadi.
 */
async function processDueRetry(doc, botToken) {
  const { kind, payload } = doc.data();

  let result;
  if (kind === "customerNotification") {
    const customBotToken = await getSellerCustomBotToken(payload.sellerId);
    result = await sendCustomerNotification(customBotToken, payload.clientId, payload.text, payload.options);
  } else if (kind === "sellerMessage") {
    result = await sendTelegramMessage(botToken, payload.chatId, payload.text, payload.options);
  } else {
    console.error(`notificationRetryWorker: noma'lum navbat turi (${kind}), hujjat o'chiriladi.`);
    await doc.ref.delete();
    return;
  }

  const { finalFailure } = await recordAttemptResult(doc, Boolean(result?.ok), result?.description || result?.error);

  if (finalFailure) {
    console.error(`notificationRetryWorker: "${kind}" turidagi bildirishnoma maksimal urinishlardan keyin ham yetkazilmadi (hujjat ${doc.id}).`);
    if (kind === "customerNotification" && payload.sellerId && payload.clientId) {
      // Mijoz ilova ichida ("Bildirishnomalar") bu yakuniy holatni
      // ko'ra olishi uchun — `logNotification` mavjud, allaqachon
      // sinalgan naqsh (`orderStatusNotify.js`dagi bilan bir xil).
      await logNotification({
        sellerId: payload.sellerId,
        clientId: payload.clientId,
        type: "retryExhausted",
        title: "Bildirishnoma yetkazilmadi",
        message: `${payload.text}\n\n[Bir necha marta qayta urinishdan keyin ham yetkazib bo'lmadi]`,
        delivered: false,
      }).catch(() => {});
    }
  }
}

exports.processNotificationRetryQueue = onSchedule(
  { schedule: "every 10 minutes", region: "asia-south1", secrets: [BOT_TOKEN, SENTRY_DSN] },
  withSentry(async () => {
    const dueDocs = await fetchDueRetries();
    if (dueDocs.length === 0) return;

    const botToken = BOT_TOKEN.value();
    let successCount = 0;
    let failureCount = 0;

    for (const doc of dueDocs) {
      try {
        await processDueRetry(doc, botToken);
        successCount += 1;
      } catch (err) {
        failureCount += 1;
        console.error(`notificationRetryWorker: hujjatni qayta ishlashda kutilmagan xatolik (${doc.id}):`, err);
      }
    }

    console.log(`processNotificationRetryQueue: ${dueDocs.length} ta hujjat ko'rib chiqildi (${successCount} muvaffaqiyatli qayta ishlandi, ${failureCount} kutilmagan xato).`);
  })
);

exports._testables = { processDueRetry };
