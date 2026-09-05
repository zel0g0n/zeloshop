const {
  ACTION_REGISTRY,
  ActionValidationError,
  getActionDefinition,
  validateActionPayload,
  computePayloadHash,
  computeActionId,
  AD_CAMPAIGN_MIN_BUDGET,
  AD_CAMPAIGN_MAX_BUDGET,
  AD_CAMPAIGN_HIGH_RISK_BUDGET,
  AD_CAMPAIGN_HIGH_RISK_DISCOUNT_PERCENT,
} = require("../../lib/aiActionRegistry");
const { RISK_LEVELS } = require("../../lib/aiRiskEngine");

function validCrmPayload(overrides = {}) {
  return {
    segment: "vip", title: "Sarlavha", message: "Xabar matni",
    targetClientIds: ["c1", "c2"], dateId: "2026-08-23", ...overrides,
  };
}

function validAdPayload(overrides = {}) {
  return {
    segment: "vip", tag: null, budget: 500000, discountPercent: 10,
    title: "Aksiya", message: "Xabar matni", targetClientIds: ["c1", "c2"], dateId: "2026-08-23", ...overrides,
  };
}

describe("getActionDefinition", () => {
  test("ro'yxatdagi ikkala turni ham topadi", () => {
    expect(getActionDefinition("crmCampaign")).toBe(ACTION_REGISTRY.crmCampaign);
    expect(getActionDefinition("adCampaign")).toBe(ACTION_REGISTRY.adCampaign);
  });
  test("noma'lum turi uchun ActionValidationError tashlaydi", () => {
    expect(() => getActionDefinition("noMaLumTur")).toThrow(ActionValidationError);
  });
});

describe("validateActionPayload — crmCampaign", () => {
  test("to'g'ri payload'ni qabul qiladi", () => {
    expect(() => validateActionPayload("crmCampaign", validCrmPayload())).not.toThrow();
  });
  test("noto'g'ri segmentni rad etadi", () => {
    expect(() => validateActionPayload("crmCampaign", validCrmPayload({ segment: "all" }))).toThrow(ActionValidationError);
  });
  test("bo'sh title/message'ni rad etadi", () => {
    expect(() => validateActionPayload("crmCampaign", validCrmPayload({ title: "" }))).toThrow();
    expect(() => validateActionPayload("crmCampaign", validCrmPayload({ message: "" }))).toThrow();
  });
  test("bo'sh targetClientIds'ni rad etadi", () => {
    expect(() => validateActionPayload("crmCampaign", validCrmPayload({ targetClientIds: [] }))).toThrow();
  });
  test("noto'g'ri dateId formatini rad etadi", () => {
    expect(() => validateActionPayload("crmCampaign", validCrmPayload({ dateId: "23-08-2026" }))).toThrow();
  });
});

describe("validateActionPayload — adCampaign", () => {
  test("to'g'ri payload'ni qabul qiladi", () => {
    expect(() => validateActionPayload("adCampaign", validAdPayload())).not.toThrow();
  });
  test("segment PRIMARY_SEGMENT_KEYS yoki 'all' bo'lishi kerak", () => {
    expect(() => validateActionPayload("adCampaign", validAdPayload({ segment: "high_value" }))).not.toThrow();
    expect(() => validateActionPayload("adCampaign", validAdPayload({ segment: "all" }))).not.toThrow();
    expect(() => validateActionPayload("adCampaign", validAdPayload({ segment: "vip-noto'g'ri" }))).toThrow();
  });
  test("noto'g'ri tag'ni rad etadi, lekin null/undefined'ni qabul qiladi", () => {
    expect(() => validateActionPayload("adCampaign", validAdPayload({ tag: "noto'g'ri" }))).toThrow();
    expect(() => validateActionPayload("adCampaign", validAdPayload({ tag: "discount_hunter" }))).not.toThrow();
    expect(() => validateActionPayload("adCampaign", validAdPayload({ tag: undefined }))).not.toThrow();
  });
  test("byudjet chegaradan tashqarida bo'lsa rad etadi", () => {
    expect(() => validateActionPayload("adCampaign", validAdPayload({ budget: AD_CAMPAIGN_MIN_BUDGET - 1 }))).toThrow();
    expect(() => validateActionPayload("adCampaign", validAdPayload({ budget: AD_CAMPAIGN_MAX_BUDGET + 1 }))).toThrow();
  });
  test("chegirma foizi chegaradan tashqarida bo'lsa rad etadi", () => {
    expect(() => validateActionPayload("adCampaign", validAdPayload({ discountPercent: 4 }))).toThrow();
    expect(() => validateActionPayload("adCampaign", validAdPayload({ discountPercent: 31 }))).toThrow();
  });
});

describe("adCampaign classifyRisk — xavf klassifikatsiyasi", () => {
  test("standart holatda MEDIUM", () => {
    expect(ACTION_REGISTRY.adCampaign.classifyRisk(validAdPayload())).toBe(RISK_LEVELS.MEDIUM);
  });
  test("katta byudjet - HIGH", () => {
    expect(ACTION_REGISTRY.adCampaign.classifyRisk(validAdPayload({ budget: AD_CAMPAIGN_HIGH_RISK_BUDGET + 1 }))).toBe(RISK_LEVELS.HIGH);
  });
  test("yuqori chegirma foizi - HIGH", () => {
    expect(ACTION_REGISTRY.adCampaign.classifyRisk(validAdPayload({ discountPercent: AD_CAMPAIGN_HIGH_RISK_DISCOUNT_PERCENT + 1 }))).toBe(RISK_LEVELS.HIGH);
  });
  test("ko'p qabul qiluvchi - HIGH", () => {
    const manyIds = Array.from({ length: 1001 }, (_, i) => `c${i}`);
    expect(ACTION_REGISTRY.adCampaign.classifyRisk(validAdPayload({ targetClientIds: manyIds }))).toBe(RISK_LEVELS.HIGH);
  });
  test("crmCampaign HAR DOIM MEDIUM", () => {
    expect(ACTION_REGISTRY.crmCampaign.classifyRisk(validCrmPayload())).toBe(RISK_LEVELS.MEDIUM);
  });
});

describe("computePayloadHash", () => {
  test("kalitlar tartibidan QAT'IY NAZAR bir xil xesh qaytaradi", () => {
    const a = computePayloadHash({ x: 1, y: 2 });
    const b = computePayloadHash({ y: 2, x: 1 });
    expect(a).toBe(b);
    expect(a).toHaveLength(64); // SHA-256 hex
  });
  test("boshqa payload uchun boshqa xesh", () => {
    expect(computePayloadHash({ x: 1 })).not.toBe(computePayloadHash({ x: 2 }));
  });
});

describe("computeActionId — deterministik idempotensiya kaliti", () => {
  test("crmCampaign - bir xil kirish uchun bir xil ID", () => {
    const id1 = computeActionId("crmCampaign", { sellerId: "s1", payload: validCrmPayload() });
    const id2 = computeActionId("crmCampaign", { sellerId: "s1", payload: validCrmPayload() });
    expect(id1).toBe(id2);
    expect(id1).toBe("crm_vip_2026-08-23");
  });
  test("adCampaign - tag bilan/tagsiz alohida ID", () => {
    expect(computeActionId("adCampaign", { sellerId: "s1", payload: validAdPayload({ tag: null }) })).toBe("ad_vip_none_2026-08-23");
    expect(computeActionId("adCampaign", { sellerId: "s1", payload: validAdPayload({ tag: "high_intent" }) })).toBe("ad_vip_high_intent_2026-08-23");
  });
});
