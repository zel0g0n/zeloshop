const { admin, db } = require("./lib/admin");

/**
 * AI CEO — avtonom "qaytarish" xabariga haqiqiy chegirma promokod
 * qo'shish qobiliyati.
 *
 * Arxitekturaviy ma'no: AI CEO'ning boshqa avtonom (Tier-1)
 * harakatlari faqat matn yozish/yuborish bilan cheklangan - moliyaviy
 * oqibati yo'q, to'liq qaytariladigan. Bu modul esa haqiqiy moliyaviy
 * oqibatga ega harakatga o'tadi - mijozga avtomatik, sotuvchi
 * tasdiqisiz haqiqiy chegirma promokod berish. Shu sababli bu yerda
 * ishonch zinapoyasi ancha qattiqroq:
 *
 *   1) Alohida opt-in: `aiCeoAutoDiscountEnabled === true` (standart
 *      holatda o'chiq) - `aiCeoAutoWinBackEnabled`dan mustaqil,
 *      qo'shimcha yoqilishi kerak bo'lgan sozlama, chunki "matnni AI
 *      yozsin" degani avtomatik "va pul chegirma bersin ham" degani
 *      emas.
 *   2) Bog'liqlik: faqat `aiCeoAutoWinBackEnabled === true` bo'lganda
 *      ishlaydi - avtomatik "qaytarish" xabarining kuchaytirilgan
 *      varianti, mustaqil funksiya emas.
 *   3) Isbotlangan natija asosida: faqat `aiCeoLearning.js`da
 *      yig'ilgan, kamida `MIN_SAMPLE_SIZE` namunali konversiya darajasi
 *      mavjud bo'lsagina (`recentPerformance !== null`) va bu daraja
 *      past (`AUTO_DISCOUNT_ELIGIBLE_MAX_CONVERSION_PERCENT`dan kam)
 *      bo'lsagina harakatga o'tadi - ya'ni AI matni yetarli darajada
 *      ishlamayapti degan isbot bo'lgandagina, keyingi, kuchliroq
 *      vosita (haqiqiy chegirma) qo'llaniladi. Matn allaqachon yaxshi
 *      ishlayotgan bo'lsa (yuqori konversiya), chegirma berilmaydi.
 *   4) Moliyaviy xavfni cheklash: faqat foiz (percent) turidagi
 *      chegirma qo'llaniladi (aniq summa - "fixed" - emas, chunki bu
 *      nazoratsiz moliyaviy ta'sir qilishi mumkin), qat'iy
 *      chegaralangan oralig'ida (`MIN_DISCOUNT_PERCENT`..
 *      `MAX_DISCOUNT_PERCENT`), bir martalik (`usageLimit: 1`), faqat
 *      o'sha bitta mijoz uchun (`rewardForClientId`), qisqa muddatli
 *      (`DISCOUNT_EXPIRY_DAYS`), va bitta ishga tushirishda bitta
 *      sotuvchi uchun maksimal sonli
 *      (`MAX_AUTO_DISCOUNTS_PER_SELLER_PER_RUN`) - kutilmagan xato
 *      bo'lsa ham zarar chegaralangan qoladi.
 *   5) Hallyutsinatsiya xavfi yo'q: promokod matnini Gemini/AI hech
 *      qachon o'ylab topmaydi. Promokod haqiqiy, deterministik (oddiy
 *      dastur kodi) tomonidan, `carts.js`dagi "tashlab ketilgan savat"
 *      chegirmasi bilan bir xil sxema bo'yicha yaratiladi - Gemini bu
 *      jarayonda ishtirok etmaydi (AI yozgan xabar matni -
 *      `aiCeo.js`dagi `craftWinBackMessage` - va chegirma qatori
 *      butunlay alohida, `engagementReminders.js`da birlashtiriladi).
 *   6) Shaffoflik: har bir avtomatik yaratilgan promokod oddiy, mavjud
 *      `sellers/{id}/coupons` kolleksiyasiga yoziladi - sotuvchi buni
 *      "Promokodlar" sahifasida (`MarketingCoupons.jsx`) maxsus belgi
 *      ("AI CEO qaytarish mukofoti") bilan, boshqa promokodlar kabi
 *      to'liq ko'rib, xohlasa o'chirib tashlashi mumkin. Bundan
 *      tashqari, kunlik hisobotda
 *      (`aiCeo.js`dagi `crmActivity.autoDiscountsIssuedCount`) va "AI
 *      CEO'dan so'rang" vositasida (`aiCeoAgent.js`dagi
 *      `get_recent_auto_discounts`) ham ko'rinadi.
 *
 * `maybeIssueAutoWinBackDiscount` xato tashlamaydi (ichki try/catch) -
 * chegirma yaratib bo'lmasa, asosiy xabar (matn) baribir yuboriladi,
 * faqat chegirmasiz - boshqa barcha avtonom funksiyalar kabi
 * (`aiCeoLearning.js`, `lib/dailyStats.js`).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// Sotuvchi tanlashi mumkin bo'lgan foiz oralig'i - ikkalasi ham
// "haddan tashqari" bo'lmasligi uchun qat'iy chegaralangan (juda kichik
// bo'lsa mijozni qiziqtirmaydi, juda katta bo'lsa moliyaviy xavfli).
const MIN_DISCOUNT_PERCENT = 5;
const MAX_DISCOUNT_PERCENT = 20;
const DEFAULT_DISCOUNT_PERCENT = 10;

// Promokod amal qilish muddati - `carts.js`dagi 24 soatlik
// "shoshilinchlik" muddatidan farqli: bu yerda mijoz allaqachon 30+
// kundan beri xarid qilmagan (shoshilinch emas, "uxlab qolgan"),
// shuning uchun ko'proq vaqt beriladi.
const DISCOUNT_EXPIRY_DAYS = 7;

// `aiCeo.js`dagi `buildRecentPerformanceLine`dagi "past natija"
// chegarasi (15%) bilan ataylab bir xil - AI matni yetarli emasligi
// ko'rsatuvchi bo'sag'a ikkala joyda ham bir xil.
const AUTO_DISCOUNT_ELIGIBLE_MAX_CONVERSION_PERCENT = 15;

// Bitta ishga tushirishda (`sendRepurchaseReminders`), bitta sotuvchi
// uchun berilishi mumkin bo'lgan maksimal avtomatik chegirmalar soni -
// `engagementReminders.js`dagi `MAX_ORDERS_PER_RUN`/
// `MAX_FAVORITES_PER_RUN` bilan bir xil xavfsizlik chegarasi naqshi,
// bu safar moliyaviy ta'sirni cheklash uchun.
const MAX_AUTO_DISCOUNTS_PER_SELLER_PER_RUN = 15;

function clampInt(value, fallback, min, max) {
  const n = Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback;
  return Math.min(Math.max(n, min), max);
}

/**
 * `carts.js`dagi `generateRecoveryCouponCode`ga o'xshash, lekin
 * ataylab boshqa prefiks bilan - sotuvchi "Promokodlar" ro'yxatida
 * ikkala avtomatik turni (savat qaytarish vs. AI CEO qaytarish)
 * vizual ajratishi uchun.
 */
