/**
 * 15-NICHE UNIVERSAL PLATFORMA — SOTUVCHI SOHASINI (NICHE) TEKSHIRISH
 * VA XAVFSIZ ZAXIRA (BACKFILL) MIGRATSIYASI.
 *
 * NIMA UCHUN KERAK: platforma hozirgacha FAQAT "Kosmetika" sohasi bilan
 * ishlagan (`CreateStoreScreen.jsx`dagi eski `FIXED_NICHE` — endi
 * olib tashlandi), shuning uchun AMALDA barcha mavjud sotuvchilar
 * `sellers/{id}.category === "Kosmetika"` qiymatiga ega — hech qanday
 * haqiqiy migratsiya zarurati YO'Q. LEKIN, ehtiyot chorasi sifatida
 * (masalan, eski/buzilgan hujjat, qo'lda Firestore'ga to'g'ridan-to'g'ri
 * yozilgan test ma'lumoti va h.k.), bu funksiya:
 *   1) `category` maydoni UMUMAN yo'q yoki bo'sh bo'lgan sotuvchilarga
 *      xavfsiz standart ("Kosmetika") qiymatini yozadi;
 *   2) `category` mavjud, lekin 15 ta niche ro'yxatidan (+ "Boshqa")
 *      TASHQARIDA bo'lgan sotuvchilarga ham xuddi shu standart
 *      qiymatni yozadi (masalan eski, endi olib tashlangan "Gullar"
 *      kabi qiymatlar — ular hech qachon ishlatilmagan edi, lekin
 *      nazariy ehtimolga qarshi himoya).
 *
 * IDEMPOTENT: allaqachon to'g'ri (15 talikdan biri yoki "Boshqa")
 * qiymatga ega sotuvchilar UMUMAN o'zgartirilmaydi — funksiyani
 * necha marta ishga tushirish ham xavfsiz, natija bir xil bo'ladi.
 *
 * Faqat administrator ishga tushirishi mumkin (`adminSellerManagement.js`
 * bilan bir xil `admins/{uid}` tekshiruvi).
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin, db } = require("./lib/admin");
const { processBatched } = require("./lib/batchProcess");
const { NICHE_IDS, OTHER_NICHE } = require("./lib/niches");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

const DEFAULT_NICHE = "Kosmetika";
const VALID_NICHE_IDS = new Set([...NICHE_IDS, OTHER_NICHE.id]);

/** Sof funksiya: bitta sotuvchi hujjati uchun to'g'irlanishi kerakmi va nimaga - hisoblaydi. Testlanadigan qism. */
function resolveNicheBackfill(sellerData) {
  const current = sellerData?.category;
  if (typeof current === "string" && VALID_NICHE_IDS.has(current)) {
    return null; // allaqachon to'g'ri - hech narsa qilinmaydi
  }
  return DEFAULT_NICHE;
}

async function handleBackfillSellerNiches(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const adminSnap = await db.collection("admins").doc(request.auth.uid).get();
  if (!adminSnap.exists) {
    throw new HttpsError("permission-denied", "Bu amal faqat administratorlar uchun.");
  }

  const sellersSnap = await db.collection("sellers").get();
  const toFix = [];
  sellersSnap.forEach((doc) => {
    const fixedValue = resolveNicheBackfill(doc.data());
    if (fixedValue) toFix.push({ ref: doc.ref, value: fixedValue });
  });

  const result = await processBatched(toFix, async (item) => {
    await item.ref.set(
      { category: item.value, categoryBackfilledAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
  });

  return {
    totalSellers: sellersSnap.size,
    fixedCount: result.successCount,
    failedCount: result.failureCount,
  };
}

exports.backfillSellerNiches = onCall({ region: "asia-south1", timeoutSeconds: 300, secrets: [SENTRY_DSN] }, withSentry(handleBackfillSellerNiches));

exports._testables = { resolveNicheBackfill, handleBackfillSellerNiches, DEFAULT_NICHE, VALID_NICHE_IDS };
