import { toMillis } from "./firestoreTime";

/**
 * Sotuvchi ISHONCH nishonlari (trust badges) - hammasi HAQIQIY,
 * allaqachon kuzatilgan ma'lumotlardan hisoblanadi: sharhlarning XOM
 * yig'indisi/soni (`sellers.trustStats.ratingSum`/`ratingCount`,
 * `functions/reviews.js`da DELTA orqali saqlanadi), "umr bo'yi"
 * muvaffaqiyatli yetkazilgan buyurtmalar soni
 * (`trustStats.completedOrders`, `functions/orderRollups.js`da
 * saqlanadi) va do'kon ochilgan sana (`sellers.createdAt`).
 *
 * HECH QANDAY raqam o'ylab topilmaydi yoki sun'iy shoshilinchlik
 * yaratilmaydi (masalan soxta "3 kishi hozir ko'rmoqda" kabi narsalar
 * bu yerda YO'Q va BO'LMAYDI ham). Har bir nishon FAQAT chegarasiga
 * yetilgandagina ko'rsatiladi - yangi, hali tarixi yo'q sotuvchi uchun
 * bo'sh ro'yxat qaytariladi (bu HALOL holat, soxta boshlang'ich nishon
 * berilmaydi).
 *
 * Har bir qaytarilgan nishon `{ key, params }` shaklida - matn
 * TARJIMA qatlamida (`i18n/translations.js`dagi `trustBadges.*`
 * kalitlari) hosil qilinadi, bu yerda emas (loyihaning to'liq i18n
 * konventsiyasiga mos).
 */

// Reyting nishoni uchun kamida shuncha sharh kerak - bitta-ikkita
// sharhdan "yuqori baholangan" degan xulosa chiqarish yetarlicha
// ishonchli emas.
const MIN_REVIEWS_FOR_RATING_BADGE = 5;
const HIGH_RATING_THRESHOLD = 4.5;
// "Ishonchli sotuvchi" — yig'ma nishon: HAM yetarli hajm, HAM yuqori
// reyting birga bo'lishi kerak.
const TRUSTED_SELLER_MIN_ORDERS = 20;
// Haqiqiy sonni HAR DOIM pastga yaxlitlab ko'rsatamiz ("47 ta"
// o'rniga "40+") - burttirib ko'rsatmaslik uchun.
const ORDER_COUNT_BUCKETS = [500, 100, 50, 20, 10];
const MS_PER_MONTH = 30 * 24 * 60 * 60 * 1000;

function bucketOrderCount(count) {
  for (const bucket of ORDER_COUNT_BUCKETS) {
    if (count >= bucket) return bucket;
  }
  return null;
}

function monthsSince(createdAtMs, nowMs) {
  if (!createdAtMs) return 0;
  const diffMs = nowMs - createdAtMs;
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / MS_PER_MONTH);
}

/**
 * @param {{trustStats?: {ratingSum?: number, ratingCount?: number, completedOrders?: number}, createdAt?: any}} seller
 * @param {number} [nowMs]
 * @returns {Array<{key: string, params?: Record<string, string|number>}>}
 */
export function computeSellerTrustBadges(seller, nowMs = Date.now()) {
  if (!seller) return [];
  const badges = [];
  const stats = seller.trustStats || {};
  const ratingCount = Math.max(0, Number(stats.ratingCount) || 0);
  const ratingSum = Number(stats.ratingSum) || 0;
  const completedOrders = Math.max(0, Number(stats.completedOrders) || 0);
  const ratingAvg = ratingCount > 0 ? ratingSum / ratingCount : 0;
  const hasHighRating = ratingCount >= MIN_REVIEWS_FOR_RATING_BADGE && ratingAvg >= HIGH_RATING_THRESHOLD;

  if (hasHighRating) {
    badges.push({ key: "highRating", params: { rating: ratingAvg.toFixed(1), count: ratingCount } });
  }

  const orderBucket = bucketOrderCount(completedOrders);
  if (orderBucket) {
    badges.push({ key: "orderVolume", params: { count: orderBucket } });
  }

  if (completedOrders >= TRUSTED_SELLER_MIN_ORDERS && hasHighRating) {
    badges.push({ key: "trustedSeller" });
  }

  const months = monthsSince(toMillis(seller.createdAt), nowMs);
  if (months >= 12) {
    badges.push({ key: "activeSinceYears", params: { count: Math.floor(months / 12) } });
  } else if (months >= 1) {
    badges.push({ key: "activeSinceMonths", params: { count: months } });
  }

  return badges;
}

export const _internals = { bucketOrderCount, monthsSince };