function generateWinBackDiscountCode() {
  return `SOGINDIK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/**
 * Sof funksiya - "hozir avtomatik chegirma berilishi kerakmi" degan
 * qarorni Firestore yozuvisiz, mustaqil tekshirish/sinash mumkin
 * bo'lgan holda hisoblaydi (batafsil izoh - fayl boshida, 1-4 bandlar).
 *
 * @param {object} params
 * @param {object} params.seller - sotuvchi hujjati (`aiCeoAutoDiscountEnabled`, `aiCeoAutoWinBackEnabled`)
 * @param {{sentCount:number, convertedCount:number, conversionRatePercent:number}|null} params.recentPerformance
 * @param {number} params.issuedCountThisRun - shu ishga tushirishda, shu sotuvchi uchun ALLAQACHON berilgan chegirmalar soni
 */
function shouldIssueAutoWinBackDiscount({ seller, recentPerformance, issuedCountThisRun }) {
  if (!seller || seller.aiCeoAutoDiscountEnabled !== true) return false;
  if (seller.aiCeoAutoWinBackEnabled !== true) return false;
  if (!recentPerformance) return false;
  if (recentPerformance.conversionRatePercent >= AUTO_DISCOUNT_ELIGIBLE_MAX_CONVERSION_PERCENT) return false;
  if ((issuedCountThisRun || 0) >= MAX_AUTO_DISCOUNTS_PER_SELLER_PER_RUN) return false;
  return true;
}

/**
 * Yuqoridagi qarorni tekshiradi va, agar muvofiq bo'lsa, haqiqiy, bir
 * martalik promokodni `sellers/{sellerId}/coupons`ga yozadi -
 * `carts.js`dagi tashlab ketilgan savat mukofoti bilan bir xil hujjat
 * sxemasi (`isCartRecoveryReward` o'rniga `isAiCeoWinBackReward`).
 *
 * Xato tashlamaydi - muvaffaqiyatsiz bo'lsa `{issued:false}` qaytaradi,
 * chaqiruvchi tomon (`engagementReminders.js`) chegirmasiz, oddiy
 * xabar bilan davom etadi.
 *
 * @returns {Promise<{issued:boolean, code?:string, discountPercent?:number, expiresAtMs?:number}>}
 */
async function maybeIssueAutoWinBackDiscount({ sellerId, clientId, seller, recentPerformance, issuedCountThisRun }) {
  if (!shouldIssueAutoWinBackDiscount({ seller, recentPerformance, issuedCountThisRun })) {
    return { issued: false };
  }
  try {
    const discountPercent = clampInt(seller.aiCeoAutoDiscountPercent, DEFAULT_DISCOUNT_PERCENT, MIN_DISCOUNT_PERCENT, MAX_DISCOUNT_PERCENT);
    const code = generateWinBackDiscountCode();
    const expiresAtMs = Date.now() + DISCOUNT_EXPIRY_DAYS * DAY_MS;
    await db.collection("sellers").doc(sellerId).collection("coupons").doc(code).set({
      code,
      discountType: "percent",
      discountValue: discountPercent,
      expiresAt: new Date(expiresAtMs).toISOString(),
      usageLimit: 1,
      usedCount: 0,
      isActive: true,
      isAiCeoWinBackReward: true,
      rewardForClientId: clientId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
    });
    return { issued: true, code, discountPercent, expiresAtMs };
  } catch (err) {
    console.error(`AI CEO avtomatik chegirma yaratib bo'lmadi (sotuvchi ${sellerId}, mijoz ${clientId}):`, err);
    return { issued: false };
  }
}

exports.maybeIssueAutoWinBackDiscount = maybeIssueAutoWinBackDiscount;
exports.shouldIssueAutoWinBackDiscount = shouldIssueAutoWinBackDiscount;
exports.DISCOUNT_EXPIRY_DAYS = DISCOUNT_EXPIRY_DAYS;
exports.MIN_DISCOUNT_PERCENT = MIN_DISCOUNT_PERCENT;
exports.MAX_DISCOUNT_PERCENT = MAX_DISCOUNT_PERCENT;

exports._testables = {
  shouldIssueAutoWinBackDiscount,
  maybeIssueAutoWinBackDiscount,
  generateWinBackDiscountCode,
  clampInt,
  MIN_DISCOUNT_PERCENT,
  MAX_DISCOUNT_PERCENT,
  DEFAULT_DISCOUNT_PERCENT,
  DISCOUNT_EXPIRY_DAYS,
  AUTO_DISCOUNT_ELIGIBLE_MAX_CONVERSION_PERCENT,
  MAX_AUTO_DISCOUNTS_PER_SELLER_PER_RUN,
};
