/**
 * `aiCeoAutoDiscount.js` uchun testlar (AI CEO — 8-BOSQICH: "avtonom
 * harakatlar doirasini kengaytirish").
 */

function buildMockDb({ setShouldThrow = false } = {}) {
  const couponSetCalls = [];
  return {
    collection: (name) => {
      if (name !== "sellers") throw new Error(`Kutilmagan kolleksiya: ${name}`);
      return {
        doc: () => ({
          collection: (subName) => {
            if (subName !== "coupons") throw new Error(`Kutilmagan quyi kolleksiya: ${subName}`);
            return {
              doc: (code) => ({
                set: async (data) => {
                  if (setShouldThrow) throw new Error("Firestore vaqtincha ishlamayapti");
                  couponSetCalls.push({ code, data });
                },
              }),
            };
          },
        }),
      };
    },
    __couponSetCalls: couponSetCalls,
  };
}

function loadModule(db) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: { firestore: { FieldValue: { serverTimestamp: () => "MOCK_TS" } } },
    db,
  }));
  return require("../aiCeoAutoDiscount");
}

describe("shouldIssueAutoWinBackDiscount", () => {
  const GOOD_PERFORMANCE = { sentCount: 10, convertedCount: 1, conversionRatePercent: 10 }; // past
  const HIGH_PERFORMANCE = { sentCount: 10, convertedCount: 5, conversionRatePercent: 50 }; // yaxshi

  test("seller.aiCeoAutoDiscountEnabled !== true bo'lsa - false", () => {
    const { shouldIssueAutoWinBackDiscount } = loadModule(buildMockDb());
    const seller = { aiCeoAutoWinBackEnabled: true };
    expect(shouldIssueAutoWinBackDiscount({ seller, recentPerformance: GOOD_PERFORMANCE, issuedCountThisRun: 0 })).toBe(false);
  });

  test("seller.aiCeoAutoWinBackEnabled !== true bo'lsa (bog'liqlik) - false", () => {
    const { shouldIssueAutoWinBackDiscount } = loadModule(buildMockDb());
    const seller = { aiCeoAutoDiscountEnabled: true };
    expect(shouldIssueAutoWinBackDiscount({ seller, recentPerformance: GOOD_PERFORMANCE, issuedCountThisRun: 0 })).toBe(false);
  });

  test("recentPerformance null bo'lsa (isbotlangan tarix yo'q) - false", () => {
    const { shouldIssueAutoWinBackDiscount } = loadModule(buildMockDb());
    const seller = { aiCeoAutoDiscountEnabled: true, aiCeoAutoWinBackEnabled: true };
    expect(shouldIssueAutoWinBackDiscount({ seller, recentPerformance: null, issuedCountThisRun: 0 })).toBe(false);
  });

  test("konversiya darajasi ALLAQACHON yaxshi bo'lsa (>=15%) - false", () => {
    const { shouldIssueAutoWinBackDiscount } = loadModule(buildMockDb());
    const seller = { aiCeoAutoDiscountEnabled: true, aiCeoAutoWinBackEnabled: true };
    expect(shouldIssueAutoWinBackDiscount({ seller, recentPerformance: HIGH_PERFORMANCE, issuedCountThisRun: 0 })).toBe(false);
  });

  test("15% chegara qiymatining O'ZIDA (aniq teng) - false (past emas, \"yetarli\" hisoblanadi)", () => {
    const { shouldIssueAutoWinBackDiscount } = loadModule(buildMockDb());
    const seller = { aiCeoAutoDiscountEnabled: true, aiCeoAutoWinBackEnabled: true };
    const boundary = { sentCount: 20, convertedCount: 3, conversionRatePercent: 15 };
    expect(shouldIssueAutoWinBackDiscount({ seller, recentPerformance: boundary, issuedCountThisRun: 0 })).toBe(false);
  });

  test("bitta run ichidagi xavfsizlik chegarasiga yetgan bo'lsa - false", () => {
    const { shouldIssueAutoWinBackDiscount, _testables } = loadModule(buildMockDb());
    const seller = { aiCeoAutoDiscountEnabled: true, aiCeoAutoWinBackEnabled: true };
    expect(shouldIssueAutoWinBackDiscount({
      seller, recentPerformance: GOOD_PERFORMANCE, issuedCountThisRun: _testables.MAX_AUTO_DISCOUNTS_PER_SELLER_PER_RUN,
    })).toBe(false);
  });

  test("barcha shart-sharoit BAJARILGANDA - true", () => {
    const { shouldIssueAutoWinBackDiscount } = loadModule(buildMockDb());
    const seller = { aiCeoAutoDiscountEnabled: true, aiCeoAutoWinBackEnabled: true };
    expect(shouldIssueAutoWinBackDiscount({ seller, recentPerformance: GOOD_PERFORMANCE, issuedCountThisRun: 0 })).toBe(true);
  });
});

