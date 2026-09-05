/**
 * Z-TARIFLAR — Z-Start / Z-Pro / Z-Biznes tarif tuzilishi (2026-09,
 * "tarif tanlashni to'liq ishga tushir" bo'limi).
 *
 * BU FAYL — sof (Firestore'ga bevosita murojaat qilmaydigan) manba:
 * har bir tarifning HAQIQIY (kodda tekshiriladigan) chegaralari shu
 * yerda, BITTA joyda belgilanadi — `functions/tariffs.js`,
 * `functions/staff.js`, `functions/staffBot.js`, `functions/products.js`,
 * `functions/coupons.js` va `firestore.rules` (rules alohida tilda
 * yozilgani uchun, xuddi shu sonlar U YERDA ATAYLAB QAYTA
 * YOZILGAN — "frontend+backend duplikatsiyasi" naqshi, xuddi
 * `STAFF_BOT_USERNAME` bilan bir xil) HAMMASI shu jadvaldan foydalanadi.
 *
 * MUHIM (artefaktdagi jadvaldan, `/tmp/artifacts/z-tariflar.html`):
 * mahsulot/buyurtma soni chegaralari (30/80) ATAYLAB bu yerda YO'Q —
 * ular faqat ko'rsatish uchun, kodda HECH QACHON tekshirilmaydi
 * (foydalanuvchi bilan tasdiqlangan qaror). Bu yerda FAQAT haqiqiy
 * tekshiriladigan 4 ta chegara: xodim, banner, aksiya, promo kod — VA
 * AI CEO to'liq paketiga kirish.
 */

const TARIFF_ORDER = ["start", "pro", "biznes"];

// `null` = cheksiz (∞).
const TARIFF_LIMITS = {
  start: { maxStaff: 0, maxBanners: 3, maxActiveDiscounts: 3, maxCoupons: 0, aiCeoEnabled: false },
  pro: { maxStaff: 2, maxBanners: null, maxActiveDiscounts: null, maxCoupons: 3, aiCeoEnabled: true },
  biznes: { maxStaff: 5, maxBanners: null, maxActiveDiscounts: null, maxCoupons: null, aiCeoEnabled: true },
};

// Sinov (trial) — har bir tarif faqat KEYINGI (bir pog'ona yuqori)
// tarifni, 7 kunga, BIR MARTA sinab ko'rishi mumkin. (Ilgari 5 kun edi
// — sotuvchi Z-Pro'ning haqiqiy ta'mini his qilishi uchun 7 kunga
// uzaytirildi, 2026-09.)
const TRIAL_DAYS = 7;
const NEXT_TRIAL_TIER = { start: "pro", pro: "biznes" };

function normalizeTariffPlan(plan) {
  return TARIFF_ORDER.includes(plan) ? plan : "start";
}

function tariffRank(plan) {
  return TARIFF_ORDER.indexOf(normalizeTariffPlan(plan));
}

/**
 * Sotuvchi hujjatidan faol sinov muddatini (bor va HALI tugamagan
 * bo'lsa) millisekundda qaytaradi — aks holda `0`. Ikkala vaqt
 * shakli (Firestore `Timestamp` va oddiy raqam) qo'llab-quvvatlanadi
 * — sof funksiya sifatida test qilish osonroq bo'lishi uchun.
 */
function trialExpiresAtMs(sellerData) {
  const raw = sellerData?.tariffTrialExpiresAt;
  if (!raw) return 0;
  if (typeof raw.toMillis === "function") return raw.toMillis();
  return Number(raw) || 0;
}

/**
 * Sotuvchining HOZIRGI, HAQIQATAN amal qiladigan (bazaviy + faol
 * sinov hisobga olingan) tarifini hisoblaydi. Sinov FAQAT bazaviy
 * tarifdan YUQORI bo'lsagina samarali (masalan, Z-Pro sotuvchi
 * Z-Start'ni "sinab ko'rolmaydi" — ma'nosiz holat, lekin xavfsizlik
 * uchun ham himoyalangan).
 */
function getEffectiveTariffPlan(sellerData, nowMs = Date.now()) {
  const basePlan = normalizeTariffPlan(sellerData?.tariffPlan);
  const trialPlan = sellerData?.tariffTrialPlan;
  if (
    sellerData?.tariffTrialActive === true &&
    TARIFF_ORDER.includes(trialPlan) &&
    trialExpiresAtMs(sellerData) > nowMs &&
    tariffRank(trialPlan) > tariffRank(basePlan)
  ) {
    return trialPlan;
  }
  return basePlan;
}

function getTariffLimits(sellerData, nowMs = Date.now()) {
  return TARIFF_LIMITS[getEffectiveTariffPlan(sellerData, nowMs)];
}

function computeAiCeoEnabledForPlan(plan) {
  return TARIFF_LIMITS[normalizeTariffPlan(plan)].aiCeoEnabled;
}

/**
 * `count < max` — `max === null` bo'lsa (cheksiz), doim `true`.
 * "Yana bittasini qo'shish mumkinmi?" degan savolga javob beradi.
 */
function isUnderLimit(count, max) {
  return max === null || max === undefined || Number(count) < max;
}

/**
 * Keyingi (bir pog'ona yuqori) tarif — sinov uchun. Yo'q bo'lsa
 * (allaqachon eng yuqori tarif) `null`.
 */
function getNextTrialTier(basePlan) {
  return NEXT_TRIAL_TIER[normalizeTariffPlan(basePlan)] || null;
}

/**
 * Bu sotuvchi berilgan tarifni ALLAQACHON sinab ko'rganmi (bir
 * martalik cheklov).
 */
function hasUsedTrial(sellerData, plan) {
  const used = Array.isArray(sellerData?.tariffTrialsUsed) ? sellerData.tariffTrialsUsed : [];
  return used.includes(plan);
}

function hasActiveTrial(sellerData, nowMs = Date.now()) {
  return sellerData?.tariffTrialActive === true && trialExpiresAtMs(sellerData) > nowMs;
}

module.exports = {
  TARIFF_ORDER,
  TARIFF_LIMITS,
  TRIAL_DAYS,
  NEXT_TRIAL_TIER,
  normalizeTariffPlan,
  tariffRank,
  trialExpiresAtMs,
  getEffectiveTariffPlan,
  getTariffLimits,
  computeAiCeoEnabledForPlan,
  isUnderLimit,
  getNextTrialTier,
  hasUsedTrial,
  hasActiveTrial,
};
