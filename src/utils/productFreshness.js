import { toMillis } from "./firestoreTime";

/**
 * Mahsulot "YANGI" (isNew) belgisi qancha vaqt ko'rsatilib turishi
 * kerakligi — 2026-09 dizayn tuzatishi: bu belgi ENDI qat'iy VAQT
 * oynasiga ega, cheksiz emas.
 */
export const NEW_BADGE_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 soat

/**
 * Mahsulot "YANGI" deb hisoblanadimi — `createdAt`dan hozirgi vaqtgacha
 * o'tgan vaqt asosida, HAR SAFAR render paytida hisoblanadi.
 *
 * MUHIM (2026-09 tuzatish): OLDIN bu `product.isNew` — mahsulot
 * yaratilganda `true` qilib yozilgan, keyin HECH QACHON avtomatik
 * `false`ga o'zgarmaydigan STATIK bayroq edi (`services/products/
 * addProduct.js`) — hech qanday cron/trigger buni yangilamas edi,
 * ya'ni mahsulot "YANGI" bo'lib ABADIY qolardi. Endi holat
 * `createdAt`dan REAL VAQTDA hisoblanadi — badge aynan 48 soatdan
 * keyin, hech qanday qo'shimcha backend ishlarisiz, o'z-o'zidan
 * yo'qoladi.
 *
 * `createdAt` loyihada turli shaklda kelishi mumkin
 * (`services/products/addProduct.js`): Firestore'ga YOZILGANDA ISO
 * satr (`new Date().toISOString()`), lekin mahsulot yangi
 * qo'shilgandan KEYIN darhol Redux'ga qaytariladigan mahalliy
 * obyektda son (millisoniya, `Date.now()`) sifatida keladi — shuning
 * uchun avval umumiy `toMillis()` (Firestore Timestamp/{seconds}/
 * Date/son) sinaladi, u `null` qaytarsa ISO satr sifatida qayta
 * urinib ko'riladi.
 *
 * @param {*} createdAt - `product.createdAt`
 * @param {number} [nowMs] - joriy vaqt (test uchun ixtiyoriy)
 * @param {number} [windowMs] - "yangi" oynasi (test uchun ixtiyoriy)
 * @returns {boolean}
 */
export const isRecentlyAdded = (createdAt, nowMs = Date.now(), windowMs = NEW_BADGE_WINDOW_MS) => {
  if (!createdAt) return false;

  let millis = toMillis(createdAt);
  if (millis == null && typeof createdAt === "string") {
    const parsed = Date.parse(createdAt);
    millis = Number.isNaN(parsed) ? null : parsed;
  }
  if (millis == null) return false;

  return nowMs - millis < windowMs;
};