describe("generateWinBackDiscountCode", () => {
  test("\"SOGINDIK-\" prefiksi bilan, katta harflardan iborat kod qaytaradi", () => {
    const { _testables } = loadModule(buildMockDb());
    const code = _testables.generateWinBackDiscountCode();
    expect(code).toMatch(/^SOGINDIK-[A-Z0-9]{6}$/);
  });

  test("har chaqiriqda (ehtimoliy) BOSHQA-BOSHQA kod qaytaradi", () => {
    const { _testables } = loadModule(buildMockDb());
    const codes = new Set(Array.from({ length: 20 }, () => _testables.generateWinBackDiscountCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("maybeIssueAutoWinBackDiscount", () => {
  const GOOD_PERFORMANCE = { sentCount: 10, convertedCount: 1, conversionRatePercent: 10 };

  test("shart-sharoit mos kelmasa - {issued:false} qaytaradi va HECH QANDAY yozuv qilmaydi", async () => {
    const db = buildMockDb();
    const { maybeIssueAutoWinBackDiscount } = loadModule(db);
    const result = await maybeIssueAutoWinBackDiscount({
      sellerId: "s1", clientId: "c1", seller: {}, recentPerformance: null, issuedCountThisRun: 0,
    });
    expect(result).toEqual({ issued: false });
    expect(db.__couponSetCalls).toHaveLength(0);
  });

  test("mos kelganda - HAQIQIY promokod hujjatini to'g'ri sxema bilan yozadi", async () => {
    const db = buildMockDb();
    const { maybeIssueAutoWinBackDiscount } = loadModule(db);
    const seller = { aiCeoAutoDiscountEnabled: true, aiCeoAutoWinBackEnabled: true, aiCeoAutoDiscountPercent: 12 };
    const result = await maybeIssueAutoWinBackDiscount({
      sellerId: "s1", clientId: "c1", seller, recentPerformance: GOOD_PERFORMANCE, issuedCountThisRun: 0,
    });
    expect(result.issued).toBe(true);
    expect(result.discountPercent).toBe(12);
    expect(typeof result.code).toBe("string");
    expect(db.__couponSetCalls).toHaveLength(1);
    expect(db.__couponSetCalls[0].data).toMatchObject({
      code: result.code,
      discountType: "percent",
      discountValue: 12,
      usageLimit: 1,
      usedCount: 0,
      isActive: true,
      isAiCeoWinBackReward: true,
      rewardForClientId: "c1",
    });
    expect(typeof db.__couponSetCalls[0].data.expiresAt).toBe("string");
  });

  test("seller.aiCeoAutoDiscountPercent chegaradan OSHIB ketsa (masalan 50) - MAX_DISCOUNT_PERCENT'ga cheklanadi", async () => {
    const db = buildMockDb();
    const { maybeIssueAutoWinBackDiscount, _testables } = loadModule(db);
    const seller = { aiCeoAutoDiscountEnabled: true, aiCeoAutoWinBackEnabled: true, aiCeoAutoDiscountPercent: 50 };
    const result = await maybeIssueAutoWinBackDiscount({
      sellerId: "s1", clientId: "c1", seller, recentPerformance: GOOD_PERFORMANCE, issuedCountThisRun: 0,
    });
    expect(result.discountPercent).toBe(_testables.MAX_DISCOUNT_PERCENT);
  });

  test("seller.aiCeoAutoDiscountPercent juda kichik bo'lsa (masalan 1) - MIN_DISCOUNT_PERCENT'ga cheklanadi", async () => {
    const db = buildMockDb();
    const { maybeIssueAutoWinBackDiscount, _testables } = loadModule(db);
    const seller = { aiCeoAutoDiscountEnabled: true, aiCeoAutoWinBackEnabled: true, aiCeoAutoDiscountPercent: 1 };
    const result = await maybeIssueAutoWinBackDiscount({
      sellerId: "s1", clientId: "c1", seller, recentPerformance: GOOD_PERFORMANCE, issuedCountThisRun: 0,
    });
    expect(result.discountPercent).toBe(_testables.MIN_DISCOUNT_PERCENT);
  });

  test("seller.aiCeoAutoDiscountPercent belgilanmagan bo'lsa - DEFAULT_DISCOUNT_PERCENT ishlatiladi", async () => {
    const db = buildMockDb();
    const { maybeIssueAutoWinBackDiscount, _testables } = loadModule(db);
    const seller = { aiCeoAutoDiscountEnabled: true, aiCeoAutoWinBackEnabled: true };
    const result = await maybeIssueAutoWinBackDiscount({
      sellerId: "s1", clientId: "c1", seller, recentPerformance: GOOD_PERFORMANCE, issuedCountThisRun: 0,
    });
    expect(result.discountPercent).toBe(_testables.DEFAULT_DISCOUNT_PERCENT);
  });

  test("Firestore yozuvi xato bersa - xato TASHLAMAYDI, {issued:false} qaytaradi", async () => {
    const db = buildMockDb({ setShouldThrow: true });
    const { maybeIssueAutoWinBackDiscount } = loadModule(db);
    const seller = { aiCeoAutoDiscountEnabled: true, aiCeoAutoWinBackEnabled: true };
    const result = await maybeIssueAutoWinBackDiscount({
      sellerId: "s1", clientId: "c1", seller, recentPerformance: GOOD_PERFORMANCE, issuedCountThisRun: 0,
    });
    expect(result).toEqual({ issued: false });
  });
});
