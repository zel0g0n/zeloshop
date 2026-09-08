/**
 * `customerIntelligence.js` — CRM Hub sahifasi uchun `getCustomerIntelligence`
 * onCall (Z-Biznes, 2026-09 punkt-royxati, 9-band). `aiCeoAgent.js`dagi
 * `execGetCustomerIntelligence` bilan bir xil tasniflash mantig'idan
 * foydalanadi, lekin bu — CRM Hub sahifasi to'g'ridan-to'g'ri
 * chaqiradigan, mustaqil onCall.
 */

function makeQueryable(docs) {
  const compare = (v, op, target) => {
    switch (op) {
      case "==":
        return v === target;
      default:
        throw new Error(`Testda qo'llab-quvvatlanmaydigan operator: ${op}`);
    }
  };
  return {
    where: (field, op, value) => makeQueryable(docs.filter((d) => compare(d[field], op, value))),
    limit: (n) => makeQueryable(docs.slice(0, n)),
    get: async () => ({ empty: docs.length === 0, size: docs.length, docs: docs.map((d) => ({ id: d.id, data: () => d })) }),
  };
}

function buildMockDb({ sellerData = null, customers = [], carts = [], favorites = [], staffDocs = {} } = {}) {
  return {
    collection: (name) => {
      if (name === "sellers") {
        return {
          doc: () => ({
            get: async () => (sellerData ? { exists: true, data: () => sellerData } : { exists: false }),
            collection: (subName) => {
              if (subName === "customers") return makeQueryable(customers);
              throw new Error(`Kutilmagan quyi kolleksiya: ${subName}`);
            },
          }),
        };
      }
      if (name === "carts") return makeQueryable(carts);
      if (name === "favorites") return makeQueryable(favorites);
      // `resolveActingSellerContext` (`lib/staffAccess.js`) xodim
      // huquqlarini shu yerdan (`staff/{actorUid}`) tekshiradi - staff
      // huquqi bo'yicha testlar uchun `staffDocs` orqali beriladi.
      if (name === "staff") {
        return {
          doc: (id) => ({
            get: async () =>
              staffDocs[id] ? { exists: true, data: () => staffDocs[id] } : { exists: false },
          }),
        };
      }
      // `checkRateLimit` (`lib/rateLimit.js`) `rateLimits/{key}`ni
      // ishlatadi - bu test uchun ahamiyatsiz, shuning uchun umumiy
      // zaxira (har doim "hali mavjud emas") yetarli.
      return { doc: () => ({ get: async () => ({ exists: false }) }) };
    },
    runTransaction: async (callback) => callback({ get: async () => ({ exists: false }), set: () => {} }),
  };
}

function loadModule(db) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({ db }));
  jest.doMock("../lib/sentry", () => ({
    withSentry: (fn) => fn,
    SENTRY_DSN: { value: () => null },
    Sentry: { captureException: jest.fn() },
    initSentry: jest.fn(),
  }));
  return require("../customerIntelligence");
}

