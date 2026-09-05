const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("./lib/admin");
const { checkRateLimit } = require("./lib/rateLimit");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");
const { getEffectiveTariffPlan } = require("./lib/tariffs");
const { classifyCustomerIntelligence } = require("./lib/customerIntelligence");
const { CUSTOMER_SEGMENTS_SAMPLE_LIMIT, loadHighIntentClientIds } = require("./lib/customerIntelligenceQueries");

/**
 * MIJOZLAR RAZVEDKASI — CRM Hub sahifasi uchun onCall (Z-Biznes,
 * 2026-09 punkt-royxati, 9-band). `aiCeoAgent.js`dagi
 * `execGetCustomerIntelligence` AI CEO suhbati ICHIDA (Gemini
 * tool-calling orqali) chaqiriladigan "vosita" bo'lsa, bu funksiya
 * esa CRM Hub sahifasi TO'G'RIDAN-TO'G'RI chaqiradigan, mustaqil
 * onCall — ikkalasi ham BIR XIL `classifyCustomerIntelligence`/
 * `loadHighIntentClientIds`dan foydalanadi (tasniflash mantig'i ikki
 * marta yozilmagan).
 *
 * NEGA onCall (klient sahifasi `sellers/{id}/customers`ni to'g'ridan-
 * to'g'ri o'qigani kabi, `carts`/`favorites`ni to'g'ridan-to'g'ri
 * o'QIY OLMAYDI): "high_intent" belgisi uchun shu ikkala kolleksiyani
 * o'qish kerak — ular `firestore.rules`da SOTUVCHIGA HAM yopiq
 * (`allow read: if false` — faqat mijozning O'ZI yozadi, hech kim
 * o'qimaydi, maxfiylik uchun ATAYLAB shunday). Shuning uchun bu
 * to'liq tasnif FAQAT server tomonida (Admin SDK, xavfsizlik
 * qoidalaridan MUSTASNO) hisoblanishi mumkin.
 */
async function handleGetCustomerIntelligence(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Bu funksiyani ishlatish uchun tizimga kirgan bo'lishingiz kerak.");
  }
  const sellerId = request.auth.uid;
  await checkRateLimit(`getCustomerIntelligence:${sellerId}`, 30, 3600);

  const sellerSnap = await db.collection("sellers").doc(sellerId).get();
  if (!sellerSnap.exists || getEffectiveTariffPlan(sellerSnap.data()) !== "biznes") {
    throw new HttpsError("permission-denied", "Bu funksiya faqat Z-Biznes tarifidagi sotuvchilar uchun mavjud.");
  }

  const [customersSnap, highIntentClientIds] = await Promise.all([
    db.collection("sellers").doc(sellerId).collection("customers").limit(CUSTOMER_SEGMENTS_SAMPLE_LIMIT).get(),
    loadHighIntentClientIds(sellerId),
  ]);

  const { customers, counts, tagCounts } = classifyCustomerIntelligence(
    customersSnap.docs.map((d) => d.data()),
    { highIntentClientIds }
  );

  return {
    customers,
    counts,
    tagCounts,
    isApproximate: customersSnap.size >= CUSTOMER_SEGMENTS_SAMPLE_LIMIT,
  };
}

exports.getCustomerIntelligence = onCall(
  { region: "asia-south1", secrets: [SENTRY_DSN], timeoutSeconds: 60 },
  withSentry(handleGetCustomerIntelligence)
);

exports._testables = { handleGetCustomerIntelligence };
