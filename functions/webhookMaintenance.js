const { onSchedule } = require("firebase-functions/v2/scheduler");
const { db } = require("./lib/admin");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * 4-BOT EKOTIZIM AUDITI (P2 — "processedTelegramUpdates uchun TTL
 * siyosati yo'q"): `lib/webhookDedup.js` har bir kiruvchi Telegram
 * yangilanishi (`update_id`) uchun bitta, arzon, bitta-maydonli hujjat
 * yozadi — bu hujjatlar hech qachon o'zidan-o'zi o'chirilmaydi, vaqt
 * o'tishi bilan cheksiz to'planadi (Firestore hajmi/xarajati asta-sekin
 * o'sadi, garchi har biri juda arzon bo'lsa ham).
 *
 * Bu funksiya har kuni bir marta ishga tushib, 7 kundan ESKI
 * hujjatlarni o'chiradi — 7 kun, Telegram'ning haqiqiy qayta-yetkazish
 * oynasidan (odatda daqiqalar, ba'zan soatlar) ANCHA katta xavfsizlik
 * zaxirasi bilan.
 *
 * Bir vaqtda ko'pi bilan 500 tasini o'chiradi (Firestore BATCH
 * chegarasi) — agar 500 tadan ko'p eskirgan hujjat bo'lsa, ertangi
 * ishga tushishda qolganlari o'chiriladi (bu funksiya HAR KUNI
 * ishlaydi, shuning uchun bir necha kun ichida baribir hammasi
 * tozalanadi — darhol tugatish shart emas).
 */
async function cleanupCollection(collectionName, olderThanMs) {
  const cutoff = Date.now() - olderThanMs;
  const snap = await db.collection(collectionName)
    .where("processedAt", "<", cutoff)
    .limit(500)
    .get();

  if (snap.empty) return 0;

  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return snap.size;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
// `telegramAuth.js`dagi replay-himoya hujjatlari (`telegramAuthReplayGuard`)
// uchun — eng uzoq `maxAgeSeconds` (24 soat, `auth.js`da ishlatiladigan
// standart) dan ANCHA katta zaxira bilan, 2 kun. Bu maydon nomi ATAYLAB
// `processedAt` (yuqoridagi `processedTelegramUpdates` bilan BIR XIL) -
// shu orqali umumiy `cleanupCollection`ni o'zgartirmasdan qayta
// ishlatish mumkin.
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

exports.cleanupProcessedTelegramUpdates = onSchedule(
  { schedule: "0 4 * * *", timeZone: "Asia/Tashkent", region: "asia-south1", secrets: [SENTRY_DSN] },
  withSentry(async () => {
    try {
      const deletedCount = await cleanupCollection("processedTelegramUpdates", SEVEN_DAYS_MS);
      console.log(`cleanupProcessedTelegramUpdates: ${deletedCount} ta eskirgan hujjat o'chirildi.`);
    } catch (err) {
      console.error("cleanupProcessedTelegramUpdates: tozalashda xatolik:", err);
    }
  })
);

// 2026-09 audit (P2 — Telegram initData replay himoyasi, `telegramAuth.js`ga
// qarang): replay-guard hujjatlari ham, xuddi webhook dedup hujjatlari
// kabi, o'zidan-o'zi o'chmaydi — shu sababli bu yerga alohida, lekin
// bir xil umumiy tozalash mexanizmidan foydalanadigan kunlik vazifa
// qo'shildi.
exports.cleanupTelegramAuthReplayGuard = onSchedule(
  { schedule: "30 4 * * *", timeZone: "Asia/Tashkent", region: "asia-south1", secrets: [SENTRY_DSN] },
  withSentry(async () => {
    try {
      const deletedCount = await cleanupCollection("telegramAuthReplayGuard", TWO_DAYS_MS);
      console.log(`cleanupTelegramAuthReplayGuard: ${deletedCount} ta eskirgan hujjat o'chirildi.`);
    } catch (err) {
      console.error("cleanupTelegramAuthReplayGuard: tozalashda xatolik:", err);
    }
  })
);

exports._testables = { cleanupCollection };
