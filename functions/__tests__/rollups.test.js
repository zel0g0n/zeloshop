const {
  dateKeyFromMillis,
  computeOrderCogs,
  findMissingCostPriceIds,
  buildDailyRollupDelta,
  buildCustomerRollupState,
  computeLoyaltyEarnDelta,
} = require("../lib/rollups");

describe("dateKeyFromMillis", () => {
  test("Toshkent vaqti bo'yicha to'g'ri kun kalitini qaytaradi", () => {
    // 2026-01-01 peshin (+05:00) - Toshkent bo'yicha ANIQ shu kunning o'zi.
    const ms = new Date("2026-01-01T12:00:00+05:00").getTime();
    expect(dateKeyFromMillis(ms)).toBe("2026-01-01");
  });

  test("UTC kechqurun bo'lsa ham, Toshkent (UTC+5) bo'yicha KEYINGI kunga to'g'ri o'tadi", () => {
    // 2026-01-01 20:30 UTC = 2026-01-02 01:30 Toshkent vaqti.
    const ms = new Date("2026-01-01T20:30:00Z").getTime();
    expect(dateKeyFromMillis(ms)).toBe("2026-01-02");
  });
});

describe("computeOrderCogs", () => {
  test("suratga olingan (costPrice mavjud) qatorlardan to'g'ri hisoblaydi", () => {
    const items = [{ id: "p1", quantity: 2, costPrice: 10_000 }, { id: "p2", quantity: 1, costPrice: 5_000 }];
    expect(computeOrderCogs(items)).toBe(25_000);
  });

  test("suratga OLINMAGAN qatorlar uchun fallbackMap'dan foydalanadi", () => {
    const items = [{ id: "p1", quantity: 3 }]; // costPrice yo'q
    const fallbackMap = new Map([["p1", 7_000]]);
    expect(computeOrderCogs(items, fallbackMap)).toBe(21_000);
  });

  test("aralash holat - ba'zi qatorlar suratga olingan, ba'zilari EMAS", () => {
    const items = [
      { id: "p1", quantity: 1, costPrice: 10_000 }, // suratga olingan
      { id: "p2", quantity: 2 }, // yo'q - fallback kerak
    ];
    const fallbackMap = new Map([["p2", 3_000]]);
    expect(computeOrderCogs(items, fallbackMap)).toBe(16_000); // 10,000 + 2*3,000
  });

  test("bo'sh/undefined qatorlar uchun xato bermaydi, 0 qaytaradi", () => {
    expect(computeOrderCogs(undefined)).toBe(0);
    expect(computeOrderCogs([])).toBe(0);
  });
});

describe("findMissingCostPriceIds", () => {
  test("faqat costPrice YO'Q qatorlarning ID'larini qaytaradi", () => {
    const items = [
      { id: "p1", costPrice: 1000 },
      { id: "p2" },
      { id: "p3", costPrice: null },
    ];
    expect(findMissingCostPriceIds(items).sort()).toEqual(["p2", "p3"]);
  });

  test("hech narsa yetishmasa, bo'sh massiv qaytaradi", () => {
    expect(findMissingCostPriceIds([{ id: "p1", costPrice: 0 }])).toEqual([]);
  });
});

describe("buildDailyRollupDelta", () => {
  test("sign=+1 (delivered bo'ldi) uchun ijobiy delta qaytaradi", () => {
    const delta = buildDailyRollupDelta({ totalAmount: 100_000 }, 40_000, 1);
    expect(delta).toEqual({ revenue: 100_000, cogs: 40_000, deliveredCount: 1 });
  });

  test("sign=-1 (delivered'dan chiqarildi) uchun salbiy delta qaytaradi", () => {
    const delta = buildDailyRollupDelta({ totalAmount: 100_000 }, 40_000, -1);
    expect(delta).toEqual({ revenue: -100_000, cogs: -40_000, deliveredCount: -1 });
  });
});

