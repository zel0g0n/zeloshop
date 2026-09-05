/**
 * Mahsulot sahifasidagi "O'xshash mahsulotlar" / "Ko'pincha birga
 * sotib olinadi" bo'limi uchun sof funksiya.
 *
 * MUHIM TUZATISH (v39.13): bu bo'lim OLDIN `product.tags` maydoniga
 * asoslangan edi (`hooks/useRelatedProducts.jsx`) - LEKIN hech qanday
 * mahsulot yaratish/tahrirlash oqimi (`services/products/addProduct.js`
 * va h.k.) bu maydonni UMUMAN yozmaydi. Natijada bu bo'lim HAR DOIM
 * bo'sh (hech narsa ko'rsatmas) edi - "Don't fabricate UI implying an
 * unbuilt feature works" tamoyiliga zid, xuddi ishlayotgandek
 * ko'ringan, aslida o'lik funksiya.
 *
 * Endi UCH DARAJALI, barchasi HAQIQIY ma'lumot yoki xolis
 * konfiguratsiyaga asoslangan:
 *   1) Agar HAQIQIY xarid tarixidan hisoblangan "birga sotib
 *      olingan" statistikasi yetarli bo'lsa (`product.frequentlyBoughtWith`,
 *      `functions/productRecommendations.js`da real buyurtmalardan
 *      hisoblanadi) - o'shani ishlatadi.
 *   2) Aks holda, bir xil KATEGORIYADAGI, reyting/sharh soni
 *      bo'yicha eng yaxshi mahsulotlarga qaytadi.
 *   3) Bittasi ham bo'lmasa (yangi mahsulot/kam buyurtma - "sovuq
 *      boshlanish", VA bir xil kategoriyada boshqa mahsulot yo'q),
 *      15-NICHE UNIVERSAL PLATFORMA: niche konfiguratsiyasidagi
 *      `recommendations` (bog'liq kategoriya juftliklari,
 *      `config/niches.js`) orqali BOG'LANGAN kategoriyalardagi eng
 *      yaxshi baholangan mahsulotlarga qaytadi (masalan Kosmetika'da
 *      "Dekorativ kosmetika" ko'rilganda "Parfyumeriya"ni taklif
 *      qilish). Bu HAM "customers often buy" kabi HAQIQIY statistik
 *      da'vo EMAS - faqat sotuvchining o'zi tanlagan niche uchun
 *      mantiqan bog'liq kategoriyalarni ko'rsatish.
 * Hech qachon uydirma/tasodifiy mahsulot ko'rsatilmaydi.
 */

import { getRelatedCategoriesForCategory } from "@/config/niches";

const DEFAULT_MAX_RESULTS = 8;
// Bitta-ikkita tasodifiy birga tushib qolgan buyurtma "naqshga"
// aylanmasin - kamida shuncha alohida buyurtmada birga uchragan
// bo'lishi kerak.
const MIN_COOCCURRENCE_COUNT = 2;

function isPurchasable(product) {
  return (product?.isActive ?? true) && Number(product?.stock) > 0;
}

/**
 * @param {Array} allProducts - shu sotuvchining BARCHA mahsulotlari (joriy sahifadagisi ham kiradi)
 * @param {Object} currentProduct - hozir ko'rilayotgan mahsulot
 * @param {{maxResults?: number, nicheId?: string}} [options] - `nicheId` 3-daraja (bog'liq kategoriya) zaxirasi uchun kerak
 * @returns {{items: Array, basis: "cooccurrence"|"category"|"relatedCategory"|"none"}}
 */
export function pickRelatedProducts(allProducts, currentProduct, options = {}) {
  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
  if (!currentProduct || !Array.isArray(allProducts)) return { items: [], basis: "none" };

  const candidates = allProducts.filter((p) => String(p.id) !== String(currentProduct.id));

  const cooccurrence = Array.isArray(currentProduct.frequentlyBoughtWith) ? currentProduct.frequentlyBoughtWith : [];
  const strongCooccurrence = cooccurrence.filter((entry) => (Number(entry?.count) || 0) >= MIN_COOCCURRENCE_COUNT);

  if (strongCooccurrence.length > 0) {
    const byId = new Map(candidates.map((p) => [String(p.id), p]));
    const items = strongCooccurrence
      .slice()
      .sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0))
      .map((entry) => byId.get(String(entry.productId)))
      .filter(Boolean)
      .filter(isPurchasable)
      .slice(0, maxResults);
    if (items.length > 0) return { items, basis: "cooccurrence" };
  }

  const sameCategory = candidates
    .filter((p) => p.category && p.category === currentProduct.category)
    .filter(isPurchasable)
    .sort((a, b) => {
      const ratingDiff = (Number(b.averageRating) || 0) - (Number(a.averageRating) || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (Number(b.reviewCount) || 0) - (Number(a.reviewCount) || 0);
    })
    .slice(0, maxResults);

  if (sameCategory.length > 0) return { items: sameCategory, basis: "category" };

  // 3-daraja (sovuq boshlanish zaxirasi): niche konfiguratsiyasidagi
  // bog'liq kategoriyalardan.
  const relatedCategories = getRelatedCategoriesForCategory(options.nicheId, currentProduct.category);
  if (relatedCategories.length > 0) {
    const relatedCategorySet = new Set(relatedCategories);
    const relatedItems = candidates
      .filter((p) => p.category && relatedCategorySet.has(p.category))
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
