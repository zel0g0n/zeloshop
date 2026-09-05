/**
 * "AI NARX TAVSIYALARI" — sof, HECH QANDAY tashqi chaqiruvsiz (Gemini,
 * Firestore) narx o'zgarishi tavsiyasini hisoblaydigan mantiq.
 *
 * MUHIM ARXITEKTURAVIY QAROR (`telegramApproval.js`dagi mavjud izohga
 * qarang — "mahsulot narxini o'zgartirish... haqiqiy moliyaviy
 * ta'sirga ega va qaytarilishi aniq emas, shuning uchun bu funksiya
 * doirasidan ataylab chetlashtirilgan"): shu sababli bu modul HECH
 * QACHON narxni AVTOMATIK o'zgartirmaydi — faqat TAVSIYA hisoblaydi.
 * Haqiqiy qo'llash (`applyPricingSuggestion`, `pricingSuggestions.js`)
 * doim sotuvchining o'zi, Mini App ichida, aniq "Qo'llash" tugmasini
 * bosishi bilan amalga oshadi — hech qanday Telegram 1-tugmali
 * avto-tasdiqlash YO'Q (chegirma promokod yoki CRM xabaridan farqli
 * o'laroq, bu yerda haqiqatan REVERSIBLE-EMAS moliyaviy ta'sir bor).
 *
 * SIGNALLAR — FAQAT HAQIQIY, MAVJUD Firestore maydonlaridan (hech
 * qanday tashqi "raqobatchi narxi" ma'lumoti YO'Q, shuning uchun bunday
 * signal ATAYLAB ishlatilmaydi — `sellerTrustBadges.js`/
 * `productSignals.js`dagi bilan bir xil "hech narsa o'ylab topilmaydi"
 * tamoyili):
 *   - `product.stock` — omborda HAQIQATAN qolgan miqdor.
 *   - `product.sold` — HAQIQATAN yakunlangan buyurtmalar yig'indisi
 *     (`functions/orders.js`da har bir buyurtmada oshiriladi).
 *   - `product.costPrice` — sotuvchi kiritgan haqiqiy tannarx (0 bo'lsa,
 *     "kiritilmagan" deb hisoblanadi, margin-chegarasi qo'llanilmaydi).
 *   - `product.createdAt` — mahsulot ro'yxatga necha kun oldin
 *     qo'shilgani (juda yangi mahsulot "sekin sotiladi" deb ATAYLAB
 *     hisoblanmaydi — vaqt kam o'tgan, xulosa chiqarish uchun asos yo'q).
 *
 * UCH TUR TAVSIYA:
 *   1) `slow_mover_discount` — mahsulot YETARLICHA UZOQ vaqt (>= 14
 *      kun) ro'yxatda turibdi, deyarli SOTILMAGAN (<= 2 dona) VA
 *      zaxira hali YETARLI (>= 5 dona, ya'ni "allaqachon deyarli
 *      tugagan" holat emas) — CHEGIRMA taklif qilinadi (zaxirani
 *      harakatga keltirish uchun).
 *   2) `high_demand_increase` — zaxira JUDA KAM qolgan (<= 5 dona,
 *      `productSignals.js`dagi LOW_STOCK_THRESHOLD bilan bir xil
 *      chegara) VA shu bilan birga YETARLICHA KO'P sotilgan (>= 10
 *      dona, ya'ni bu HAQIQIY talab isboti, tasodifiy kam zaxira emas)
 *      — narxni OSHIRISH taklif qilinadi (talab taklifdan oshib
 *      ketmoqda degan haqiqiy signal asosida).
 *   3) `category_price_high` / `category_price_low` — YUQORIDAGI
 *      ikkalasi ham mos kelmasa, mahsulotning narxi O'ZINING (shu
 *      SOTUVCHIga tegishli, shu KATEGORIYADAGI boshqa faol
 *      mahsulotlar) o'rtacha narxidan SEZILARLI (>= 25%) farq qilsa —
 *      o'sha o'rtachaga qarab moslashtirish taklif qilinadi. MUHIM:
 *      bu HECH QACHON boshqa sotuvchilarning narxi bilan
 *      SOLISHTIRMAYDI (bunday ma'lumot yo'q va tarmoqda bunday
 *      "raqobatchi narxi" signali ATAYLAB ishlatilmaydi) — faqat
 *      sotuvchining O'Z katalogidagi shu kategoriya narxlari bilan
 *      ichki muvofiqlikni tekshiradi. Kamida `CATEGORY_MIN_SAMPLE_SIZE`
 *      ta boshqa mahsulot bo'lmasa (statistik ahamiyatsiz), tavsiya
 *      berilmaydi.
 *
 * XAVFSIZLIK CHEGARALARI (har ikkala tur uchun):
 *   - Tannarx (`costPrice`) berilgan bo'lsa, tavsiya qilingan narx
 *     HECH QACHON tannarxdan `MIN_MARGIN_PERCENT`dan kam foyda
 *     bilan bo'lishi mumkin emas — zarar bilan sotishni tavsiya
 *     qilish MUTLAQO taqiqlangan.
 *   - Narx o'zgarishi bir martada `MAX_PRICE_CHANGE_PERCENT`dan oshib
 *     ketmaydi — keskin sakrashlarning oldini olish uchun.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const SLOW_MOVER_MIN_AGE_DAYS = 14;
const SLOW_MOVER_MAX_SOLD = 2;
const SLOW_MOVER_MIN_STOCK = 5;
const SLOW_MOVER_DISCOUNT_PERCENT = 12;

// `src/utils/productSignals.js`dagi LOW_STOCK_THRESHOLD bilan ATAYLAB
// bir xil qiymat — ikkala joyda ham "kam zaxira" bir xil ma'noni
// anglatishi uchun.
const HIGH_DEMAND_MAX_STOCK = 5;
const HIGH_DEMAND_MIN_SOLD = 10;
const HIGH_DEMAND_INCREASE_PERCENT = 8;

const MIN_MARGIN_PERCENT = 10;
const MAX_PRICE_CHANGE_PERCENT = 20;

// Kategoriya bo'yicha solishtiruv uchun - kamida shuncha "boshqa" (shu
// mahsulotdan tashqari) faol mahsulot bo'lishi kerak, aks holda o'rtacha
// narx statistik jihatdan ma'nosiz bo'lib qoladi (masalan bitta boshqa
// mahsulotning narxi bilan solishtirish shunchaki tasodifiy natija beradi).
const CATEGORY_MIN_SAMPLE_SIZE = 3;
// Shu chegaradan KAM farq - oddiy narx tafovuti (turli mahsulot
// xususiyatlari bilan izohlanishi mumkin), tavsiya uchun asos emas.
const CATEGORY_OUTLIER_THRESHOLD_PERCENT = 25;

/**
 * Narxni yaqin 100 so'mga yaxlitlaydi — do'kon narxlari odatda "dumaloq"
 * sonlar (masalan 45000, 45500), tavsiya ham shu konventsiyaga mos
 * bo'lishi uchun.
 */