describe("buildCustomerRollupState", () => {
  test("yangi mijoz uchun boshlang'ich holatni to'g'ri quradi", () => {
    const order = { totalAmount: 100_000, createdAtMs: 1000, customer: { fullName: "Ali", phone: "+998901112233" } };
    const state = buildCustomerRollupState(null, order, 1);
    expect(state).toEqual({
      removed: false, ltv: 100_000, orderCount: 1, lastOrderAtMs: 1000, firstOrderAtMs: 1000, fullName: "Ali", phone: "+998901112233",
      isNewCustomer: true, couponOrderCount: 0,
    });
  });

  test("mavjud mijozga YANGI buyurtmani to'g'ri qo'shadi (LTV/orderCount ortadi, firstOrderAtMs O'ZGARMAYDI)", () => {
    const existing = { ltv: 50_000, orderCount: 1, lastOrderAtMs: 1000, firstOrderAtMs: 1000, fullName: "Ali", phone: "+998901112233" };
    const order = { totalAmount: 30_000, createdAtMs: 2000, customer: { fullName: "Ali", phone: "+998901112233" } };
    const state = buildCustomerRollupState(existing, order, 1);
    expect(state.ltv).toBe(80_000);
    expect(state.orderCount).toBe(2);
    expect(state.lastOrderAtMs).toBe(2000); // yangiroq sana - yangilanadi
    expect(state.firstOrderAtMs).toBe(1000); // BIRINCHI xarid sanasi - CAC uchun o'zgarmasligi shart
  });

  test("firstOrderAtMs YO'Q eski mijoz yozuviga yangi buyurtma qo'shilsa - firstOrderAtMs endi HAM yozilmaydi (haqiqiy sana noma'lum, o'ylab topilmaydi)", () => {
    const existing = { ltv: 50_000, orderCount: 1, lastOrderAtMs: 1000, fullName: "Ali", phone: "" }; // firstOrderAtMs yo'q - migratsiyadan oldingi mijoz
    const order = { totalAmount: 30_000, createdAtMs: 2000, customer: { fullName: "Ali", phone: "" } };
    const state = buildCustomerRollupState(existing, order, 1);
    expect(state.firstOrderAtMs).toBeNull();
  });

  test("eskiroq sanali (kech kelgan) buyurtma - lastOrderAtMs'ni ORQAGA surmaydi", () => {
    const existing = { ltv: 50_000, orderCount: 1, lastOrderAtMs: 5000, fullName: "Ali", phone: "" };
    const order = { totalAmount: 30_000, createdAtMs: 2000, customer: { fullName: "Ali", phone: "" } };
    const state = buildCustomerRollupState(existing, order, 1);
    expect(state.lastOrderAtMs).toBe(5000); // eskiroq sana - o'zgarmaydi
  });

  test("bekor qilish (sign=-1) - LTV/orderCount kamayadi, lastOrderAtMs O'ZGARMAYDI", () => {
    const existing = { ltv: 100_000, orderCount: 2, lastOrderAtMs: 5000, fullName: "Ali", phone: "" };
    const order = { totalAmount: 30_000, createdAtMs: 9999, customer: { fullName: "Ali", phone: "" } };
    const state = buildCustomerRollupState(existing, order, -1);
    expect(state.ltv).toBe(70_000);
    expect(state.orderCount).toBe(1);
    expect(state.lastOrderAtMs).toBe(5000); // ATAYLAB o'zgarmaydi (lib/rollups.js'dagi izohga qarang)
  });

  test("oxirgi buyurtma ham bekor qilinsa (orderCount 0'ga tushsa) - 'removed' true bo'ladi", () => {
    const existing = { ltv: 30_000, orderCount: 1, lastOrderAtMs: 5000, fullName: "Ali", phone: "" };
    const order = { totalAmount: 30_000, createdAtMs: 5000, customer: { fullName: "Ali", phone: "" } };
    const state = buildCustomerRollupState(existing, order, -1);
    expect(state.removed).toBe(true);
    expect(state.orderCount).toBe(0);
  });

  test("LTV/orderCount hech qachon manfiy bo'lmaydi (himoya)", () => {
    const order = { totalAmount: 30_000, createdAtMs: 5000, customer: {} };
    const state = buildCustomerRollupState(null, order, -1); // g'alati holat, lekin himoyalangan bo'lishi kerak
    expect(state.ltv).toBe(0);
    expect(state.orderCount).toBe(0);
  });

  describe("isNewCustomer (BIZNES BUYRUQ MARKAZI - kunlik yangi mijozlar hisoblagichi)", () => {
    test("mijoz yig'ma yozuvi HALI UMUMAN mavjud bo'lmasa VA sign=+1 bo'lsa - true", () => {
      const order = { totalAmount: 30_000, createdAtMs: 5000, customer: { fullName: "Ali" } };
      const state = buildCustomerRollupState(null, order, 1);
      expect(state.isNewCustomer).toBe(true);
    });

    test("mijoz ALLAQACHON mavjud bo'lsa (qaytib xarid qildi) - false", () => {
      const existing = { ltv: 50_000, orderCount: 1, lastOrderAtMs: 1000, firstOrderAtMs: 1000, fullName: "Ali", phone: "" };
      const order = { totalAmount: 30_000, createdAtMs: 2000, customer: { fullName: "Ali" } };
      const state = buildCustomerRollupState(existing, order, 1);
      expect(state.isNewCustomer).toBe(false);
    });

    test("mijoz mavjud emas, lekin sign=-1 (g'alati/himoyalangan holat) - hech qachon true bo'lmaydi", () => {
      const order = { totalAmount: 30_000, createdAtMs: 5000, customer: {} };
      const state = buildCustomerRollupState(null, order, -1);
      expect(state.isNewCustomer).toBe(false);
    });

    test("'delivered'dan chiqarish (sign=-1, mijoz mavjud) - hech qachon 'yangi mijoz' hisoblanmaydi", () => {
      const existing = { ltv: 30_000, orderCount: 1, lastOrderAtMs: 5000, firstOrderAtMs: 5000, fullName: "Ali", phone: "" };
      const order = { totalAmount: 30_000, createdAtMs: 5000, customer: { fullName: "Ali" } };
      const state = buildCustomerRollupState(existing, order, -1);
      expect(state.isNewCustomer).toBe(false);
    });
  });

  describe("couponOrderCount (MIJOZLAR RAZVEDKASI - 'discount_hunter' belgisi, 2026-09 punkt-royxati 9-band)", () => {
    test("promokod bilan qilingan buyurtma - hisoblagichni +1 oshiradi", () => {
      const order = { totalAmount: 30_000, createdAtMs: 5000, customer: { fullName: "Ali" }, appliedCoupon: { code: "KUZGI20" } };
      const state = buildCustomerRollupState(null, order, 1);
      expect(state.couponOrderCount).toBe(1);
    });

    test("promokodsiz buyurtma - hisoblagich O'ZGARMAYDI", () => {
      const existing = { ltv: 50_000, orderCount: 1, lastOrderAtMs: 1000, fullName: "Ali", phone: "", couponOrderCount: 1 };
      const order = { totalAmount: 30_000, createdAtMs: 2000, customer: { fullName: "Ali" } };
      const state = buildCustomerRollupState(existing, order, 1);
      expect(state.couponOrderCount).toBe(1);
    });

    test("mavjud mijozga YANA promokodli buyurtma qo'shilsa - hisoblagich to'g'ri jamlanadi", () => {
      const existing = { ltv: 50_000, orderCount: 1, lastOrderAtMs: 1000, fullName: "Ali", phone: "", couponOrderCount: 1 };
      const order = { totalAmount: 30_000, createdAtMs: 2000, customer: { fullName: "Ali" }, appliedCoupon: { code: "YANGI10" } };
      const state = buildCustomerRollupState(existing, order, 1);
      expect(state.couponOrderCount).toBe(2);
    });

    test("promokodli buyurtma bekor qilinsa (sign=-1) - hisoblagich kamayadi", () => {
      const existing = { ltv: 50_000, orderCount: 2, lastOrderAtMs: 2000, fullName: "Ali", phone: "", couponOrderCount: 2 };
      const order = { totalAmount: 30_000, createdAtMs: 2000, customer: { fullName: "Ali" }, appliedCoupon: { code: "YANGI10" } };
      const state = buildCustomerRollupState(existing, order, -1);
      expect(state.couponOrderCount).toBe(1);
    });

    test("hech qachon manfiy bo'lmaydi (himoya)", () => {
      const order = { totalAmount: 30_000, createdAtMs: 5000, customer: {}, appliedCoupon: { code: "X" } };
      const state = buildCustomerRollupState(null, order, -1);
      expect(state.couponOrderCount).toBe(0);
    });
  });
});

