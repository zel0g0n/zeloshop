/**
 * AI CEO — RISK LEVEL va APPROVAL siyosati.
 *
 * ZeloShop — AI Business Operating System master prompti (F-bo'lim,
 * "RISK LEVEL VA APPROVAL ENGINE"): har bir AI harakati 3 ta xavf
 * darajasidan biriga tegishli, va har bir daraja o'zining tasdiqlash
 * siyosatiga ega:
 *
 *   LOW    -> siyosat ruxsat bersa, avtomatik ijro (auto-execute) mumkin.
 *   MEDIUM -> standart holatda sotuvchi tasdig'i kerak.
 *   HIGH   -> HAR DOIM sotuvchi tasdig'i kerak (siyosat bilan ham
 *             chetlab o'tib bo'lmaydi).
 *
 * Har bir HARAKAT TURI o'z xavf darajasini o'zi (payload asosida)
 * hisoblaydi (`functions/lib/aiActionRegistry.js`dagi `classifyRisk`)
 * — bu modul FAQAT darajalarning o'zini va ularga mos siyosatni
 * belgilaydi, harakatga xos mantiqni EMAS (bu ajratish, keyinchalik
 * yangi harakat turi qo'shilganda, siyosatni qayta yozishni talab
 * qilmaydi).
 */

const RISK_LEVELS = Object.freeze({
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
});

const RISK_ORDER = Object.freeze({
  [RISK_LEVELS.LOW]: 0,
  [RISK_LEVELS.MEDIUM]: 1,
  [RISK_LEVELS.HIGH]: 2,
});

function isValidRiskLevel(level) {
  return Object.prototype.hasOwnProperty.call(RISK_ORDER, level);
}

/**
 * `a` xavf darajasi `b`dan yuqorimi (yoki tengmi)ni solishtiradi.
 * Masalan bir nechta signal orqali hisoblangan xavfning ENG
 * YUQORISINI tanlashda ishlatiladi (`aiActionRegistry.js`).
 */
function isAtLeastAsRisky(a, b) {
  if (!isValidRiskLevel(a) || !isValidRiskLevel(b)) {
    throw new Error(`Noto'g'ri xavf darajasi taqqoslanmoqda: ${a} / ${b}`);
  }
  return RISK_ORDER[a] >= RISK_ORDER[b];
}

/**
 * Ikkita (yoki undan ko'p) xavf darajasidan ENG YUQORISINI qaytaradi -
 * bir nechta mustaqil signal (masalan "byudjet katta" VA "chegirma
 * foizi yuqori") bo'lsa, ENG XAVFLI signal g'alaba qiladi (siyosat
 * hech qachon kamroq ehtiyotkor bo'lmasligi kerak).
 */
function highestRiskLevel(levels) {
  const valid = (levels || []).filter(isValidRiskLevel);
  if (valid.length === 0) return RISK_LEVELS.LOW;
  return valid.reduce((max, level) => (isAtLeastAsRisky(level, max) ? level : max), RISK_LEVELS.LOW);
}

/**
 * Berilgan xavf darajasi uchun tasdiqlash siyosatini qaytaradi.
 *
 * @param {string} riskLevel
 * @param {{allowAutoExecute?: boolean}} [options] - harakat TURINING
 *   o'zi ("bu turdagi harakat umuman avtomatik ijroga LOYIQMI") LOW
 *   bo'lganda ham avtomatik ijroga ruxsat bermasligi mumkin
 *   (`aiActionRegistry.js`dagi `autoExecuteEligible: false`) - standart
 *   holatda `true` (LOW xavfli harakat, boshqacha ko'rsatilmasa,
 *   avtomatik ijro qilinishi mumkin).
 * @returns {{autoExecuteAllowed: boolean, alwaysRequireApproval: boolean}}
 */
function getApprovalPolicy(riskLevel, options = {}) {
  if (!isValidRiskLevel(riskLevel)) {
    throw new Error(`Noma'lum xavf darajasi: ${riskLevel}`);
  }
  const allowAutoExecute = options.allowAutoExecute !== false;

  if (riskLevel === RISK_LEVELS.HIGH) {
    return { autoExecuteAllowed: false, alwaysRequireApproval: true };
  }
  if (riskLevel === RISK_LEVELS.MEDIUM) {
    return { autoExecuteAllowed: false, alwaysRequireApproval: false };
  }
  // LOW
  return { autoExecuteAllowed: allowAutoExecute, alwaysRequireApproval: false };
}

module.exports = {
  RISK_LEVELS,
  isValidRiskLevel,
  isAtLeastAsRisky,
  highestRiskLevel,
  getApprovalPolicy,
};
