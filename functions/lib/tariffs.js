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

/**
 * HAQIQIY TO'LOV (ATMOS) — 2026-09, "tarif to'lov tizimini ishga
 * tushirish" bo'limi.
 *
 * Faqat Z-Start va Z-Pro haqiqiy (Atmos orqali avtomatik) to'lovga ega
 * — Z-Biznes hamon "ishlab chiqilmoqda" (narx yakunlanmagan,
 * `TariffsSection.jsx`dagi `inDevelopment` bayrog'i), shuning uchun
 * bu jadvalda YO'Q — sotuvchi hamon faqat "qiziqish bildirish" orqali
 * murojaat qiladi.
 *
 * TO'LOV DAVRI: FAQAT OYLIK (foydalanuvchi bilan tasdiqlangan qaror —
 * "qo'lda yangilash", karta saqlanmaydi). Chorak/yarim yil/yillik
 * chegirmali narxlar (`tariffs.planProPriceYear` va h.k., UI'da
 * ko'rsatiladi) hozircha FAQAT ma'lumot uchun — ularga real to'lov
 * keyinroq, alohida qo'shilishi mumkin.
 */
const TARIFF_MONTHLY_PRICE_SOM = { start: 49000, pro: 199000 };
const TARIFF_BILLING_PERIOD_DAYS = 30;
const PURCHASABLE_TARIFFS = Object.keys(TARIFF_MONTHLY_PRICE_SOM);

/**
 * BILLING CUTOFF (2026-09): Z-Start ENDI pullik, LEKIN foydalanuvchi
 * bilan tasdiqlangan qaror bo'yicha — FAQAT shu sanadan KEYIN
 * ro'yxatdan o'tgan (yangi) sotuvchilarga qo'llanadi. Bu sanadan OLDIN
 * yaratilgan (allaqachon bepul Z-Start'da ishlayotgan) sotuvchilar
 * "grandfather" qilinadi — ular uchun to'lov HECH QACHON talab
 * qilinmaydi (agar kelajakda administrator buni alohida o'zgartirmasa).
 *
 * NEGA "flag" EMAS, SANA: sotuvchi hujjatini yaratuvchi yozuv
 * (`src/services/sellers/createSeller.js`) — TO'G'RIDAN-TO'G'RI
 * mijoz(client) SDK orqali (`firestore.rules`dagi `allow create`
 * boshqa maydonlarni tekshirmaydi) — shuning uchun mijoz o'zi
 * "tariffBillingRequired: false" kabi bayroqni yozib, to'lovdan
 * qochib qutulishi mumkin edi. `createdAt` esa HAR DOIM
 * `serverTimestamp()` (Firestore server vaqti, mijoz SOXTALASHTIRA
 * OLMAYDI) — shuning uchun sana chegarasi YAGONA ishonchli, xavfsiz
 * mezon.
 */
const TARIFF_BILLING_CUTOFF_MS = Date.parse("2026-09-11T00:00:00+05:00");

// Billing talab qilinadigan (yangi) sotuvchi uchun: ro'yxatdan o'tgandan
// keyingi BIRINCHI 7 kun — hech qanday to'lovsiz, to'liq Z-Start
// funksionalligi bilan bepul (avtomatik, tugma bosish shart emas).
const SIGNUP_GRACE_DAYS = TRIAL_DAYS;

function normalizeTariffPlan(plan) {
  return TARIFF_ORDER.includes(plan) ? plan : "start";
}

function tariffRank(plan) {
  return TARIFF_ORDER.indexOf(normalizeTariffPlan(plan));
}

/**
 * Firestore Timestamp/ISO-satr/xom raqam — ISTALGAN shaklidagi vaqt
 * maydonini millisekundga aylantiradi (yo'q/noto'g'ri bo'lsa `0`).
 * `tariffTrialExpiresAt`, `createdAt`, `tariffPaidUntil` — barchasi
 * shu BITTA yordamchi orqali o'qiladi.
 */
