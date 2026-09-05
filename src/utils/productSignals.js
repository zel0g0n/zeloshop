/**
 * Mahsulot kartochkasi/detail sahifasidagi "kam zaxira" va "sotilgan
 * soni" belgilari — IKKALASI HAM mavjud, HAQIQIY Firestore
 * maydonlaridan (`product.stock`, `product.sold` — ikkalasi ham
 * `functions/orders.js`dagi `handleCreateOrder` tranzaksiyasida har
 * bir buyurtmada birga yangilanadi, ya'ni doim bir-biriga mos) sof
 * hisoblanadi.
 *
 * MUHIM PRINSIP (`utils/sellerTrustBadges.js`dagi bilan bir xil):
 * HECH QANDAY raqam o'ylab topilmaydi yoki sun'iy shoshilinchlik
 * yaratilmaydi (masalan soxta "hozir 3 kishi ko'rmoqda"). Zaxira
 * ko'rsatkichi — omborda HAQIQATAN qolgan miqdor; sotilgan soni —
 * HAQIQATAN yakunlangan buyurtmalar yig'indisi. Sotilgan sonini esa
 * (xuddi `sellerTrustBadges.js`dagi buyurtmalar soni kabi) aniq
 * raqam o'rniga PASTGA yaxlitlangan chegara ("50+") sifatida
 * ko'rsatamiz — bu ham xolislikni ta'minlaydi (masalan 51 ta
 * sotilgan mahsulot "51 marta sotilgan" emas, "50+ marta sotilgan"
 * deb ko'rsatiladi, keyingi safar 52 yoki 58 bo'lsa ham belgida
 * o'zgarish bo'lmaydi — bu doimiy qayta-render/chalkashlikning
 * oldini oladi).
 *
 * "BUGUN SOTILDI" IJTIMOIY ISBOT BELGISI (#119 - qayta ko'rib
 * chiqilgan qaror): shu YERDA ham HECH QANDAY soxta "hozir N kishi
 * ko'rmoqda" hisoblagichi YO'Q. Faqat `functions/orders.js`dagi
 * buyurtma tranzaksiyasi orqali yozilgan HAQIQIY, shu kun ichidagi
 * sotuvlar soni (`product.soldTodayCount`/`soldTodayDate` — batafsil
 * izoh: `functions/lib/dailySoldCounter.js`) ko'rsatiladi, va FAQAT
 * yetarlicha katta bo'lsa (`MIN_TODAY_SOLD_COUNT`) — "bugun 1 marta
 * sotildi" ishonch emas, aksincha shubha uyg'otadi.
 */

// Ushbu chegaradan past (lekin 0dan katta) qoldiqda "kam qoldi"
// belgisi ko'rsatiladi. 0 — alohida "tugagan" holati, bu yerga
// kirmaydi (`ProductPrice.jsx`da alohida ko'rsatiladi).
const LOW_STOCK_THRESHOLD = 5;

// Sotilgan soni belgisi uchun chegaralar — pastga yaxlitlab
// ko'rsatish uchun (`sellerTrustBadges.js`dagi ORDER_COUNT_BUCKETS
// bilan bir xil yondashuv).
const SOLD_COUNT_BUCKETS = [1000, 500, 100, 50, 20, 10];

// "Bugun sotildi" belgisi shu sonidan kam bo'lsa ko'rsatilmaydi -
// kichik son (masalan 1) ishonch bermaydi, aksincha "kam sotilyapti"
// taassurotini kuchaytiradi.
const MIN_TODAY_SOLD_COUNT = 3;

/**
 * @param {number|string|undefined} stock
 * @returns {{count: number}|null} - faqat 0 < stock <= chegarada qaytadi
 */
export function computeLowStockSignal(stock) {
  const safeStock = Number(stock);
  if (!Number.isFinite(safeStock) || safeStock <= 0 || safeStock > LOW_STOCK_THRESHOLD) {
    return null;
  }
  return { count: Math.floor(safeStock) };
}

/**
 * @param {number|string|undefined} sold
 * @returns {{count: number}|null} - eng yuqori mos chegara, hech biriga
 *   yetmasa null (yangi/kam sotilgan mahsulot uchun soxta "0+" YO'Q)
 */
export function computeSoldCountSignal(sold) {
  const safeSold = Number(sold) || 0;
  for (const bucket of SOLD_COUNT_BUCKETS) {
    if (safeSold >= bucket) {
      return { count: bucket };
    }
  }
  return null;
}

/**
 * "Bugun N marta sotildi" ijtimoiy isbot belgisi (#119).
 *
 * @param {number|string|undefined} soldTodayCount - `product.soldTodayCount`
 * @param {string|undefined} soldTodayDate - `product.soldTodayDate` ("YYYY-MM-DD")
 * @param {number} [nowMs] - joriy vaqt (millisekundda) - test uchun ixtiyoriy,
 *   berilmasa `Date.now()` ishlatiladi.
 * @returns {{count: number}|null} - faqat BUGUNGI (Toshkent vaqti) sana uchun
 *   VA hisoblagich yetarlicha katta bo'lsa qaytadi.
 */
export function computeTodaySoldSignal(soldTodayCount, soldTodayDate, nowMs = Date.now()) {
  // Backend (`functions/lib/dailyStats.js`dagi `todayDocId()`) bilan
  // BIR XIL formatda va vaqt mintaqasida hisoblanadi - aks holda
  // "kecha" sanasi "bugun" deb noto'g'ri o'qilib qolishi mumkin.
  const todayDateId = new Date(nowMs).toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
  if (soldTodayDate !== todayDateId) return null;
  const count = Number(soldTodayCount) || 0;
  if (count < MIN_TODAY_SOLD_COUNT) return null;
  return { count };
}
