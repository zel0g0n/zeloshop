/**
 * "Smart Calculator" — narx, tannarx va chegirma asosida sof foyda
 * va rentabellikni hisoblaydi. SOF funksiya — React'ga bog'liq emas,
 * to'g'ridan-to'g'ri sinov (test) faylida tekshiriladi.
 *
 * @param {string|number} price - sotish narxi
 * @param {string|number} costPrice - tannarx
 * @param {string|number} discountPrice - chegirma narxi (ixtiyoriy, "" bo'lishi mumkin)
 */
export function computeProfitMetrics(price, costPrice, discountPrice) {
  const priceNum = Number(price);
  const costNum = Number(costPrice);
  const discountNum = Number(discountPrice);

  // Bo'sh qatorni ("") haqiqiy 0 dan ajratamiz — aks holda narx "0"
  // kiritilganda hisoblash noto'g'ri (yo'q deb) ishlaydi.
  const valid = price !== "" && costPrice !== "" && !Number.isNaN(priceNum) && !Number.isNaN(costNum);

  if (!valid) {
    return { profit: 0, marginPercentage: 0, hasValues: false, effectivePrice: 0 };
  }

  // Agar chegirma narxi kiritilgan bo'lsa, foyda HAQIQIY (chegirmali)
  // narxdan hisoblanadi — chunki xaridor aslida shuni to'laydi.
  const sellingPrice = discountPrice !== "" && !Number.isNaN(discountNum) && discountNum > 0
    ? discountNum
    : priceNum;

  const profit = sellingPrice - costNum;
  const marginPercentage = sellingPrice !== 0 ? Math.round((profit / sellingPrice) * 100) : 0;

  return { profit, marginPercentage, hasValues: true, effectivePrice: sellingPrice };
}

/**
 * "VAQTLI AKSIYA" (muddatli chegirma) — bitta mahsulotning chegirmasi
 * HOZIR haqiqatan amal qiladimi (SOF funksiya, YAGONA tekshiruv joyi -
 * OLDIN bu bir xil tekshiruv `ProductCard.jsx`, `ProductPrice.jsx`,
 * `CatalogFilterContext.jsx`, `useFilterPriduct.jsx` va boshqa
 * joylarda ALOHIDA-ALOHIDA takrorlangan edi, muddat maydoni
 * qo'shilganda ularning BARCHASINI birma-bir topib tuzatish xavfli
 * edi).
 *
 * MUHIM: bu yerdagi tekshiruv faqat KO'RSATISH uchun — mijoz
 * qurilmasining soati ishonchsiz. HAQIQIY chegirma amal qilish-
 * qilmasligi har doim serverda (`functions/orders.js`, buyurtma
 * yaratish tranzaksiyasi ichida) XUDDI SHU MANTIQ bilan QAYTA
 * tekshiriladi — shuning uchun muddati o'tgan chegirma HECH QACHON
 * haqiqiy to'lovga qo'llanmaydi, hatto mijoz soatini orqaga surib
 * qo'ysa ham.
 *
 * @param {{price?, discountPrice?, discountExpiresAt?: string|null}} product
 * @param {number} [nowMs]
 */
export function isDiscountActive(product, nowMs = Date.now()) {
  const price = Number(product?.price) || 0;
  const discountPrice = Number(product?.discountPrice) || 0;
  if (discountPrice <= 0 || discountPrice >= price) return false;
  if (!product?.discountExpiresAt) return true;
  const expiresAtMs = new Date(product.discountExpiresAt).getTime();
  // Noto'g'ri/tushunarsiz formatdagi sana - xavfsiz standart sifatida
  // "muddatsiz" deb hisoblanadi (bu holat amalda hech qachon yuz
  // bermasligi kerak, chunki yozish joyi - `setDiscountPrice.js` -
  // faqat ISO satr yoki `null` yozadi).
  if (Number.isNaN(expiresAtMs)) return true;
  return expiresAtMs > nowMs;
}

/**
 * Muddatli aksiyaning tugashiga necha millisekund qolganini
 * qaytaradi — muddat belgilanmagan bo'lsa `null`, muddat allaqachon
 * o'tgan bo'lsa `0`.
 */
export function getDiscountRemainingMs(product, nowMs = Date.now()) {
  if (!product?.discountExpiresAt) return null;
  const expiresAtMs = new Date(product.discountExpiresAt).getTime();
  if (Number.isNaN(expiresAtMs)) return null;
  return Math.max(0, expiresAtMs - nowMs);
}

const COUNTDOWN_DAY_MS = 24 * 60 * 60 * 1000;
const COUNTDOWN_HOUR_MS = 60 * 60 * 1000;
const COUNTDOWN_MINUTE_MS = 60 * 1000;

/**
 * Qolgan vaqtni "orqaga sanoq" ko'rinishida formatlaydi - masalan
 * "2k 05:23:11" (2 kundan ko'p qolgan bo'lsa) yoki "05:23:11" (1
 * kundan kam qolgan bo'lsa). Muddat tugagan/mavjud bo'lmasa `null`.
 */
export function formatCountdown(remainingMs) {
  if (remainingMs == null || remainingMs <= 0) return null;
  const pad = (n) => String(n).padStart(2, "0");
  const days = Math.floor(remainingMs / COUNTDOWN_DAY_MS);
  const hours = Math.floor((remainingMs % COUNTDOWN_DAY_MS) / COUNTDOWN_HOUR_MS);
  const minutes = Math.floor((remainingMs % COUNTDOWN_HOUR_MS) / COUNTDOWN_MINUTE_MS);
  const seconds = Math.floor((remainingMs % COUNTDOWN_MINUTE_MS) / 1000);
  if (days > 0) return `${days}k ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
