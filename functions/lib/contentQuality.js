/**
 * AI CEO KUNLIK HISOBOTI — MAHSULOT TAVSIFI/RASMI SIFATINI BAHOLASH.
 *
 * SOF, HECH QANDAY tashqi chaqiruvsiz (Gemini, Firestore) mantiq —
 * `sellerTrustBadges.js`/`productSignals.js`/`dynamicPricing.js`dagi
 * bilan bir xil "hech narsa o'ylab topilmaydi" tamoyili: bu yerda
 * "sifat" HECH QACHON AI'ning subyektiv (masalan rasm chiroyliligi)
 * bahosi asosida emas, balki ikkita ODDIY, ANIQ, HAMMA UCHUN BIR XIL
 * o'lchanadigan HAQIQIY signal asosida aniqlanadi:
 *   1) `product.description` — umuman yo'q YOKI juda QISQA (xaridor
 *      uchun mahsulotni tushunish/ishonch uchun yetarli emas).
 *   2) `product.image` — umuman yo'q (mahsulot rasmisiz, xaridor
 *      ko'rmaydi — eng jiddiy kamchilik).
 * Faqat FAOL (`isActive !== false`) mahsulotlar ko'rib chiqiladi —
 * arxivlangan/o'chirilgan mahsulotning tavsifi endi ahamiyatsiz.
 */

const MIN_DESCRIPTION_LENGTH = 40;
const MAX_LISTED_PRODUCTS = 5;

/**
 * Bitta mahsulotning tavsifi "juda qisqa/yo'q" hisoblanadimi -
 * tekshiradi. Sof funksiya.
 */
function hasWeakDescription(product) {
  const description = typeof product?.description === "string" ? product.description.trim() : "";
  return description.length < MIN_DESCRIPTION_LENGTH;
}

/** Bitta mahsulotning asosiy rasmi yo'qligini tekshiradi. Sof funksiya. */
function hasNoImage(product) {
  return !product?.image;
}

/**
 * Sotuvchining BARCHA (faol) mahsulotlaridan, tavsif/rasm sifati
 * bo'yicha muammoli bo'lganlarni topadi.
 *
 * @param {Array<{id:string, name?:string, description?:string, image?:string, isActive?:boolean}>} products
 * @returns {{
 *   weakDescriptionCount: number,
 *   noImageCount: number,
 *   weakDescriptionProducts: Array<{id:string, name:string}>,
 *   noImageProducts: Array<{id:string, name:string}>,
 * }}
 */
function computeContentQualityIssues(products) {
  const activeProducts = (Array.isArray(products) ? products : []).filter((p) => p?.isActive !== false);

  const weakDescription = activeProducts.filter(hasWeakDescription);
  const noImage = activeProducts.filter(hasNoImage);

  const toSummary = (p) => ({ id: p.id, name: p.name || "Nomsiz mahsulot" });

  return {
    weakDescriptionCount: weakDescription.length,
    noImageCount: noImage.length,
    weakDescriptionProducts: weakDescription.slice(0, MAX_LISTED_PRODUCTS).map(toSummary),
    noImageProducts: noImage.slice(0, MAX_LISTED_PRODUCTS).map(toSummary),
  };
}

module.exports = {
  MIN_DESCRIPTION_LENGTH,
  MAX_LISTED_PRODUCTS,
  hasWeakDescription,
  hasNoImage,
  computeContentQualityIssues,
};
