/**
 * SOTUVCHI DARAJASIDAGI KATEGORIYA MOSLASHTIRISH — BACKEND (AI)
 * TOMONI.
 *
 * `src/config/categoryCustomization.js` (frontend, ko'rsatish uchun
 * {value,label}[] ishlab chiqaradi) bilan MA'NOAN BOG'LIQ, lekin
 * JISMONIY ravishda ALOHIDA saqlanadi (sabab — `lib/niches.js`dagi
 * izohda tushuntirilgan: frontend/backend alohida deploy qilinadigan
 * paketlar).
 *
 * BU YERDAGI MAQSAD FARQLI: AI qoralama promptiga (`productDrafts.js`)
 * YUBORILADIGAN kategoriya NOMLARI ro'yxatini tuzish. Shu sababli
 * faqat IKKITA narsa muhim:
 *   1) Sotuvchi YASHIRGAN kategoriyani AI HECH QACHON taklif qilmasin
 *      (aks holda sotuvchi "kerak emas" deb yashirgan kategoriyani AI
 *      qoralamada qayta-qayta taklif qilaveradi).
 *   2) Sotuvchi QO'SHGAN maxsus (custom) kategoriya/subkategoriya
 *      (masalan "Luxury Skincare") AI'GA MA'LUM bo'lsin - AI uni ham
 *      mos kelganda taklif qila olsin (foydalanuvchi ANIQ so'ragan
 *      "AI'ni sotuvchi yaratgan custom kategoriyalardan xabardor
 *      qilish" talabi).
 * "Rename" (ko'rsatiladigan nomni o'zgartirish) bu yerga TA'SIR
 * QILMAYDI - `product.category`da HAR DOIM asl `value` saqlanadi, AI
 * taklifi ham shu asl qiymatlar orasidan bo'ladi (aiCategory - baribir
 * FAQAT tavsiya, yakuniy tanlov sharhlash ekranida sotuvchining o'zi
 * tomonidan qilinadi - `productDrafts.js`dagi izohga qarang).
 */

/**
 * @param {string[]} baseCategoryNames - niche'ning bazaviy kategoriya NOMLARI (`lib/niches.js`)
 * @param {{hiddenValues?: string[], customCategories?: Array<string|{value:string}>}|null} [customization] - `sellers/{id}.categoryCustomization`
 * @returns {string[]} AI promptiga yuboriladigan YAKUNIY kategoriya nomlari
 */
function getEffectiveCategoryNamesForSeller(baseCategoryNames, customization) {
  const base = Array.isArray(baseCategoryNames) ? baseCategoryNames : [];
  const hidden = new Set(customization && Array.isArray(customization.hiddenValues) ? customization.hiddenValues : []);
  const customCategories = customization && Array.isArray(customization.customCategories) ? customization.customCategories : [];

  const visible = base.filter((name) => !hidden.has(name));

  const customNames = customCategories
    .map((c) => (typeof c === "string" ? c : c && c.value))
    .filter(Boolean);

  const merged = visible.slice();
  customNames.forEach((name) => {
    if (!merged.includes(name)) merged.push(name);
  });
  return merged;
}

module.exports = { getEffectiveCategoryNamesForSeller };
