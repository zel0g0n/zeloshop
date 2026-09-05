const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("./lib/admin");
const { checkRateLimit } = require("./lib/rateLimit");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * Checkout paytida mijozga sotuvchining SHAXSIY kartasi (karta raqami
 * + F.I.SH) ko'rsatilishi kerak — "Karta orqali to'lash" tanlanganda
 * (2026-09 punkt-royxati, 14-band). Bu ma'lumot `sellers/{id}/private/
 * paymentConfig`da saqlanadi (`PaymentSettingsPage.jsx`, "Jismoniy
 * shaxs" tabi) — shu hujjatning QOLGAN qismi (Click/Payme SECRET
 * kalitlari) hech qachon ochilmasligi kerak, shuning uchun BUTUN
 * hujjatni emas, faqat shu ikki maydonni qaytaruvchi ALOHIDA, tor
 * doiradagi onCall funksiya sifatida qilingan.
 *
 * XAVFSIZLIK (2026-09 audit, P1): bu funksiya checkout SAHIFASIDA,
 * hali buyurtma yaratilmasdan turib chaqiriladi (`Checkout.jsx`) —
 * shuning uchun "avval shu sotuvchidan buyurtma bo'lgan bo'lishi
 * kerak" degan cheklov haqiqiy, qonuniy foydalanishni buzadi (har bir
 * mijoz o'zi ilk marta xarid qilayotgan do'kondan ham karta ma'lumotini
 * ko'rishi shart). Lekin `sellers/{id}` hujjati OMMAVIY o'qiladigan
 * bo'lgani uchun (`firestore.rules`), sellerId'lar oson sanaladi — bu
 * cheklovsiz holda istalgan tizimga kirgan foydalanuvchi barcha
 * sotuvchilarning shaxsiy karta raqami + F.I.SH'ini OMMAVIY yig'ib
 * olishi (PII/moliyaviy ma'lumot "harvesting") mumkin edi. Shuning
 * uchun — biznes oqimni buzmaydigan, lekin ommaviy yig'ishni SEKINLASH-
 * TIRADIGAN himoya sifatida — chaqiruvchi FOYDALANUVCHI bo'yicha (aniq
 * sellerId bo'yicha EMAS — aks holda sellerId'ni almashtirib chegarani
 * aylanib o'tish mumkin bo'lardi) qat'iy rate-limit qo'yildi.
 */
async function handleGetSellerPaymentCardInfo(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  await checkRateLimit(`getSellerPaymentCardInfo:${request.auth.uid}`, 15, 600);

  const { sellerId } = request.data || {};
  if (!sellerId) {
    throw new HttpsError("invalid-argument", "Sotuvchi ko'rsatilmagan.");
  }

  const configSnap = await db.collection("sellers").doc(String(sellerId))
    .collection("private").doc("paymentConfig").get();

  if (!configSnap.exists) {
    throw new HttpsError("not-found", "Bu do'kon uchun karta orqali to'lov sozlanmagan.");
  }
  const config = configSnap.data();
  if (!config.individualPaymentEnabled || !config.individualCardNumber || !config.individualCardHolderName) {
    throw new HttpsError("not-found", "Bu do'kon uchun karta orqali to'lov sozlanmagan.");
  }

  return {
    cardNumber: config.individualCardNumber,
    cardHolderName: config.individualCardHolderName,
  };
}

exports.getSellerPaymentCardInfo = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleGetSellerPaymentCardInfo));
exports._testables = { handleGetSellerPaymentCardInfo };