describe("computeLoyaltyEarnDelta", () => {
  test("sotuvchida yoqilgan bo'lsa - earnBase'dan foizni to'g'ri hisoblaydi", () => {
    const seller = { loyaltyEnabled: true, loyaltyEarnPercent: 2 };
    const order = { loyaltyBonusEarnBase: 100_000 };
    expect(computeLoyaltyEarnDelta(seller, order, 1)).toBe(2_000);
  });

  test("sign=-1 (bekor qilindi) bo'lsa - salbiy qiymat qaytaradi", () => {
    const seller = { loyaltyEnabled: true, loyaltyEarnPercent: 2 };
    const order = { loyaltyBonusEarnBase: 100_000 };
    expect(computeLoyaltyEarnDelta(seller, order, -1)).toBe(-2_000);
  });

  test("sotuvchida `loyaltyEnabled` yo'q/false bo'lsa - har doim 0", () => {
    expect(computeLoyaltyEarnDelta({ loyaltyEnabled: false, loyaltyEarnPercent: 10 }, { loyaltyBonusEarnBase: 100_000 }, 1)).toBe(0);
    expect(computeLoyaltyEarnDelta({}, { loyaltyBonusEarnBase: 100_000 }, 1)).toBe(0);
    expect(computeLoyaltyEarnDelta(null, { loyaltyBonusEarnBase: 100_000 }, 1)).toBe(0);
  });

  test("`loyaltyEarnPercent` 0 yoki belgilanmagan bo'lsa - 0 qaytaradi", () => {
    expect(computeLoyaltyEarnDelta({ loyaltyEnabled: true, loyaltyEarnPercent: 0 }, { loyaltyBonusEarnBase: 100_000 }, 1)).toBe(0);
    expect(computeLoyaltyEarnDelta({ loyaltyEnabled: true }, { loyaltyBonusEarnBase: 100_000 }, 1)).toBe(0);
  });

  test("`loyaltyBonusEarnBase` yo'q (eski buyurtma) bo'lsa - 0 qaytaradi", () => {
    expect(computeLoyaltyEarnDelta({ loyaltyEnabled: true, loyaltyEarnPercent: 2 }, {}, 1)).toBe(0);
  });

  test("natijani so'mgacha yaxlitlaydi", () => {
    const seller = { loyaltyEnabled: true, loyaltyEarnPercent: 1.5 };
    const order = { loyaltyBonusEarnBase: 1_001 }; // 15.015 -> 15
    expect(computeLoyaltyEarnDelta(seller, order, 1)).toBe(15);
  });
});
