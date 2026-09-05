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

export function normalizeTariffPlan(plan) {
  return TARIFF_ORDER.includes(plan) ? plan : "start";
}

function tariffRank(plan) {
  return TARIFF_ORDER.indexOf(normalizeTariffPlan(plan));
}

function trialExpiresAtMs(store) {
  const raw = store?.tariffTrialExpiresAt;
  if (!raw) return 0;
  if (typeof raw.toMillis === "function") return raw.toMillis();
  return Number(raw) || 0;
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
