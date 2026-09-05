const { HttpsError } = require("firebase-functions/v2/https");
const { db } = require("./admin");

/**
 * Oddiy, Firestore asosidagi so'rov chegaralash (rate limiting).
 *
 * Cloud Functions'ning o'zida tayyor rate-limiting vositasi yo'q —
 * shuning uchun buni o'zimiz, qayta ishlatiladigan tarzda quramiz.
 * Har bir chaqiruv, `rateLimits/{key}` hujjatida sanoqni Firestore
 * TRANSACTION ichida oshiradi — bu, ikkita so'rov BIR VAQTDA kelib,
 * ikkalasi ham "hali chegaradan o'tmagan" deb noto'g'ri xulosaga
 * kelishining oldini oladi.
 *
 * @param {string} key - noyob chegaralash kaliti, masalan
 *   `createOrder:${uid}` — turli funksiyalar/foydalanuvchilar uchun
 *   ALOHIDA sanoq yuritilishi uchun, funksiya nomini ID bilan
 *   birlashtirib bering.
 * @param {number} maxRequests - shu oyna ichida ruxsat etilgan
 *   maksimal so'rovlar soni.
 * @param {number} windowSeconds - oyna uzunligi (soniyalarda).
 * @throws {HttpsError} "resource-exhausted" — chegaradan oshsa.
 */
async function checkRateLimit(key, maxRequests, windowSeconds) {
  const ref = db.collection("rateLimits").doc(key);
  const now = Date.now();

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const data = snap.exists ? snap.data() : null;

    // Oyna hali tugamagan bo'lsa — mavjud sanoqni tekshiramiz.
    if (data && now - data.windowStart < windowSeconds * 1000) {
      if (data.count >= maxRequests) {
        // MUHIM: xato xabari umumiy — qancha vaqtdan keyin qayta
        // urinish mumkinligini aniq aytamiz, lekin ICHKI tafsilotlar
        // (masalan aniq chegara qiymati) oshkor qilinmaydi.
        const retryAfterSeconds = Math.ceil((data.windowStart + windowSeconds * 1000 - now) / 1000);
        throw new HttpsError(
          "resource-exhausted",
          `Juda ko'p so'rov yubordingiz. Iltimos, ${retryAfterSeconds} soniyadan so'ng qayta urinib ko'ring.`
        );
      }
      transaction.set(ref, { windowStart: data.windowStart, count: data.count + 1 });
    } else {
      // Oyna tugagan (yoki hali mavjud emas) — yangi oyna boshlanadi.
      transaction.set(ref, { windowStart: now, count: 1 });
    }
  });
}

module.exports = { checkRateLimit };
