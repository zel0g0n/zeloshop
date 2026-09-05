const {
  RISK_LEVELS,
  isValidRiskLevel,
  isAtLeastAsRisky,
  highestRiskLevel,
  getApprovalPolicy,
} = require("../../lib/aiRiskEngine");

describe("isValidRiskLevel / isAtLeastAsRisky", () => {
  test("uchta darajani ham haqiqiy deb taniydi", () => {
    expect(isValidRiskLevel(RISK_LEVELS.LOW)).toBe(true);
    expect(isValidRiskLevel(RISK_LEVELS.MEDIUM)).toBe(true);
    expect(isValidRiskLevel(RISK_LEVELS.HIGH)).toBe(true);
    expect(isValidRiskLevel("NOTOGRI")).toBe(false);
  });

  test("darajalarni to'g'ri tartibda solishtiradi", () => {
    expect(isAtLeastAsRisky(RISK_LEVELS.HIGH, RISK_LEVELS.LOW)).toBe(true);
    expect(isAtLeastAsRisky(RISK_LEVELS.MEDIUM, RISK_LEVELS.MEDIUM)).toBe(true);
    expect(isAtLeastAsRisky(RISK_LEVELS.LOW, RISK_LEVELS.HIGH)).toBe(false);
  });

  test("noto'g'ri daraja bilan chaqirilsa xato tashlaydi", () => {
    expect(() => isAtLeastAsRisky("NOTOGRI", RISK_LEVELS.LOW)).toThrow();
  });
});

describe("highestRiskLevel", () => {
  test("bir nechta signaldan ENG YUQORISINI tanlaydi", () => {
    expect(highestRiskLevel([RISK_LEVELS.LOW, RISK_LEVELS.MEDIUM])).toBe(RISK_LEVELS.MEDIUM);
    expect(highestRiskLevel([RISK_LEVELS.MEDIUM, RISK_LEVELS.HIGH, RISK_LEVELS.LOW])).toBe(RISK_LEVELS.HIGH);
  });
  test("bo'sh yoki noto'g'ri ro'yxat uchun LOW qaytaradi", () => {
    expect(highestRiskLevel([])).toBe(RISK_LEVELS.LOW);
    expect(highestRiskLevel(undefined)).toBe(RISK_LEVELS.LOW);
    expect(highestRiskLevel(["NOTOGRI"])).toBe(RISK_LEVELS.LOW);
  });
});

describe("getApprovalPolicy", () => {
  test("HIGH - har doim tasdiq talab qiladi, avtomatik ijro HECH QACHON", () => {
    expect(getApprovalPolicy(RISK_LEVELS.HIGH)).toEqual({ autoExecuteAllowed: false, alwaysRequireApproval: true });
    expect(getApprovalPolicy(RISK_LEVELS.HIGH, { allowAutoExecute: true })).toEqual({ autoExecuteAllowed: false, alwaysRequireApproval: true });
  });

  test("MEDIUM - standart tasdiq kerak, lekin 'har doim' bayrog'i yo'q", () => {
    expect(getApprovalPolicy(RISK_LEVELS.MEDIUM)).toEqual({ autoExecuteAllowed: false, alwaysRequireApproval: false });
  });

  test("LOW - siyosat ruxsat bersa avtomatik ijro mumkin", () => {
    expect(getApprovalPolicy(RISK_LEVELS.LOW)).toEqual({ autoExecuteAllowed: true, alwaysRequireApproval: false });
    expect(getApprovalPolicy(RISK_LEVELS.LOW, { allowAutoExecute: false })).toEqual({ autoExecuteAllowed: false, alwaysRequireApproval: false });
  });

  test("noma'lum xavf darajasi uchun xato tashlaydi", () => {
    expect(() => getApprovalPolicy("NOTOGRI")).toThrow(/Noma'lum xavf darajasi/);
  });
});
