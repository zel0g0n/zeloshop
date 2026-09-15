/**
 * Kategoriya asosida "o'rtacha iste'mol/tugash muddati" (kun
 * hisobida) - "qayta xarid eslatmasi"ni QACHON yuborish kerakligini
 * belgilash uchun (`engagementReminders.js`dagi `sendRepurchaseReminders`).
 *
 * MUHIM TARIX: OLDIN bu eslatma HAR QANDAY yetkazilgan buyurtma uchun,
 * mahsulot turidan qat'i nazar, qat'iy 30 kundan keyin yuborilardi.
 * Bu NOTO'G'RI edi - platforma endi ko'p sohali (kiyim, poyabzal,
 * mebel va h.k.), va "30 kundan keyin qayta buyurtma bering" degan
 * taklif KURTKA yoki DIVAN sotib olgan xaridor uchun ma'nosiz va
 * bezovta qiluvchi (shu narsa, taxminan, past konversiya darajasining
 * bir sababi bo'lishi mumkin - aholi bir xilda "tegishsiz" xabar
 * olayotgan xaridorlar hisobiga umumiy statistika pasayadi).
 *
 * HALOLLIK: quyidagi kunlar HAR BIR SOTUVCHI/MAHSULOT uchun
 * o'lchangan HAQIQIY ZeloShop ma'lumoti EMAS - bular kosmetika/shaxsiy
 * parvarish mahsulotlari uchun keng qo'llaniladigan, sanoatda
 * takrorlanadigan SOHA O'RTACHA TAXMINLARI (masalan yuz kremi ~1 oyda,
 * shampun ~1.5 oyda tugaydi - ishlab chiqaruvchilar/chakana savdo
 * qo'llanmalarida odatiy uchraydigan oraliqlar). Bular VAQTINCHA
 * "urug'lik" (seed) qiymatlar - strategiya hujjatida (`ZELOSHOP_
 * STRATEGY.md`, 2.3-band) reja qilinganidek, KEYINGI qadam - real
 * qayta xarid oralig'ini HAR BIR SOTUVCHI/KATEGORIYA uchun haqiqiy
 * buyurtmalar tarixidan hisoblab, shu statik jadvalni avtomatik
 * moslashtiruvchi tizimga aylantirish (`functions/productRecommendations.
 * js`dagi "birga sotib olinadi" tizimi HAQIQIY ma'lumotga qanday
 * o'tgan bo'lsa, xuddi shunday).
 *
 * ATAYLAB FAQAT quyidagi, aniq ishonch bilan "muntazam
 * iste'mol qilinadigan/tugaydigan" deb aytish mumkin bo'lgan
 * kategoriyalar kiritilgan (`src/config/niches.js`dagi "Kosmetika"
 * nishasi kategoriyalari bilan AYNAN BIR XIL nom). Kiyim, poyabzal,
 * mebel, zargarlik, elektronika va shunga o'xshash UZOQ MUDDATLI/
 * bir martalik mahsulotlar ATAYLAB KIRITILMAGAN - `pickEffectiveCycleDays`
 * bunday mahsulotlar uchun `null` qaytaradi, va chaqiruvchi kod bu
 * holatda HECH QANDAY eslatma yubormaydi (uydirma/mos kelmaydigan
 * muddat ko'rsatishdan ko'ra, umuman yubormaslik afzal).
 */
const REPLENISHMENT_CYCLE_DAYS_BY_CATEGORY = {
  "Shaxsiy gigiena": 20,
  "Yuz parvarishi": 30,
  "Erkaklar uchun": 35,
  "Soch parvarishi": 45,
  "Tana parvarishi": 45,
  "Dekorativ kosmetika": 60,
  "Quyoshdan himoya": 60,
  "Parfyumeriya": 90,
};

/**
 * @param {string|null|undefined} category
 * @returns {number|null}
 */
function getReplenishmentCycleDays(category) {
  if (!category) return null;
  return REPLENISHMENT_CYCLE_DAYS_BY_CATEGORY[category] ?? null;
}

/**
 * Bitta buyurtma bir nechta, TURLI kategoriyadagi mahsulotdan
 * iborat bo'lishi mumkin - ENG QISQA (ya'ni birinchi tugaydigan)
 * muddatni tanlaymiz: xaridorga hech bo'lmasa BITTA mahsuloti
 * haqiqatan tugab qolgan taxminiy vaqtda eslatma borishi, uni juda
 * kech (barcha mahsulot tugaguncha kutib) yuborishdan afzal.
 *
 * @param {Array<string|null|undefined>} categories
 * @returns {number|null} - hech qaysi kategoriya tanish bo'lmasa `null`
 */
function pickEffectiveCycleDays(categories) {
  const known = (categories || [])
    .map((c) => getReplenishmentCycleDays(c))
    .filter((d) => d !== null);
  if (known.length === 0) return null;
  return Math.min(...known);
}

const CYCLE_VALUES = Object.values(REPLENISHMENT_CYCLE_DAYS_BY_CATEGORY);
const MIN_CYCLE_DAYS = Math.min(...CYCLE_VALUES);
const MAX_CYCLE_DAYS = Math.max(...CYCLE_VALUES);

module.exports = {
  REPLENISHMENT_CYCLE_DAYS_BY_CATEGORY,
  getReplenishmentCycleDays,
  pickEffectiveCycleDays,
  MIN_CYCLE_DAYS,
  MAX_CYCLE_DAYS,
};
