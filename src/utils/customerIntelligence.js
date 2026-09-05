/**
 * MIJOZLAR RAZVEDKASI (Advanced Customer Intelligence, Z-Biznes,
 * 2026-09 punkt-royxati, 9-band) — `functions/lib/customerIntelligence.js`
 * bilan BIR XIL segment/belgi KALITLARI (tarjima matni EMAS — nom
 * ko'rsatish `CrmHub.jsx`da `t("customerIntelligence...")` orqali,
 * `src/utils/customerSegments.js`ning Pro-tier 4-segment naqshi bilan
 * BIR XIL uslub).
 *
 * MUHIM ARXITEKTURAVIY FARQ `customerSegments.js`dan: bu yerda
 * TASNIFLASH MANTIG'I QAYTA YOZILMAGAN (dublikat EMAS) — chunki
 * "high_intent" belgisi uchun `carts`/`favorites` kolleksiyalarini
 * o'qish kerak, ular esa `firestore.rules`da sotuvchiga HAM yopiq.
 * Shuning uchun to'liq tasnif FAQAT serverda (`getCustomerIntelligence`
 * onCall, batafsil izoh: `src/services/crm/customerIntelligence.js`)
 * hisoblanadi — bu fayldagi `filterClassifiedCustomers` esa FAQAT
 * o'sha (ALLAQACHON tasniflangan) natijani UI'da qo'shimcha
 * so'rovsiz, interaktiv filtrlash/qidirish uchun.
 */

export const PRIMARY_SEGMENT_KEYS = ["vip", "high_value", "sleeping", "churn_risk", "at_risk", "new", "returning"];
export const TAG_KEYS = ["discount_hunter", "high_intent"];

/**
 * `functions/lib/customerIntelligence.js`dagi `filterClassifiedCustomers`
 * bilan BIR XIL — `getCustomerIntelligence` onCall natijasidagi
 * (allaqachon tasniflangan) mijozlar ro'yxatini segment/belgi bo'yicha
 * filtrlaydi (UI'da qidiruv/filtr uchun, YANGI server so'rovisiz).
 *
 * @param {Array<{primarySegment:string, tags:string[]}>} classifiedCustomers
 * @param {{segment?:string, tag?:string, searchText?:string}} [options]
 */
export function filterClassifiedCustomers(classifiedCustomers, { segment, tag, searchText } = {}) {
  let list = Array.isArray(classifiedCustomers) ? classifiedCustomers : [];
  if (segment && segment !== "all") {
    list = list.filter((c) => c.primarySegment === segment);
  }
  if (tag) {
    list = list.filter((c) => Array.isArray(c.tags) && c.tags.includes(tag));
  }
  const trimmedSearch = (searchText || "").trim().toLowerCase();
  if (trimmedSearch) {
    list = list.filter((c) => (c.fullName || "").toLowerCase().includes(trimmedSearch) || (c.phone || "").includes(trimmedSearch));
  }
  return list;
}
