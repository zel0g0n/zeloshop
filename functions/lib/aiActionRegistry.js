const crypto = require("crypto");
const { RISK_LEVELS, highestRiskLevel } = require("./aiRiskEngine");
const { PRIMARY_SEGMENT_KEYS, TAG_KEYS } = require("./customerIntelligence");

/**
 * AI CEO — SXEMA ASOSLI ACTION REGISTRY (Tool Catalog).
 *
 * ZeloShop — AI Business Operating System master prompti (E-bo'lim,
 * "ACTION CATALOG / TOOL REGISTRY"): AI FAQAT shu ro'yxatda ("whitelist")
 * mavjud, aniq sxemaga ega harakat turlarini taklif qila oladi. Har
 * bir yozuv PDF talab qilgan asosiy maydonlarni o'z ichiga oladi:
 * `id`/`name`/`description`/`riskLevel` (payload asosida hisoblanadi)/
 * `requiredPlan`/`limits`/`idempotencyStrategy`.
 *
 * MUHIM (haqiqiy qamrov): `requiredPermissions`/`supportedChannels`/
 * `cooldown`/`eligibilityRules`/`timeout`/`retryPolicy` kabi
 * PDF'dagi qo'shimcha maydonlar hozircha HAR BIR harakat turi uchun
 * bir xil (yoki qo'llanilmaydi) bo'lgani uchun keyingi bosqichga
 * qoldirilgan — soxta/qo'llanilmaydigan maydon qo'shish o'rniga,
 * HAQIQIY qo'llaniladigan qismlar (`validate`/`classifyRisk`/
 * `computeActionId`) to'liq, ishlaydigan holda qurilgan.
 *
 * Ikkita real, uchidan-uchiga ulangan harakat turi ro'yxatga olingan:
 *   - `crmCampaign` — mavjud (v39.14dan beri ishlab turgan) CRM segment
 *     kampaniyasi (`telegramApproval.js`), ENDI shu registry orqali
 *     validatsiya qilinadi (orqaga mos, xatti-harakati o'zgarmagan).
 *   - `adCampaign` — YANGI: "AI CEO'dan so'rang" chatidan (Z-Biznes,
 *     `aiCeoAgent.js`dagi `propose_ad_campaign`) AI o'zi TAKLIF qila
 *     oladigan, byudjet+segment asosidagi haqiqiy reklama kampaniyasi
 *     (promokod + CRM broadcast) — birinchi marta AI shunchaki
 *     JAVOB berish o'rniga, HAQIQIY ijro etiladigan harakat taklif
 *     qiladi (tasdiqlangandan keyin).
 */

const SEGMENT_ENUM = Object.freeze(["vip", "churn"]);
const AD_SEGMENT_ENUM = Object.freeze([...PRIMARY_SEGMENT_KEYS, "all"]);

// Xavfsizlik chegaralari — `aiCeoAgent.js`dagi READ-ONLY
// `plan_ad_campaign` vositasining (`AD_CAMPAIGN_MIN_BUDGET`/
// `AD_CAMPAIGN_MAX_BUDGET`) bilan ATAYLAB BIR XIL qiymatlar - shu
// vosita orqali hisoblangan reja to'g'ridan-to'g'ri shu registryga
// taklif sifatida yuborilishi mumkin bo'lishi uchun.
const AD_CAMPAIGN_MIN_BUDGET = 10_000;
const AD_CAMPAIGN_MAX_BUDGET = 100_000_000;
const AD_CAMPAIGN_MAX_RECIPIENTS = 5000;

// Chegirma foizi chegaralari - `aiCeoAutoDiscount.js`dagi Tier-1
// avtonom chegirma bilan BIR XIL PASTKI chegara (5%), lekin Z-Biznes
// sotuvchi TASDIQLAGAN, kattaroq qamrovli kampaniya ekanligi uchun
// YUQORI chegara biroz kengroq (30%) - haligacha qat'iy, real
// moliyaviy xavfni cheklovchi chegara (istalgan foiz emas).
const AD_CAMPAIGN_MIN_DISCOUNT_PERCENT = 5;
const AD_CAMPAIGN_MAX_DISCOUNT_PERCENT = 30;

// Xavf klassifikatsiyasi chegaralari (F-bo'lim misollariga mos: kichik
// aksiya/kampaniya - MEDIUM, "katta chegirma"/"katta marketing
// byudjeti" - HIGH).
const AD_CAMPAIGN_HIGH_RISK_BUDGET = 5_000_000; // so'm
const AD_CAMPAIGN_HIGH_RISK_DISCOUNT_PERCENT = 15;
const AD_CAMPAIGN_HIGH_RISK_RECIPIENT_COUNT = 1000;

class ActionValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ActionValidationError";
  }
}