function roundToNearestHundred(value) {
  return Math.max(0, Math.round(value / 100) * 100);
}

/**
 * ISO sana satridan (yoki `null`/noto'g'ri qiymatdan) necha kun
 * o'tganini hisoblaydi. Noto'g'ri/yo'q sanada `0` qaytaradi (ya'ni
 * "yangi" deb hisoblanadi — sekin-sotiladi belgisi hech qachon
 * noto'g'ri ma'lumotdan kelib chiqib berilmaydi).
 */
function daysSinceCreated(createdAt, nowMs) {
  if (!createdAt) return 0;
  const createdMs = typeof createdAt === "number" ? createdAt : new Date(createdAt).getTime();
  if (!Number.isFinite(createdMs) || createdMs <= 0 || createdMs > nowMs) return 0;
  return Math.floor((nowMs - createdMs) / DAY_MS);
}

/**
 * Tannarx asosida ruxsat etilgan ENG PAST narxni hisoblaydi.
 * `costPrice` berilmagan/0 bo'lsa, chegara qo'llanilmaydi (`null`).
 */
function computeMinAllowedPrice(costPrice) {
  const cost = Number(costPrice) || 0;
  if (cost <= 0) return null;
  return cost * (1 + MIN_MARGIN_PERCENT / 100);
}

/**
 * Berilgan mahsulotlar ro'yxatidan, HAR BIR kategoriya uchun narxlar
 * yig'indisi/sonini hisoblaydi. Faqat `category` va musbat `price`ga
 * ega mahsulotlar hisobga olinadi. Chaqiruvchi (`pricingSuggestions.js`)
 * buni BITTA sotuvchining BARCHA faol mahsulotlaridan bir marta
 * quradi, keyin har bir mahsulot uchun `getCategoryPriceContext`
 * chaqiradi — N ta mahsulot uchun N marta butun ro'yxatni qayta
 * skanerlashning oldini olish uchun.
 *
 * @param {Array<{category?:string, price?:number}>} products
 * @returns {Map<string, {sum:number, count:number}>}
 */
