const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { admin, db } = require("./lib/admin");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * PROMOKOD SONI HISOBLAGICHI (`sellers/{id}.couponCount`) —
 * Z-Tariflar limit tekshiruvi uchun (`firestore.rules`dagi
 * `sellers/{sellerId}/coupons/{code}` yaratish qoidasi shu maydonni
 * o'qiydi).
 *
 * NEGA HISOBLAGICH KERAK: Firestore xavfsizlik qoidalari (rules)
 * kolleksiya bo'yicha "nechta hujjat bor" degan so'rovni BAJARA
 * OLMAYDI (faqat `get()` orqali BITTA hujjatni o'qiy oladi) - shuning
 * uchun soni ALOHIDA, oldindan hisoblab qo'yilgan maydonda saqlanishi
 * SHART. Promokod yaratish/o'chirish O'ZI hamon oddiy, to'g'ridan-
 * to'g'ri klient (`src/services/coupons/coupons.js`) yozuvi bo'lib
 * qoladi - bu trigger FAQAT hisoblagichni sinxronlaydi.
 *
 * ESKI (bu funksiya qurilishidan OLDIN yaratilgan) promokodlar uchun:
 * `functions/tariffs.js`dagi `backfillTariffCounters` (bir martalik,
 * `backfillSellerRollups` bilan bir xil naqsh) hisoblagichni to'g'ri
 * qiymatdan boshlaydi.
 *
 * OCHIQ QARORI: bu hisoblagich HAR QANDAY promokodni sanaydi - shu
 * jumladan tizim AVTOMATIK yaratgan mukofot kodlarini ham (referal,
 * tug'ilgan kun, savat eslatmasi, AI CEO win-back - hammasi ATAYLAB
 * YOQILGAN funksiyalar). Bu ATAYLAB shunday: "promo kod" limiti
 * do'kondagi JAMI faol kodlar sonini bildiradi, faqat qo'lda
 * yaratilganlarni EMAS - soddaroq va ADOLATLI (sotuvchi qaysi
 * avtomatik funksiyalarni yoqishini o'zi tanlaydi).
 */
async function handleCouponWrite(event) {
  const sellerId = event.params.sellerId;
  const existedBefore = event.data?.before?.exists;
  const existsAfter = event.data?.after?.exists;

  let delta = 0;
  if (!existedBefore && existsAfter) delta = 1; // yaratildi
  else if (existedBefore && !existsAfter) delta = -1; // o'chirildi
  // yangilanish (ikkalasi ham mavjud) - sonni o'zgartirmaydi.

  if (delta === 0) return;

  await db.collection("sellers").doc(sellerId).set(
    { couponCount: admin.firestore.FieldValue.increment(delta) },
    { merge: true }
  );
}

exports.onCouponWriteUpdateCount = onDocumentWritten(
  { document: "sellers/{sellerId}/coupons/{code}", region: "asia-south1", secrets: [SENTRY_DSN] },
  withSentry(handleCouponWrite)
);

exports._testables = { handleCouponWrite };