describe("handleGetCustomerIntelligence", () => {
  test("tizimga kirmagan foydalanuvchini rad etadi", async () => {
    const { _testables } = loadModule(buildMockDb());
    await expect(_testables.handleGetCustomerIntelligence({ auth: null, data: {} })).rejects.toThrow();
  });

  test("Biznes tarifida BO'LMAGAN sotuvchini rad etadi", async () => {
    const { _testables } = loadModule(buildMockDb({ sellerData: { tariffPlan: "pro" } }));
    await expect(
      _testables.handleGetCustomerIntelligence({ auth: { uid: "seller-1" }, data: {} })
    ).rejects.toThrow();
  });

  test("sotuvchi hujjati UMUMAN mavjud bo'lmasa - rad etadi", async () => {
    const { _testables } = loadModule(buildMockDb({ sellerData: null }));
    await expect(
      _testables.handleGetCustomerIntelligence({ auth: { uid: "seller-1" }, data: {} })
    ).rejects.toThrow();
  });

  test("Biznes tarifidagi sotuvchi uchun - TO'LIQ tasnif (counts, tagCounts, high_intent) qaytaradi", async () => {
    const customers = [
      { clientId: "c1", fullName: "Vip Ali", ltv: 600_000, orderCount: 5, lastOrderAtMs: Date.now() },
      { clientId: "c2", fullName: "Faol Vali", ltv: 30_000, orderCount: 1, lastOrderAtMs: Date.now() },
    ];
    const db = buildMockDb({
      sellerData: { tariffPlan: "biznes" },
      customers,
      carts: [{ sellerId: "seller-1", clientId: "c2", status: "active", items: [{ id: "p1" }] }],
    });
    const { _testables } = loadModule(db);
    const result = await _testables.handleGetCustomerIntelligence({ auth: { uid: "seller-1" }, data: {} });

    expect(result.counts.all).toBe(2);
    expect(result.counts.vip).toBe(1);
    expect(result.customers.find((c) => c.clientId === "c2").tags).toContain("high_intent");
    expect(result.tagCounts.high_intent).toBe(1);
    expect(result.isApproximate).toBe(false);
  });

  test("Z-Biznes SINOVIDA (faol trial) bo'lgan Z-Pro sotuvchi ham kira oladi", async () => {
    const farFuture = Date.now() + 5 * 24 * 60 * 60 * 1000;
    const db = buildMockDb({
      sellerData: { tariffPlan: "pro", tariffTrialActive: true, tariffTrialPlan: "biznes", tariffTrialExpiresAt: { toMillis: () => farFuture } },
      customers: [],
    });
    const { _testables } = loadModule(db);
    const result = await _testables.handleGetCustomerIntelligence({ auth: { uid: "seller-1" }, data: {} });
    expect(result.counts.all).toBe(0);
  });

  // MUHIM TUZATISH TEKSHIRUVI (2026-09, Advanced Team & RBAC): OLDIN bu
  // funksiya to'g'ridan-to'g'ri `request.auth.uid`ni sotuvchi deb
  // hisoblardi - `manageCustomers` ruxsatiga ega xodim ham har doim
  // "permission-denied" olardi. Endi `resolveActingSellerContext`
  // orqali ishlaydi - quyidagi ikkita test aynan shu holatni tekshiradi.
  test("manageCustomers ruxsatiga ega FAOL xodim - do'kon egasining tasnifini muvaffaqiyatli oladi", async () => {
    const customers = [
      { clientId: "c1", fullName: "Vip Ali", ltv: 600_000, orderCount: 5, lastOrderAtMs: Date.now() },
    ];
    const db = buildMockDb({
      sellerData: { tariffPlan: "biznes" },
      customers,
      staffDocs: {
        "staff-marketing-1": { sellerId: "seller-1", status: "active", permissions: { manageCustomers: true } },
      },
    });
    const { _testables } = loadModule(db);
    const result = await _testables.handleGetCustomerIntelligence({ auth: { uid: "staff-marketing-1" }, data: {} });
    expect(result.counts.all).toBe(1);
    expect(result.counts.vip).toBe(1);
  });

  test("manageCustomers ruxsati YO'Q xodimni rad etadi", async () => {
    const db = buildMockDb({
      sellerData: { tariffPlan: "biznes" },
      customers: [{ clientId: "c1", fullName: "Vip Ali", ltv: 600_000, orderCount: 5, lastOrderAtMs: Date.now() }],
      staffDocs: {
        "staff-warehouse-1": { sellerId: "seller-1", status: "active", permissions: { manageProducts: true, manageCustomers: false } },
      },
    });
    const { _testables } = loadModule(db);
    await expect(
      _testables.handleGetCustomerIntelligence({ auth: { uid: "staff-warehouse-1" }, data: {} })
    ).rejects.toThrow("Bu amal uchun ruxsatingiz yo'q.");
  });

  test("NOFAOL (status !== active) xodimni, ruxsati bo'lsa ham, rad etadi", async () => {
    const db = buildMockDb({
      sellerData: { tariffPlan: "biznes" },
      customers: [],
      staffDocs: {
        "staff-suspended-1": { sellerId: "seller-1", status: "suspended", permissions: { manageCustomers: true } },
      },
    });
    const { _testables } = loadModule(db);
    await expect(
      _testables.handleGetCustomerIntelligence({ auth: { uid: "staff-suspended-1" }, data: {} })
    ).rejects.toThrow("Bu amal uchun ruxsatingiz yo'q.");
  });
});
