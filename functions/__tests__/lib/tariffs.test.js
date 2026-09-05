const {
  TARIFF_LIMITS,
  normalizeTariffPlan,
  getEffectiveTariffPlan,
  getTariffLimits,
  computeAiCeoEnabledForPlan,
  isUnderLimit,
  getNextTrialTier,
  hasUsedTrial,
  hasActiveTrial,
} = require("../../lib/tariffs");

describe("normalizeTariffPlan", () => {
  test("noto'g'ri/mavjud bo'lmagan qiymat uchun 'start' qaytaradi", () => {
    expect(normalizeTariffPlan(undefined)).toBe("start");
    expect(normalizeTariffPlan(null)).toBe("start");
    expect(normalizeTariffPlan("noto'g'ri")).toBe("start");
  });
  test("haqiqiy qiymatlarni o'zgarishsiz qaytaradi", () => {
    expect(normalizeTariffPlan("pro")).toBe("pro");
    expect(normalizeTariffPlan("biznes")).toBe("biznes");
  });
});

describe("getEffectiveTariffPlan", () => {
  const now = 1_000_000;

  test("sinov yo'q bo'lsa - bazaviy tarifni qaytaradi", () => {
    expect(getEffectiveTariffPlan({ tariffPlan: "start" }, now)).toBe("start");
    expect(getEffectiveTariffPlan({}, now)).toBe("start");
  });

  test("faol, tugamagan sinov bo'lsa - sinov tarifini qaytaradi", () => {
    const seller = { tariffPlan: "start", tariffTrialActive: true, tariffTrialPlan: "pro", tariffTrialExpiresAt: now + 1000 };
    expect(getEffectiveTariffPlan(seller, now)).toBe("pro");
  });

  test("sinov MUDDATI TUGAGAN bo'lsa - bazaviy tarifga qaytadi", () => {
    const seller = { tariffPlan: "start", tariffTrialActive: true, tariffTrialPlan: "pro", tariffTrialExpiresAt: now - 1000 };
    expect(getEffectiveTariffPlan(seller, now)).toBe("start");
  });

  test("sinov tarifi BAZAVIYDAN PAST/TENG bo'lsa - e'tiborga olinmaydi", () => {
    const seller = { tariffPlan: "pro", tariffTrialActive: true, tariffTrialPlan: "start", tariffTrialExpiresAt: now + 1000 };
    expect(getEffectiveTariffPlan(seller, now)).toBe("pro");
  });

  test("Firestore Timestamp shaklidagi (`toMillis`) muddatni ham to'g'ri o'qiydi", () => {
    const seller = {
      tariffPlan: "start",
      tariffTrialActive: true,
      tariffTrialPlan: "pro",
      tariffTrialExpiresAt: { toMillis: () => now + 5000 },
    };
    expect(getEffectiveTariffPlan(seller, now)).toBe("pro");
  });

  test("`tariffTrialActive` false bo'lsa - muddat kelajakda bo'lsa ham e'tiborga olinmaydi", () => {
    const seller = { tariffPlan: "start", tariffTrialActive: false, tariffTrialPlan: "pro", tariffTrialExpiresAt: now + 1000 };
    expect(getEffectiveTariffPlan(seller, now)).toBe("start");
  });
});

describe("getTariffLimits / computeAiCeoEnabledForPlan", () => {
  test("Z-Start: xodim 0, banner 3, aksiya 3, promo kod 0, AI CEO yo'q", () => {
    const limits = getTariffLimits({ tariffPlan: "start" });
    expect(limits).toEqual(TARIFF_LIMITS.start);
    expect(limits.maxStaff).toBe(0);
    expect(limits.maxBanners).toBe(3);
    expect(limits.maxActiveDiscounts).toBe(3);
    expect(limits.maxCoupons).toBe(0);
    expect(computeAiCeoEnabledForPlan("start")).toBe(false);
  });

  test("Z-Pro: xodim 2, banner/aksiya cheksiz, promo kod 3, AI CEO bor", () => {
    const limits = getTariffLimits({ tariffPlan: "pro" });
    expect(limits.maxStaff).toBe(2);
    expect(limits.maxBanners).toBeNull();
    expect(limits.maxActiveDiscounts).toBeNull();
    expect(limits.maxCoupons).toBe(3);
    expect(computeAiCeoEnabledForPlan("pro")).toBe(true);
  });

  test("Z-Biznes: xodim 5, hammasi cheksiz, AI CEO bor", () => {
    const limits = getTariffLimits({ tariffPlan: "biznes" });
    expect(limits.maxStaff).toBe(5);
    expect(limits.maxBanners).toBeNull();
    expect(limits.maxActiveDiscounts).toBeNull();
    expect(limits.maxCoupons).toBeNull();
    expect(computeAiCeoEnabledForPlan("biznes")).toBe(true);
  });
});

describe("isUnderLimit", () => {
  test("cheksiz (`null`) chegara uchun doim `true`", () => {
    expect(isUnderLimit(999999, null)).toBe(true);
  });
  test("chegaradan PAST bo'lsa - `true`", () => {
    expect(isUnderLimit(2, 3)).toBe(true);
  });
  test("chegaraga YETGAN bo'lsa - `false` (qat'iy kichik shart)", () => {
    expect(isUnderLimit(3, 3)).toBe(false);
  });
  test("chegaradan OSHGAN bo'lsa - `false`", () => {
    expect(isUnderLimit(5, 3)).toBe(false);
  });
});

describe("getNextTrialTier", () => {
  test("start -> pro, pro -> biznes, biznes -> yo'q (null)", () => {
    expect(getNextTrialTier("start")).toBe("pro");
    expect(getNextTrialTier("pro")).toBe("biznes");
    expect(getNextTrialTier("biznes")).toBeNull();
  });
});

describe("hasUsedTrial / hasActiveTrial", () => {
  test("hasUsedTrial - ro'yxatda bor/yo'qligini to'g'ri tekshiradi", () => {
    expect(hasUsedTrial({ tariffTrialsUsed: ["pro"] }, "pro")).toBe(true);
    expect(hasUsedTrial({ tariffTrialsUsed: ["pro"] }, "biznes")).toBe(false);
    expect(hasUsedTrial({}, "pro")).toBe(false);
  });

  test("hasActiveTrial - faqat `tariffTrialActive:true` VA muddat kelajakda bo'lsa `true`", () => {
    const now = 1_000_000;
    expect(hasActiveTrial({ tariffTrialActive: true, tariffTrialExpiresAt: now + 1000 }, now)).toBe(true);
    expect(hasActiveTrial({ tariffTrialActive: true, tariffTrialExpiresAt: now - 1000 }, now)).toBe(false);
    expect(hasActiveTrial({ tariffTrialActive: false, tariffTrialExpiresAt: now + 1000 }, now)).toBe(false);
    expect(hasActiveTrial({}, now)).toBe(false);
  });
});