function buildCategoryPriceIndex(products) {
  const index = new Map();
  for (const p of Array.isArray(products) ? products : []) {
    const category = p?.category;
    const price = Number(p?.price) || 0;
    if (!category || price <= 0) continue;
    const entry = index.get(category) || { sum: 0, count: 0 };
    entry.sum += price;
    entry.count += 1;
    index.set(category, entry);
  }
  return index;
}

/**
 * Bitta mahsulot uchun, `buildCategoryPriceIndex` natijasidan, O'ZINI
 * HISOBGA OLMAGAN HOLDA (chunki index shu mahsulotning o'zini ham
 * o'z ichiga olgan bo'lishi mumkin), shu kategoriyadagi BOSHQA faol
 * mahsulotlarning o'rtacha narxini qaytaradi. Namuna hajmi
 * `CATEGORY_MIN_SAMPLE_SIZE`dan kam bo'lsa — `null` (statistik
 * jihatdan ishonchsiz).
 *
 * @param {{category?:string, price?:number}} product
 * @param {Map<string, {sum:number, count:number}>} categoryIndex
 * @returns {{avgPrice:number, sampleSize:number}|null}
 */
function getCategoryPriceContext(product, categoryIndex) {
  const category = product?.category;
  if (!category || !categoryIndex) return null;
  const entry = categoryIndex.get(category);
  if (!entry) return null;
  const ownPrice = Number(product?.price) || 0;
  const otherSum = entry.sum - (ownPrice > 0 ? ownPrice : 0);
  const otherCount = entry.count - (ownPrice > 0 ? 1 : 0);
  if (otherCount < CATEGORY_MIN_SAMPLE_SIZE) return null;
  return { avgPrice: otherSum / otherCount, sampleSize: otherCount };
}

/**
 * SOF FUNKSIYA — bitta mahsulot uchun narx tavsiyasini hisoblaydi.
 * Hech qanday aniq signal topilmasa `null` qaytaradi (HAR BIR
 * mahsulot uchun MAJBURIY tavsiya YO'Q — bu ham "hech narsa o'ylab
 * topilmaydi" tamoyilining bir qismi).
 *
 * @param {{price:number, costPrice?:number, stock:number, sold?:number, createdAt?:string|number, category?:string}} product
 * @param {number} nowMs
 * @param {{avgPrice:number, sampleSize:number}|null} [categoryContext] - `getCategoryPriceContext`dan, ixtiyoriy.
 * @returns {{type:"slow_mover_discount"|"high_demand_increase"|"category_price_high"|"category_price_low", currentPrice:number, suggestedPrice:number, changePercent:number, stock:number, sold:number, daysListed:number, categoryAvgPrice?:number, categorySampleSize?:number}|null}
 */
