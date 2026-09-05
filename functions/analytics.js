const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("./lib/admin");
const { checkRateLimit } = require("./lib/rateLimit");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * "Bugun"dan boshqa davrlar (Hafta/Oy) uchun HAQIQIY konversiya
 * (buyurtmalar / noyob tashriflar) ko'rsatkichini hisoblaydi.
 *
 * "Bugun" statistikasi allaqachon `verifyTelegramAuth` javobining
 * o'zida (`dashboardSummary.visitorCount`/`conversionRate`) keladi —
 * bu funksiya esa faqat sotuvchi "Hafta" yoki "Oy" tabiga
 * o'tganda, ALOHIDA chaqiriladi (chunki bu ma'lumot oldindan
 * yuklab bo'lmaydi — davr o'zgarishi mumkin).
 *
 * MUHIM: buyurtmalar soni bu yerda HISOBLANMAYDI — frontend buni
 * allaqachon (jonli, real-vaqtli) o'zining Redux keshidan biladi.
 * Bu funksiya FAQAT server tomonidagi (`visits` kolleksiyasi —
 * mijoz SDK'i uchun butunlay yopiq) tashriflar sonini qaytaradi.
 */
exports.getVisitorCount = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }

  const { sellerId, daysBack } = request.data || {};
  if (request.auth.uid !== String(sellerId)) {
    throw new HttpsError("permission-denied", "Faqat o'z do'koningizning statistikasini so'rashingiz mumkin.");
  }
  const days = Number(daysBack) > 0 ? Number(daysBack) : 1;

  // SO'ROVLARNI CHEGARALASH: sotuvchi vaqt oralig'ini juda tez-tez
  // almashtirmaydi — 5 daqiqada 30 tadan ortiq so'rovga yo'l
  // qo'yilmaydi (skript orqali suiiste'mol qilishning oldini olish).
  await checkRateLimit(`getVisitorCount:${request.auth.uid}`, 30, 300);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  const cutoffDateKey = cutoff.toISOString().slice(0, 10);

  const snap = await db.collection("visits")
    .where("sellerId", "==", sellerId)
    .where("date", ">=", cutoffDateKey)
    .count()
    .get();

  return { visitorCount: snap.data().count };
}));
