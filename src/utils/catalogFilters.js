/**
 * Katalogning "kengaytirilgan filtr" paneli (narx oralig'i, reyting,
 * ombor mavjudligi, narx bo'yicha saralash) uchun sof funksiya.
 *
 * MUHIM: bu — tezkor-filtr qatoridagi (Aksiya/Arzon/Yangilar/Top,
 * `CatalogFilterContext.jsx`dagi `applyQuickFilter`) mezonlardan
 * ATAYLAB MUSTAQIL va ular bilan HECH QANDAY ustma-ust tushmaydi -
 * ular allaqachon bitta bosishda mavjud, bu yerda takrorlanmagan.
 *
 * @param {Array} products
 * @param {Object} criteria
 * @param {number|null} [criteria.priceMin]
 * @param {number|null} [criteria.priceMax]
 * @param {number} [criteria.minRating] - 0 bo'lsa filtr qo'llanmaydi
 * @param {boolean} [criteria.inStockOnly]
 * @param {"none"|"price-asc"|"price-desc"} [criteria.priceSort]
 */
/**
 * 15-NICHE UNIVERSAL PLATFORMA: mahsulotning dinamik `attributes`
 * maydoni (masalan `{skinType: "oily", brand: "Nivea"}`) bo'yicha
 * filtrlaydi. `attributeFilters` - `{[atributKaliti]: tanlangan
 * qiymat}` shaklida, faqat HAQIQIY (bo'sh bo'lmagan) qiymatlar
 * hisobga olinadi. Har bir niche o'z atributlariga ega bo'lgani
 * uchun, bu funksiya HECH QANDAY kategoriya/niche nomini bilmaydi -
 * shunchaki berilgan kalit-qiymat juftliklarini mahsulotning
 * `attributes` obyekti bilan solishtiradi (shu orqali istalgan
 * niche uchun ishlaydi, kod qo'shimcha o'zgartirilishi shart emas).
 */
export function applyAttributeFilters(products, attributeFilters = {}) {
  const activeEntries = Object.entries(attributeFilters || {}).filter(([, value]) => value);
  if (activeEntries.length === 0) return products;
  return products.filter((p) =>
    activeEntries.every(([key, value]) => String(p?.attributes?.[key] ?? "") === String(value))
  );
}

export function applyAdvancedFilters(products, criteria = {}) {
  const { priceMin = null, priceMax = null, minRating = 0, inStockOnly = false, priceSort = "none", attributes = {} } = criteria;

  let result = products.filter((p) => {
    const price = Number(p.price) || 0;
    if (priceMin != null && price < priceMin) return false;
    if (priceMax != null && price > priceMax) return false;
    if (minRating > 0 && (Number(p.averageRating) || 0) < minRating) return false;
    if (inStockOnly && (Number(p.stock) || 0) <= 0) return false;
    return true;
  });

  result = applyAttributeFilters(result, attributes);

  if (priceSort === "price-asc") {
    result = [...result].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
  } else if (priceSort === "price-desc") {
    result = [...result].sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
  }

  return result;
}

/**
 * Panelda "N ta filtr faol" degan belgi (badge) ko'rsatish uchun -
 * necha ta MUSTAQIL mezon o'zgartirilganini sanaydi.
 */
export function countActiveAdvancedFilters({ priceMin, priceMax, minRating, inStockOnly, priceSort, attributes }) {
  let count = 0;
  if (priceMin != null || priceMax != null) count += 1;
  if (minRating > 0) count += 1;
  if (inStockOnly) count += 1;
  if (priceSort && priceSort !== "none") count += 1;
  if (attributes) count += Object.values(attributes).filter(Boolean).length;
  return count;
}

export const DEFAULT_ADVANCED_FILTERS = {
  priceMin: null,
  priceMax: null,
  minRating: 0,
  inStockOnly: false,
  priceSort: "none",
  // 15-NICHE UNIVERSAL PLATFORMA: har bir niche'ning o'z dinamik
  // atribut filtrlari (`utils/attributeFilters.js`dagi
  // `buildAttributeFilterDefs` orqali quriladi) - kalit atribut nomi,
  // qiymat sotuvchi tanlagan filtr qiymati.
  attributes: {},
};
