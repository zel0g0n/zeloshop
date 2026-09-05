/**
 * Foiz asosida chegirma narxini hisoblaydi (masalan "-20%" tugmasi
 * bosilganda). SOF FUNKSIYA - `CreatePromotionPage.jsx`dan
 * ajratilgan, to'g'ridan-to'g'ri test qilinadi.
 */
export function calculateDiscountFromPercent(originalPrice, percent) {
  const price = Number(originalPrice) || 0;
  return Math.round(price * (1 - percent / 100));
}

/**
 * Kiritilgan chegirma narxi HAQIQATAN amal qiladigan (asl narxdan
 * kichik, musbat) ekanini tekshiradi.
 */
export function isValidDiscountPrice(discountPrice, originalPrice) {
  const discount = Number(discountPrice);
  const original = Number(originalPrice) || 0;
  if (!discountPrice || Number.isNaN(discount) || discount <= 0) return false;
  return discount < original;
}

/**
 * "VAQTLI AKSIYA" — `CreatePromotionPage.jsx`dagi muddat tanlash
 * tugmalari uchun variantlar. `hours: null` = "muddatsiz" (chegirma
 * hech qachon avtomatik tugamaydi).
 */
export const DISCOUNT_DURATION_OPTIONS = [
  { key: "1day", hours: 24 },
  { key: "3days", hours: 72 },
  { key: "7days", hours: 168 },
  { key: "unlimited", hours: null },
];

/**
 * Tanlangan muddat (soat) asosida, HOZIRDAN boshlab hisoblangan
 * tugash vaqtini (ISO satr) qaytaradi. `hours` bo'lmasa (muddatsiz) -
 * `null`.
 */
export function computeDiscountExpiresAt(hours, nowMs = Date.now()) {
  if (!hours) return null;
  return new Date(nowMs + hours * 60 * 60 * 1000).toISOString();
}
