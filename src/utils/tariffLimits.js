/**
 * Z-TARIFLAR (Z-Start / Z-Pro / Z-Biznes) — FRONTEND nusxasi.
 *
 * MUHIM: `functions/lib/tariffs.js` bilan ATAYLAB QAYTA YOZILGAN
 * (backend CommonJS, frontend ESM — ikkalasi bir xil modulni bevosita
 * bo'lisha olmaydi) — loyihada allaqachon o'rnatilgan "frontend+
 * backend duplikatsiyasi" naqshi (masalan `STAFF_BOT_USERNAME`).
 * Ikkalasi o'zgarsa, IKKALASINI HAM birga yangilash SHART. Bu fayl
 * HAQIQIY server-tomon tekshiruvi EMAS (haqiqiy tekshiruv —
 * Cloud Functions + `firestore.rules`da) — faqat UI'da chegaralarni
 * ko'rsatish/tezkor mijoz-tarafdagi xabar uchun.
 */

export const TARIFF_ORDER = ["start", "pro", "biznes"];

// `null` = cheksiz (∞).
export const TARIFF_LIMITS = {
  start: { maxStaff: 0, maxBanners: 3, maxActiveDiscounts: 3, maxCoupons: 0, aiCeoEnabled: false },
  pro: { maxStaff: 2, maxBanners: null, maxActiveDiscounts: null, maxCoupons: 3, aiCeoEnabled: true },
  biznes: { maxStaff: 5, maxBanners: null, maxActiveDiscounts: null, maxCoupons: null, aiCeoEnabled: true },
};

// `functions/lib/tariffs.js`ning ko'zgusi — backend bilan BIR XIL
// qiymatda ushlanishi SHART (2026-09: 5 kundan 7 kunga uzaytirildi).
export const TRIAL_DAYS = 7;
export const NEXT_TRIAL_TIER = { start: "pro", pro: "biznes" };

// HAQIQIY TO'LOV (ATMOS, 2026-09) — `functions/lib/tariffs.js`ning
// ko'zgusi, IKKALASI ham BIR XIL qiymatda ushlanishi SHART. Batafsil
// izoh — backend faylida.
export const TARIFF_MONTHLY_PRICE_SOM = { start: 49000, pro: 199000 };
export const TARIFF_BILLING_PERIOD_DAYS = 30;
export const TARIFF_BILLING_CUTOFF_MS = Date.parse("2026-09-11T00:00:00+05:00");
export const SIGNUP_GRACE_DAYS = TRIAL_DAYS;
const PURCHASABLE_TARIFFS = Object.keys(TARIFF_MONTHLY_PRICE_SOM);

export function normalizeTariffPlan(plan) {
  return TARIFF_ORDER.includes(plan) ? plan : "start";
}

function tariffRank(plan) {
  return TARIFF_ORDER.indexOf(normalizeTariffPlan(plan));
}

/**
 * Firestore Timestamp/ISO-satr/xom raqam — ISTALGAN shaklidagi vaqt
 * maydonini millisekundga aylantiradi (yo'q/noto'g'ri bo'lsa `0`).
 * Sabab (`tariffTrialExpiresAt` uchun ILGARI topilgan bug'ning umumiy
 * yechimi): 1) Firestore CLIENT SDK Timestamp obyekti (masalan admin
 * panelda to'g'ridan-to'g'ri `onSnapshot`/`getDoc` orqali o'qilganda);
 * 2) ISO sana satri — `verifyTelegramAuth` Cloud Function orqali kelgan
 * `store` shu shaklda keladi (`functions/lib/helpers.js`dagi
 * `sanitizeFirestoreData` HAR BIR Firestore Timestamp maydonini
 * `.toDate().toISOString()` satriga aylantiradi); 3) xom millisekund
 * (masalan frontend `patchStore`dan). `tariffTrialExpiresAt`, `createdAt`,
 * `tariffPaidUntil` — barchasi shu BITTA yordamchi orqali o'qiladi.
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

function trialExpiresAtMs(store) {
  return timestampToMillis(store?.tariffTrialExpiresAt);
}

export function getEffectiveTariffPlan(store, nowMs = Date.now()) {
  const basePlan = normalizeTariffPlan(store?.tariffPlan);
  const trialPlan = store?.tariffTrialPlan;
  if (
    store?.tariffTrialActive === true &&
    TARIFF_ORDER.includes(trialPlan) &&
    trialExpiresAtMs(store) > nowMs &&
    tariffRank(trialPlan) > tariffRank(basePlan)
  ) {
    return trialPlan;
  }
  return basePlan;
}

export function getTariffLimits(store, nowMs = Date.now()) {
  return TARIFF_LIMITS[getEffectiveTariffPlan(store, nowMs)];
}

export function isUnderLimit(count, max) {
  return max === null || max === undefined || Number(count) < max;
}

export function getNextTrialTier(basePlan) {
  return NEXT_TRIAL_TIER[normalizeTariffPlan(basePlan)] || null;
}

export function hasUsedTrial(store, plan) {
  const used = Array.isArray(store?.tariffTrialsUsed) ? store.tariffTrialsUsed : [];
  return used.includes(plan);
}

export function hasActiveTrial(store, nowMs = Date.now()) {
  return store?.tariffTrialActive === true && trialExpiresAtMs(store) > nowMs;
}

export function getTrialExpiresAtMs(store) {
  return trialExpiresAtMs(store);
}

/**
 * Bu sotuvchi YANGI billing rejimiga tushadimi (`createdAt` cutoff'dan
 * KEYIN ro'yxatdan o'tgan) — aks holda "grandfather" qilingan, to'lov
 * HECH QACHON talab qilinmaydi. Batafsil izoh — backend ko'zgusida
 * (`functions/lib/tariffs.js`).
 */
export function isBillingRequired(store) {
  const createdAtMs = timestampToMillis(store?.createdAt);
  return createdAtMs > 0 && createdAtMs >= TARIFF_BILLING_CUTOFF_MS;
}

export function getPaidUntilMs(store) {
  return timestampToMillis(store?.tariffPaidUntil);
}

function graceExpiresAtMs(store) {
  const createdAtMs = timestampToMillis(store?.createdAt);
  if (!createdAtMs) return 0;
  return createdAtMs + SIGNUP_GRACE_DAYS * 24 * 60 * 60 * 1000;
}

export function getGraceExpiresAtMs(store) {
  return graceExpiresAtMs(store);
}

/**
 * Bu sotuvchining to'lov MUDDATI O'TGANMI — `SellerLayout.jsx`
 * (panel bloki) va `TariffsSection.jsx` (banner) shu bittasiga qaraydi.
 */
export function isTariffPastDue(store, nowMs = Date.now()) {
  if (!isBillingRequired(store)) return false;
  if (hasActiveTrial(store, nowMs)) return false;
  const paid = getPaidUntilMs(store);
  if (paid > 0) return paid <= nowMs;
  return graceExpiresAtMs(store) <= nowMs;
}

/**
 * Bu tarifni HAQIQIY (Atmos orqali avtomatik) pulga sotib olish
 * mumkinmi. Hozircha faqat Z-Start/Z-Pro.
 */
export function isTariffPurchasable(plan) {
  return PURCHASABLE_TARIFFS.includes(plan);
}