function computePricingSuggestion(product, nowMs = Date.now(), categoryContext = null) {
  const price = Number(product?.price) || 0;
  if (price <= 0) return null;
  const stock = Number(product?.stock) || 0;
  const sold = Number(product?.sold) || 0;
  const minAllowedPrice = computeMinAllowedPrice(product?.costPrice);
  const daysListed = daysSinceCreated(product?.createdAt, nowMs);

  const isSlowMover =
    daysListed >= SLOW_MOVER_MIN_AGE_DAYS && sold <= SLOW_MOVER_MAX_SOLD && stock >= SLOW_MOVER_MIN_STOCK;
  const isHighDemand =
    stock > 0 && stock <= HIGH_DEMAND_MAX_STOCK && sold >= HIGH_DEMAND_MIN_SOLD;

  if (isSlowMover) {
    let suggestedPrice = roundToNearestHundred(price * (1 - SLOW_MOVER_DISCOUNT_PERCENT / 100));
    if (minAllowedPrice != null) suggestedPrice = Math.max(suggestedPrice, roundToNearestHundred(minAllowedPrice));
    // Margin-chegarasi taklif qilinayotgan butun chegirmani "yeb
    // qo'ygan" bo'lishi mumkin (masalan tannarx narxga juda yaqin) —
    // bunday holda haqiqiy pasaytirish qolmagani uchun tavsiya
    // BERILMAYDI (soxta/mazmunsiz "tavsiya" ko'rsatmaslik uchun).
    if (suggestedPrice >= price) return null;
    const changePercent = Math.round(((suggestedPrice - price) / price) * 100);
    return { type: "slow_mover_discount", currentPrice: price, suggestedPrice, changePercent, stock, sold, daysListed };
  }

  if (isHighDemand) {
    const suggestedPrice = roundToNearestHundred(
      Math.min(price * (1 + HIGH_DEMAND_INCREASE_PERCENT / 100), price * (1 + MAX_PRICE_CHANGE_PERCENT / 100))
    );
    if (suggestedPrice <= price) return null;
    const changePercent = Math.round(((suggestedPrice - price) / price) * 100);
    return { type: "high_demand_increase", currentPrice: price, suggestedPrice, changePercent, stock, sold, daysListed };
  }

  // Yuqoridagi ikkalasi ham mos kelmadi (na "sekin sotiladi", na
  // "talab yuqori") — endi FAQAT sotuvchining o'z kategoriyasidagi
  // narxlar bilan ichki muvofiqlikni tekshiramiz. Zaxirasi tugagan
  // (`stock <= 0`) mahsulot uchun narx tavsiyasi ma'nosiz - o'tkazib
  // yuboriladi.
  if (stock > 0 && categoryContext && categoryContext.sampleSize >= CATEGORY_MIN_SAMPLE_SIZE && categoryContext.avgPrice > 0) {
    const { avgPrice, sampleSize } = categoryContext;
    const diffPercent = ((price - avgPrice) / avgPrice) * 100;
    const categoryAvgPrice = roundToNearestHundred(avgPrice);

    if (diffPercent >= CATEGORY_OUTLIER_THRESHOLD_PERCENT) {
      // Narx o'z kategoriyasidagi o'rtachadan SEZILARLI YUQORI -
      // o'rtachaga qarab pasaytirish taklif qilinadi, lekin bir
      // martada `MAX_PRICE_CHANGE_PERCENT`dan ko'p emas.
      const target = Math.max(avgPrice, price * (1 - MAX_PRICE_CHANGE_PERCENT / 100));
      let suggestedPrice = roundToNearestHundred(target);
      if (minAllowedPrice != null) suggestedPrice = Math.max(suggestedPrice, roundToNearestHundred(minAllowedPrice));
      if (suggestedPrice < price) {
        const changePercent = Math.round(((suggestedPrice - price) / price) * 100);
        return { type: "category_price_high", currentPrice: price, suggestedPrice, changePercent, stock, sold, daysListed, categoryAvgPrice, categorySampleSize: sampleSize };
      }
    } else if (diffPercent <= -CATEGORY_OUTLIER_THRESHOLD_PERCENT) {
      // Narx o'z kategoriyasidagi o'rtachadan SEZILARLI PAST -
      // o'rtachaga qarab oshirish taklif qilinadi (shu bilan birga
      // yetarli daromad qoldirilmoqda deb hisoblanadi, chunki bu
      // yerda margin-chegarasi emas, faqat o'sish tavsiya qilinadi).
      const target = Math.min(avgPrice, price * (1 + MAX_PRICE_CHANGE_PERCENT / 100));
      const suggestedPrice = roundToNearestHundred(target);
      if (suggestedPrice > price) {
        const changePercent = Math.round(((suggestedPrice - price) / price) * 100);
        return { type: "category_price_low", currentPrice: price, suggestedPrice, changePercent, stock, sold, daysListed, categoryAvgPrice, categorySampleSize: sampleSize };
      }
    }
  }

  return null;
}

module.exports = {
  DAY_MS,
  SLOW_MOVER_MIN_AGE_DAYS,
  SLOW_MOVER_MAX_SOLD,
  SLOW_MOVER_MIN_STOCK,
  SLOW_MOVER_DISCOUNT_PERCENT,
  HIGH_DEMAND_MAX_STOCK,
  HIGH_DEMAND_MIN_SOLD,
  HIGH_DEMAND_INCREASE_PERCENT,
  MIN_MARGIN_PERCENT,
  MAX_PRICE_CHANGE_PERCENT,
  CATEGORY_MIN_SAMPLE_SIZE,
  CATEGORY_OUTLIER_THRESHOLD_PERCENT,
  roundToNearestHundred,
  daysSinceCreated,
  computeMinAllowedPrice,
  buildCategoryPriceIndex,
  getCategoryPriceContext,
  computePricingSuggestion,
};
