import { describe, test, expect } from "vitest";
import {
  TARIFF_LIMITS,
  normalizeTariffPlan,
  getEffectiveTariffPlan,
  getTariffLimits,
  isUnderLimit,
  getNextTrialTier,
  hasUsedTrial,
  hasActiveTrial,
} from "./tariffLimits";

describe("normalizeTariffPlan", () => {
  test("noto'g'ri qiymat uchun 'start' qaytaradi", () => {
    expect(normalizeTariffPlan(undefined)).toBe("start");
    expect(normalizeTariffPlan("random")).toBe("start");
  });
  test("haqiqiy qiymatlarni saqlaydi", () => {
    expect(normalizeTariffPlan("pro")).toBe("pro");
    expect(normalizeTariffPlan("biznes")).toBe("biznes");
  });
});

describe("getEffectiveTariffPlan", () => {
  const now = 1_000_000;

  test("sinov yo'q - bazaviy tarif", () => {
    expect(getEffectiveTariffPlan({ tariffPlan: "start" }, now)).toBe("start");
  });

  test("faol sinov - sinov tarifi ustun", () => {
    expect(
      getEffectiveTariffPlan({ tariffPlan: "start", tariffTrialActive: true, tariffTrialPlan: "pro", tariffTrialExpiresAt: now + 1000 }, now)
    ).toBe("pro");
  });

  test("muddati tugagan sinov - bazaviy tarifga qaytadi", () => {
    expect(
      getEffectiveTariffPlan({ tariffPlan: "start", tariffTrialActive: true, tariffTrialPlan: "pro", tariffTrialExpiresAt: now - 1000 }, now)
    ).toBe("start");
  });
});

describe("getTariffLimits", () => {
  test("Z-Start / Z-Pro / Z-Biznes limitlari to'g'ri", () => {
    expect(getTariffLimits({ tariffPlan: "start" })).toEqual(TARIFF_LIMITS.start);
    expect(getTariffLimits({ tariffPlan: "pro" })).toEqual(TARIFF_LIMITS.pro);
    expect(getTariffLimits({ tariffPlan: "biznes" })).toEqual(TARIFF_LIMITS.biznes);
  });
});

describe("isUnderLimit", () => {
  test("cheksiz (null) uchun doim true", () => {
    expect(isUnderLimit(100, null)).toBe(true);
  });
  test("chegara ustida/ostida to'g'ri ishlaydi", () => {
    expect(isUnderLimit(2, 3)).toBe(true);
    expect(isUnderLimit(3, 3)).toBe(false);
  });
});

describe("getNextTrialTier / hasUsedTrial / hasActiveTrial", () => {
  test("keyingi tarifni to'g'ri qaytaradi", () => {
    expect(getNextTrialTier("start")).toBe("pro");
    expect(getNextTrialTier("pro")).toBe("biznes");
    expect(getNextTrialTier("biznes")).toBeNull();
  });

  test("hasUsedTrial ro'yxatni to'g'ri tekshiradi", () => {
    expect(hasUsedTrial({ tariffTrialsUsed: ["pro"] }, "pro")).toBe(true);
    expect(hasUsedTrial({}, "pro")).toBe(false);
  });

  test("hasActiveTrial faqat faol VA tugamagan sinovda true", () => {
    const now = 1_000_000;
    expect(hasActiveTrial({ tariffTrialActive: true, tariffTrialExpiresAt: now + 1 }, now)).toBe(true);
    expect(hasActiveTrial({ tariffTrialActive: true, tariffTrialExpiresAt: now - 1 }, now)).toBe(false);
  });
});
