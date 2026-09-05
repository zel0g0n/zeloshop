/**
 * Mahsulot bandllari ("combo takliflar") uchun sof yordamchi
 * funksiyalar. HAQIQIY, YAKUNIY narx har doim serverda
 * (`functions/orders.js`dagi `handleCreateOrder`) HOZIRGI mahsulot
 * narxlaridan qayta hisoblanadi — bu yerdagi funksiyalar faqat
 * frontendda (client sahifasi, checkout) KO'RSATISH uchun.
 */

/**
 * Berilgan combo ("bundle")ning barcha mahsulotlari savatda
 * (kamida 1 donadan) bor-yo'qligini tekshiradi. Savatdan bittasi
 * ham olib tashlansa, combo narxi endi qo'llanmasligi kerak — bu
 * funksiya checkout sahifasida shu holatni aniqlash uchun.
 *
 * @param {Array<{id:string, quantity:number}>} carts
 * @param {{productIds?: string[]}|null} bundle
 * @returns {boolean}
 */
export function isBundleStillValid(carts, bundle) {
  const productIds = Array.isArray(bundle?.productIds) ? bundle.productIds : [];
  if (productIds.length === 0) return false;
  const cartList = Array.isArray(carts) ? carts : [];
  return productIds.every((pid) => cartList.some((item) => item.id === pid && Number(item.quantity) > 0));
}

/**
 * Combo mahsulotlarining ALOHIDA-ALOHIDA sotib olinganda qancha
 * turishini (joriy narxlardan) hisoblaydi — "tejaysiz" xabarini
 * ko'rsatish uchun.
 *
 * @param {Array<{id:string, price:number, discountPrice?:number}>} products - combo'ga kiruvchi mahsulotlar (to'liq hujjat)
 * @returns {number}
 */
export function computeBundleIndividualTotal(products) {
  const list = Array.isArray(products) ? products : [];
  return list.reduce((sum, p) => {
    const price = Number(p?.price) || 0;
    const discountPrice = Number(p?.discountPrice) || 0;
    const unitPrice = discountPrice > 0 && discountPrice < price ? discountPrice : price;
    return sum + unitPrice;
  }, 0);
}

/**
 * @param {number} individualTotal
 * @param {number} bundlePrice
 * @returns {{savings: number, savingsPercent: number}}
 */
export function computeBundleSavings(individualTotal, bundlePrice) {
  const safeIndividual = Number(individualTotal) || 0;
  const safeBundle = Number(bundlePrice) || 0;
  const savings = Math.max(0, safeIndividual - safeBundle);
  const savingsPercent = safeIndividual > 0 ? Math.round((savings / safeIndividual) * 100) : 0;
  return { savings, savingsPercent };
}