function isNonEmptyString(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function isDateKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isStringArray(value, { minLength = 0, maxLength = Infinity } = {}) {
  return Array.isArray(value)
    && value.length >= minLength
    && value.length <= maxLength
    && value.every((item) => typeof item === "string" && item.length > 0);
}

// ---------------------------------------------------------------------
// crmCampaign — mavjud CRM segment kampaniyasi (`telegramApproval.js`).
// ---------------------------------------------------------------------

function validateCrmCampaignPayload(payload) {
  const p = payload || {};
  if (!SEGMENT_ENUM.includes(p.segment)) {
    throw new ActionValidationError(`crmCampaign: noto'g'ri segment (${p.segment})`);
  }
  if (!isNonEmptyString(p.title, 200)) {
    throw new ActionValidationError("crmCampaign: title noto'g'ri yoki bo'sh");
  }
  if (!isNonEmptyString(p.message, 2000)) {
    throw new ActionValidationError("crmCampaign: message noto'g'ri yoki bo'sh");
  }
  if (!isStringArray(p.targetClientIds, { minLength: 1, maxLength: AD_CAMPAIGN_MAX_RECIPIENTS })) {
    throw new ActionValidationError("crmCampaign: targetClientIds noto'g'ri (kamida 1, ko'pi bilan 5000 ta)");
  }
  if (!isDateKey(p.dateId)) {
    throw new ActionValidationError("crmCampaign: dateId noto'g'ri (YYYY-MM-DD kutilgan)");
  }
}

// ---------------------------------------------------------------------
// adCampaign — YANGI: AI CEO chatidan taklif qilinadigan reklama
// kampaniyasi (promokod + CRM broadcast).
// ---------------------------------------------------------------------

function validateAdCampaignPayload(payload) {
  const p = payload || {};
  if (!AD_SEGMENT_ENUM.includes(p.segment)) {
    throw new ActionValidationError(`adCampaign: noto'g'ri segment (${p.segment})`);
  }
  if (p.tag !== null && p.tag !== undefined && !TAG_KEYS.includes(p.tag)) {
    throw new ActionValidationError(`adCampaign: noto'g'ri tag (${p.tag})`);
  }
  if (!Number.isFinite(p.budget) || p.budget < AD_CAMPAIGN_MIN_BUDGET || p.budget > AD_CAMPAIGN_MAX_BUDGET) {
    throw new ActionValidationError(`adCampaign: budget chegaradan tashqarida (${AD_CAMPAIGN_MIN_BUDGET}-${AD_CAMPAIGN_MAX_BUDGET})`);
  }
  if (!Number.isFinite(p.discountPercent) || p.discountPercent < AD_CAMPAIGN_MIN_DISCOUNT_PERCENT || p.discountPercent > AD_CAMPAIGN_MAX_DISCOUNT_PERCENT) {
    throw new ActionValidationError(`adCampaign: discountPercent chegaradan tashqarida (${AD_CAMPAIGN_MIN_DISCOUNT_PERCENT}-${AD_CAMPAIGN_MAX_DISCOUNT_PERCENT})`);
  }
  if (!isNonEmptyString(p.title, 200)) {
    throw new ActionValidationError("adCampaign: title noto'g'ri yoki bo'sh");
  }
  if (!isNonEmptyString(p.message, 2000)) {
    throw new ActionValidationError("adCampaign: message noto'g'ri yoki bo'sh");
  }
  if (!isStringArray(p.targetClientIds, { minLength: 1, maxLength: AD_CAMPAIGN_MAX_RECIPIENTS })) {
    throw new ActionValidationError("adCampaign: targetClientIds noto'g'ri (kamida 1, ko'pi bilan 5000 ta)");
  }
  if (!isDateKey(p.dateId)) {
    throw new ActionValidationError("adCampaign: dateId noto'g'ri (YYYY-MM-DD kutilgan)");
  }
}

function classifyAdCampaignRisk(payload) {
  const signals = [RISK_LEVELS.MEDIUM]; // bu turdagi harakat HECH QACHON LOW emas (F-bo'lim misoliga mos)
  if (payload.budget > AD_CAMPAIGN_HIGH_RISK_BUDGET) signals.push(RISK_LEVELS.HIGH);
  if (payload.discountPercent > AD_CAMPAIGN_HIGH_RISK_DISCOUNT_PERCENT) signals.push(RISK_LEVELS.HIGH);
  if ((payload.targetClientIds || []).length > AD_CAMPAIGN_HIGH_RISK_RECIPIENT_COUNT) signals.push(RISK_LEVELS.HIGH);
  return highestRiskLevel(signals);
}

// ---------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------

const ACTION_REGISTRY = Object.freeze({
  crmCampaign: {
    id: "crmCampaign",
    name: "CRM segment kampaniyasi",
    description: "VIP yoki 'uxlab qolgan' mijozlar segmentiga tayyor kampaniya matnini yuboradi.",
    requiredPlan: null, // istalgan `aiCeoEnabled` sotuvchi (mavjud xatti-harakat)
    // Har doim MEDIUM - moliyaviy majburiyat yo'q (faqat xabar), lekin
    // mijozga to'g'ridan-to'g'ri yetib boradigan real xabar bo'lgani
        // uchun har doim sotuvchi tasdig'i kerak (mavjud xatti-harakat).
    classifyRisk: () => RISK_LEVELS.MEDIUM,
    autoExecuteEligible: false,
    validate: validateCrmCampaignPayload,
    computeActionId: ({ payload }) => `crm_${payload.segment}_${payload.dateId}`,
    limits: { maxTargetClientIds: AD_CAMPAIGN_MAX_RECIPIENTS },
  },
  adCampaign: {
    id: "adCampaign",
    name: "Reklama/CRM kampaniyasi (byudjet asosida)",
    description: "Byudjet va mijozlar segmenti asosida promokod yaratadi va CRM broadcast yuboradi.",
    requiredPlan: "biznes",
    classifyRisk: classifyAdCampaignRisk,
    autoExecuteEligible: false, // hech qachon LOW emas, shuning uchun bu bayroq amalda ta'sir qilmaydi - aniqlik uchun
    validate: validateAdCampaignPayload,
    computeActionId: ({ payload }) => `ad_${payload.segment}_${payload.tag || "none"}_${payload.dateId}`,
    limits: {
      maxTargetClientIds: AD_CAMPAIGN_MAX_RECIPIENTS,
      minBudget: AD_CAMPAIGN_MIN_BUDGET,
      maxBudget: AD_CAMPAIGN_MAX_BUDGET,
      minDiscountPercent: AD_CAMPAIGN_MIN_DISCOUNT_PERCENT,
      maxDiscountPercent: AD_CAMPAIGN_MAX_DISCOUNT_PERCENT,
    },
  },
});

/**
 * Ro'yxatdan harakat ta'rifini oladi. Noma'lum harakat turi uchun
 * XATO tashlaydi (PDF E-bo'lim: "Unknown action -> reject").
 */
function getActionDefinition(actionType) {
  const def = ACTION_REGISTRY[actionType];
  if (!def) {
    throw new ActionValidationError(`Noma'lum harakat turi (whitelist'da yo'q): ${actionType}`);
  }
  return def;
}

/**
 * Payload'ni ro'yxatdagi sxema bo'yicha tekshiradi. Noto'g'ri sxema
 * uchun XATO tashlaydi (PDF E-bo'lim: "Invalid schema -> reject").
 */
function validateActionPayload(actionType, payload) {
  const def = getActionDefinition(actionType);
  def.validate(payload);
  return def;
}

/**
 * Deterministik, barqaror (kalitlar tartibiga bog'liq bo'lmagan) JSON
 * ko'rinishidan SHA-256 xesh hisoblaydi — AUDIT LOG maqsadida:
 * tasdiqlangan/ijro etilgan payload keyinchalik "aynan shu payload
 * ko'rsatilgan va tasdiqlangan edi" deb tekshirilishi mumkin bo'lishi
 * uchun (PDF F-bo'lim: "payloadHash"). MUHIM (halollik chegarasi): bu
 * tizimda tasdiqlash so'rovi (`approveAction`) payload'ni QAYTA
 * yubormaydi (faqat `actionId`+`approve` bayrog'i) - shuning uchun bu
 * xesh "qayta yuborilgan boshqa payload'ni rad etish" (klassik replay
 * himoyasi) uchun EMAS, balki AUDIT DALILI sifatida ishlatiladi.
 */
function computePayloadHash(payload) {
  const canonical = JSON.stringify(payload, Object.keys(payload || {}).sort());
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
 * Harakat uchun DETERMINISTIK ID hisoblaydi — bir xil sotuvchi, bir
 * xil harakat turi, bir xil nishon (segment/tag) va bir xil kun
 * (`dateId`) uchun HAR DOIM bir xil ID qaytadi. Bu ID — bir vaqtning
 * o'zida IDEMPOTENSIYA KALITI ham hisoblanadi (PDF T-bo'lim:
 * "shopId + actionType + target + strategy + businessEventId"):
 * `createPendingAction` shu ID bo'yicha hujjatni OLDIN qidiradi -
 * agar allaqachon mavjud bo'lsa, YANGI hujjat yaratilmaydi (dublikat
 * kampaniya/promokod yaratilmaydi).
 */
function computeActionId(actionType, { sellerId, payload }) {
  const def = getActionDefinition(actionType);
  return def.computeActionId({ sellerId, payload });
}

module.exports = {
  ACTION_REGISTRY,
  ActionValidationError,
  getActionDefinition,
  validateActionPayload,
  computePayloadHash,
  computeActionId,
  AD_CAMPAIGN_MIN_BUDGET,
  AD_CAMPAIGN_MAX_BUDGET,
  AD_CAMPAIGN_MAX_RECIPIENTS,
  AD_CAMPAIGN_MIN_DISCOUNT_PERCENT,
  AD_CAMPAIGN_MAX_DISCOUNT_PERCENT,
  AD_CAMPAIGN_HIGH_RISK_BUDGET,
  AD_CAMPAIGN_HIGH_RISK_DISCOUNT_PERCENT,
  AD_CAMPAIGN_HIGH_RISK_RECIPIENT_COUNT,
  SEGMENT_ENUM,
  AD_SEGMENT_ENUM,
};
