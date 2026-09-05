import { getAttributeKeysForNiche } from "@/config/niches";
import { getAttributeDefinition, ATTRIBUTE_TYPES } from "@/config/attributeDictionary";

/**
 * 15-NICHE UNIVERSAL PLATFORMA — filtr panelida ko'rsatiladigan
 * DINAMIK atribut filtrlarini quradi (masalan Kiyim-kechak uchun
 * o'lcham/rang/jins, Elektronika uchun brend/xotira, Kosmetika uchun
 * teri turi/soya).
 *
 * MUHIM QOIDALAR:
 *   1) Har bir niche o'zining `attributeKeys` ro'yxatiga ega
 *      (`config/niches.js`) - filtrlar HECH QAYERDA sahifa/komponent
 *      darajasida qattiq kodlangan emas, shu ro'yxatdan dinamik
 *      hosil qilinadi (yangi niche qo'shilganda bu funksiya
 *      o'zgarishsiz ishlayveradi).
 *   2) Faqat HOZIRGI (joriy) katalogda kamida BITTA mahsulotda
 *      haqiqatan qiymati bor atributlar ko'rsatiladi - aks holda
 *      foydalanuvchi bo'sh filtr ko'rib, hech narsa topa olmay
 *      qoladi (masalan do'konda hali "spf" qiymati kiritilgan
 *      mahsulot bo'lmasa, "SPF" filtri UMUMAN ko'rinmaydi).
 *   3) Kamida IKKITA farqli qiymat bo'lmasa, filtr ko'rsatilmaydi -
 *      bitta variantli filtr foydasiz (hammasi bir xil bo'lsa,
 *      filtrlashning ma'nosi yo'q).
 *   4) "select" turi uchun variantlar LUG'ATDAGI (attributeDictionary)
 *      belgilangan qiymatlar orasidan, faqat mavjudlari; "text"/
 *      "number" turi uchun - katalogda haqiqatan uchragan qiymatlar
 *      (alifbo tartibida, MAX_OPTIONS bilan cheklangan).
 *
 * Sof funksiya (Firestore/tarmoq so'rovisiz) - to'g'ridan-to'g'ri
 * testlanadi.
 *
 * @param {string} nicheId
 * @param {Array} products - joriy katalogdagi (filtrlanmagan) mahsulotlar
 * @returns {Array<{key: string, type: string, options: Array<{value: string, labelKey: string|null}>}>}
 */
const MAX_TEXT_OPTIONS = 12;

export function buildAttributeFilterDefs(nicheId, products) {
  const attributeKeys = getAttributeKeysForNiche(nicheId);
  const list = Array.isArray(products) ? products : [];
  const defs = [];

  for (const key of attributeKeys) {
    const def = getAttributeDefinition(key);
    if (!def) continue;

    const presentValues = new Set();
    for (const p of list) {
      const value = p?.attributes?.[key];
      if (value !== undefined && value !== null && value !== "") presentValues.add(String(value));
    }
    if (presentValues.size < 2) continue; // bitta yoki nolta variant - filtr sifatida foydasiz

    let options;
    if (def.type === ATTRIBUTE_TYPES.SELECT) {
      options = (def.options || [])
        .filter((o) => presentValues.has(o.value))
        .map((o) => ({ value: o.value, labelKey: o.labelKey }));
    } else {
      options = Array.from(presentValues)
        .sort((a, b) => a.localeCompare(b))
        .slice(0, MAX_TEXT_OPTIONS)
        .map((v) => ({ value: v, labelKey: null }));
    }
    if (options.length < 2) continue;

    defs.push({ key, type: def.type, options });
  }
  return defs;
}
