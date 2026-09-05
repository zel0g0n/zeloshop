/**
 * Checkout'dagi "ko'pincha birga olishadi" (cross-sell) bloki uchun
 * sof funksiya.
 *
 * `utils/productRecommendations.js`dagi (mahsulot sahifasi uchun) UCH
 * bosqichli mantiq bilan bir xil printsip, lekin BITTA mahsulot
 * o'rniga SAVATDAGI BARCHA mahsulotlarni hisobga oladi:
 *   1) HAQIQIY (yetkazib berilgan buyurtmalar tarixidan hisoblangan,
 *      `product.frequentlyBoughtWith` - `functions/productRecommendations.js`)
 *      "birga sotib olingan" hamrohlar - savatdagi HAR BIR mahsulot
 *      bo'yicha yig'ilib, umumlashtiriladi.
 *   2) Yetarli signal bo'lmasa (yangi mahsulot/kam buyurtma) -
 *      savatdagi mahsulotlar KATEGORIYASIDAGI eng yaxshi baholangan
 *      mahsulotlarga qaytadi.
 *   3) Bittasi ham bo'lmasa - 15-NICHE UNIVERSAL PLATFORMA: niche
 *      konfiguratsiyasidagi `recommendations` (bog'liq kategoriya
 *      juftliklari, `config/niches.js`) orqali savatdagi
 *      kategoriyalarga BOG'LANGAN kategoriyalardagi eng yaxshi
 *      baholangan mahsulotlarga qaytadi.
 * Har uch holatda ham: savatda ALLAQACHON bor mahsulot qayta taklif
 * qilinmaydi, va faqat HAQIQIY sotib olsa bo'ladigan (faol, omborda
 * bor) mahsulotlar ko'rsatiladi. Hech qanday uydirma/tasodifiy
 * mahsulot yo'q.
 */

import { getRelatedCategoriesForCategory } from "@/config/niches";

const DEFAULT_MAX_RESULTS = 6;
// `productRecommendations.js` bilan bir xil chegara - bitta-ikkita
// tasodifiy birga tushib qolgan buyurtma "naqshga" aylanmasin.
const MIN_COOCCURRENCE_COUNT = 2;

function isPurchasable(product) {
  return (product?.isActive ?? true) && Number(product?.stock) > 0;
}

/**
 * @param {Array} allProducts - shu sotuvchining BARCHA (jonli, eng yangi) mahsulotlari
 * @param {Array} cartItems - savatdagi mahsulotlar (savat snapshot'i - eskirgan bo'lishi mumkin)
 * @param {{maxResults?: number, nicheId?: string}} [options] - `nicheId` 3-daraja (bog'liq kategoriya) zaxirasi uchun kerak
 * @returns {{items: Array, basis: "cooccurrence"|"category"|"relatedCategory"|"none"}}
 */
export function pickCheckoutCrossSell(allProducts, cartItems, options = {}) {
  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
  if (!Array.isArray(allProducts) || !Array.isArray(cartItems) || cartItems.length === 0) {
    return { items: [], basis: "none" };
  }

  const cartIds = new Set(cartItems.map((item) => String(item.id)));
  const candidates = allProducts.filter((p) => !cartIds.has(String(p.id)));
  if (candidates.length === 0) return { items: [], basis: "none" };

  // Savat elementlari checkout'ga kelguncha eskirgan bo'lishi mumkin
  // (masalan `frequentlyBoughtWith` savatga qo'shilgandan keyin
  // yangilangan bo'lishi mumkin) - shuning uchun HAR BIR savat
  // elementi uchun, mumkin bo'lsa, jonli ro'yxatdagi ENG YANGI
  // nusxasidan foydalanamiz.
  const productById = new Map(allProducts.map((p) => [String(p.id), p]));
  const freshCartProducts = cartItems.map((item) => productById.get(String(item.id)) || item);

  // 1) HAQIQIY birga-sotib-olingan signalini yig'ish.
  const aggregated = new Map(); // productId -> yig'indi count
  for (const cartProduct of freshCartProducts) {
    const entries = Array.isArray(cartProduct?.frequentlyBoughtWith) ? cartProduct.frequentlyBoughtWith : [];
    for (const entry of entries) {
      const coProductId = String(entry?.productId || "");
      if (!coProductId || cartIds.has(coProductId)) continue;
      const count = Number(entry?.count) || 0;
      aggregated.set(coProductId, (aggregated.get(coProductId) || 0) + count);
    }
  }

  const strongCooccurrence = Array.from(aggregated.entries()).filter(([, count]) => count >= MIN_COOCCURRENCE_COUNT);
  if (strongCooccurrence.length > 0) {
    const byId = new Map(candidates.map((p) => [String(p.id), p]));
    const items = strongCooccurrence
      .sort((a, b) => b[1] - a[1])
      .map(([productId]) => byId.get(productId))
      .filter(Boolean)
      .filter(isPurchasable)
      .slice(0, maxResults);
    if (items.length > 0) return { items, basis: "cooccurrence" };
  }

  // 2) Zaxira: savatdagi mahsulotlar kategoriyalaridan, eng yaxshi
  // baholangan (savatda yo'q) mahsulotlar.
  const cartCategories = new Set(freshCartProducts.map((p) => p.category).filter(Boolean));
  if (cartCategories.size === 0) return { items: [], basis: "none" };

  const sameCategory = candidates
    .filter((p) => p.category && cartCategories.has(p.category))
    .filter(isPurchasable)
    .sort((a, b) => {
      const ratingDiff = (Number(b.averageRating) || 0) - (Number(a.averageRating) || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (Number(b.reviewCount) || 0) - (Number(a.reviewCount) || 0);
    })
    .slice(0, maxResults);

  if (sameCategory.length > 0) return { items: sameCategory, basis: "category" };

  // 3) 15-NICHE UNIVERSAL PLATFORMA zaxirasi: niche konfiguratsiyasidagi
  // bog'liq kategoriyalardan.
  const relatedCategories = new Set();
  cartCategories.forEach((category) => {
    getRelatedCategoriesForCategory(options.nicheId, category).forEach((related) => relatedCategories.add(related));
  });
  if (relatedCategories.size > 0) {
    const relatedItems = candidates
      .filter((p) => p.category && relatedCategories.has(p.category))
      .filter(isPurchasable)
      .sort((a, b) => {
        const ratingDiff = (Number(b.averageRating) || 0) - (Number(a.averageRating) || 0);
        if (ratingDiff !== 0) return ratingDiff;
        return (Number(b.reviewCount) || 0) - (Number(a.reviewCount) || 0);
      })
      .slice(0, maxResults);
    if (relatedItems.length > 0) return { items: relatedItems, basis: "relatedCategory" };
  }

  return { items: [], basis: "none" };
}
