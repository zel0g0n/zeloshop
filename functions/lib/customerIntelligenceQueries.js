const { db } = require("./admin");

/**
 * MIJOZLAR RAZVEDKASI (Advanced Customer Intelligence, Z-Biznes,
 * 2026-09 punkt-royxati, 9-band) — Firestore'ga bog'liq YORDAMCHI
 * so'rovlar. `lib/customerIntelligence.js`dan FARQLI (u sof/hisoblash
 * funksiyalarini o'z ichiga oladi) — bu fayldagilar HAQIQIY
 * o'qishlarni bajaradi.
 *
 * IKKITA chaqiruvchi bor: `aiCeoAgent.js` (AI CEO suhbatidagi
 * `get_customer_intelligence`/`plan_ad_campaign` vositalari) VA
 * `customerIntelligence.js` (CRM Hub sahifasi to'g'ridan-to'g'ri
 * chaqiradigan `getCustomerIntelligence` onCall) — ikkalasi ham BIR
 * XIL mantiqdan foydalanishi kerak, shuning uchun BIR MARTA shu
 * yerda yozilgan.
 */

// Bitta so'rovda o'qiladigan mijoz hujjatlari xavfsizlik chegarasi -
// `execGetCustomerSegments`dagi 2026-09 audit fixi bilan BIR XIL
// g'oya (OOM/timeout xavfini yo'qotadi, juda katta mijozlar bazasida
// natija TAXMINIY - `isApproximate` bilan belgilanadi).
const CUSTOMER_SEGMENTS_SAMPLE_LIMIT = 5000;

const HIGH_INTENT_LOOKUP_LIMIT = 1000;

/**
 * "high_intent" belgisi uchun: sotuvchining FAOL (bo'sh bo'lmagan)
 * savatchasi va/yoki sevimlilar ro'yxatiga ega mijozlar to'plami.
 * Ikkala so'rov ham FAQAT `sellerId` bo'yicha TENGLIK filtri
 * ishlatadi (bitta maydonli tenglik so'rovi Firestore'da AVTOMATIK
 * indekslanadi - qo'shimcha kompozit indeks TALAB QILINMAYDI,
 * `execGetLowStockProducts` yaqinidagi 2026-09 audit eslatmasidagi
 * kabi tasdiqlanmagan kompozit indeksga tayanishdan ATAYLAB
 * qochiladi) - qolgan filtrlash (bo'sh bo'lmagan `items`, `carts`dagi
 * "active" holat) dasturiy JS kodida amalga oshiriladi.
 *
 * MUHIM: `carts`/`favorites` `firestore.rules`da SOTUVCHIGA HAM
 * yopiq (`allow read: if false` - faqat mijozning O'ZI yozadi, hech
 * kim o'qimaydi, maxfiylik uchun) - shuning uchun bu tasnif FAQAT
 * server tomonida (Admin SDK, rules'dan mustasno) hisoblanishi
 * mumkin, klient hech qachon to'g'ridan-to'g'ri o'qiy olmaydi.
 */
async function loadHighIntentClientIds(sellerId) {
  const [cartsSnap, favoritesSnap] = await Promise.all([
    db.collection("carts").where("sellerId", "==", sellerId).limit(HIGH_INTENT_LOOKUP_LIMIT).get(),
    db.collection("favorites").where("sellerId", "==", sellerId).limit(HIGH_INTENT_LOOKUP_LIMIT).get(),
  ]);
  const ids = new Set();
  cartsSnap.docs.forEach((d) => {
    const c = d.data();
    if (c.status === "active" && Array.isArray(c.items) && c.items.length > 0 && c.clientId) ids.add(c.clientId);
  });
  favoritesSnap.docs.forEach((d) => {
    const f = d.data();
    if (Array.isArray(f.items) && f.items.length > 0 && f.clientId) ids.add(f.clientId);
  });
  return ids;
}

module.exports = {
  CUSTOMER_SEGMENTS_SAMPLE_LIMIT,
  HIGH_INTENT_LOOKUP_LIMIT,
  loadHighIntentClientIds,
};