function timestampToMillis(raw) {
  if (!raw) return 0;
  if (typeof raw.toMillis === "function") return raw.toMillis();
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return Number(raw) || 0;
}

/**
 * Sotuvchi hujjatidan faol sinov muddatini (bor va HALI tugamagan
 * bo'lsa) millisekundda qaytaradi — aks holda `0`.
 */
function trialExpiresAtMs(sellerData) {
  return timestampToMillis(sellerData?.tariffTrialExpiresAt);
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

/**
 * Bu sotuvchi YANGI billing rejimiga tushadimi (`createdAt` cutoff'dan
 * KEYIN) — aks holda "grandfather" qilingan, to'lov HECH QACHON talab
 * qilinmaydi.
 */
function isBillingRequired(sellerData) {
  const createdAtMs = timestampToMillis(sellerData?.createdAt);
  return createdAtMs > 0 && createdAtMs >= TARIFF_BILLING_CUTOFF_MS;
}

/**
 * Joriy TO'LANGAN muddat (haqiqiy Atmos to'lovi orqali uzaytirilgan)
 * millisekundda — hali hech qachon to'lanmagan bo'lsa `0`.
 */
function paidUntilMs(sellerData) {
  return timestampToMillis(sellerData?.tariffPaidUntil);
}

/**
 * Ro'yxatdan o'tgandan keyingi BEPUL "sinov" darchasi (avtomatik, 7
 * kun, tugma bosish shart emas) tugaydigan vaqt — `createdAt` yo'q
 * bo'lsa `0`.
 */
function graceExpiresAtMs(sellerData) {
  const createdAtMs = timestampToMillis(sellerData?.createdAt);
  if (!createdAtMs) return 0;
  return createdAtMs + SIGNUP_GRACE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Bu sotuvchining to'lov MUDDATI O'TGANMI (haqiqiy to'siq — sotuvchi
 * paneli shu asosda bloklanadi, `SellerLayout.jsx`).
 *
 * "Grandfather" qilingan (billing talab qilinmaydigan) sotuvchilar
 * uchun HAR DOIM `false`. Yuqori tarifni sinayotgan (`tariffTrialActive`,
 * masalan Z-Pro'ni 7 kun sinash) sotuvchi ham himoyalangan — sinov
 * paytida Z-Start to'lovi so'ralmaydi.
 */
function isTariffPastDue(sellerData, nowMs = Date.now()) {
  if (!isBillingRequired(sellerData)) return false;
  if (hasActiveTrial(sellerData, nowMs)) return false;
  const paid = paidUntilMs(sellerData);
  if (paid > 0) return paid <= nowMs;
  return graceExpiresAtMs(sellerData) <= nowMs;
}

/**
 * Bu tarifni HAQIQIY (Atmos orqali avtomatik) pulga sotib olish
 * mumkinmi. Hozircha faqat Z-Start/Z-Pro — Z-Biznes hamon "qiziqish
 * bildirish" orqali (`inDevelopment`).
 */
function isTariffPurchasable(plan) {
  return PURCHASABLE_TARIFFS.includes(plan);
}

module.exports = {
  TARIFF_ORDER,
  TARIFF_LIMITS,
  TRIAL_DAYS,
  NEXT_TRIAL_TIER,
  TARIFF_MONTHLY_PRICE_SOM,
  TARIFF_BILLING_PERIOD_DAYS,
  TARIFF_BILLING_CUTOFF_MS,
  SIGNUP_GRACE_DAYS,
  normalizeTariffPlan,
  tariffRank,
  timestampToMillis,
  trialExpiresAtMs,
  getEffectiveTariffPlan,
  getTariffLimits,
  computeAiCeoEnabledForPlan,
  isUnderLimit,
  getNextTrialTier,
  hasUsedTrial,
  hasActiveTrial,
  isBillingRequired,
  paidUntilMs,
  graceExpiresAtMs,
  isTariffPastDue,
  isTariffPurchasable,
};
