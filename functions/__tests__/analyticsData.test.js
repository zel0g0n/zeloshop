/**
 * `analyticsData.js` uchun testlar.
 *
 * ASOSIY MAQSAD: (1) faqat TIZIMGA KIRGAN sotuvchi o'zining
 * ma'lumotlarini olishini, (2) `createdAt` Firestore Timestamp'dan
 * ODDIY MILLISEKUNDGA to'g'ri o'girilishini (mavjud pure funksiyalar
 * `Number(order.createdAt)` shaklida ishlatadi - Timestamp obyekti
 * to'g'ridan-to'g'ri songa aylanmaydi), va (3) natija hech qachon
 * xavfsizlik chegarasidan OSHIB ketmasligini tasdiqlash.
 */

function buildMockDb(docs = []) {
  return {
    collection: () => ({
      doc: () => ({}), // `checkRateLimit`ning `db.collection("rateLimits").doc(key)` chaqiruvi uchun
      where: () => ({
        orderBy: () => ({
          limit: (n) => ({
            get: async () => ({ docs: docs.slice(0, n).map((d) => ({ id: d.id, data: () => d.data })) }),
          }),
        }),
        // `getAnalyticsProducts` `.orderBy()` ishlatmaydi - to'g'ridan-to'g'ri `.limit()`ga o'tadi.
        limit: (n) => ({
          get: async () => ({ docs: docs.slice(0, n).map((d) => ({ id: d.id, data: () => d.data })) }),
        }),
      }),
    }),
    // `checkRateLimit` (bu faylda ALOHIDA mock qilinmagan, HAQIQIY
    // `lib/rateLimit.js` ishlatiladi) shu orqali ishlaydi - testlarda
    // hech qachon chegaraga tegmasligi uchun har doim "yangi oyna"
    // deb hisoblaymiz.
    runTransaction: async (callback) => callback({ get: async () => ({ exists: false }), set: () => {} }),
  };
}

function loadModule(db) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({ db }));
  return require("../analyticsData");
}

describe("getAnalyticsOrders", () => {
  test("tizimga kirmagan foydalanuvchi rad etiladi", async () => {
    const { _testables } = loadModule(buildMockDb());
    await expect(_testables.handleGetAnalyticsOrders({ auth: null })).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("Firestore Timestamp'ni oddiy millisekundga to'g'ri o'giradi", async () => {
    const fakeTimestamp = { toMillis: () => 1735689600000 };
    const db = buildMockDb([{ id: "order-1", data: { sellerId: "seller-1", createdAt: fakeTimestamp, totalAmount: 50000 } }]);
    const { _testables } = loadModule(db);

    const result = await _testables.handleGetAnalyticsOrders({ auth: { uid: "seller-1" } });

    expect(result.orders).toHaveLength(1);
    expect(result.orders[0].createdAt).toBe(1735689600000);
    expect(typeof result.orders[0].createdAt).toBe("number");
  });

  test("createdAt yo'q (null) bo'lsa ham xato bermaydi", async () => {
    const db = buildMockDb([{ id: "order-1", data: { sellerId: "seller-1", createdAt: null } }]);
    const { _testables } = loadModule(db);
    const result = await _testables.handleGetAnalyticsOrders({ auth: { uid: "seller-1" } });
    expect(result.orders[0].createdAt).toBeNull();
  });

  test("natija xavfsizlik chegarasidan OSHMAYDI va 'truncated' belgisi to'g'ri qo'yiladi", async () => {
    const { _testables } = loadModule(buildMockDb());
    const MAX = _testables.MAX_ANALYTICS_ORDERS;
    const manyDocs = Array.from({ length: MAX + 50 }, (_, i) => ({
      id: `order-${i}`,
      data: { sellerId: "seller-1", createdAt: { toMillis: () => i } },
    }));
    const db = buildMockDb(manyDocs);
    const { _testables: t2 } = loadModule(db);

    const result = await t2.handleGetAnalyticsOrders({ auth: { uid: "seller-1" } });

    expect(result.orders.length).toBe(MAX);
    expect(result.truncated).toBe(true);
  });

  test("chegaradan kam natija bo'lsa 'truncated' false bo'ladi", async () => {
    const db = buildMockDb([{ id: "order-1", data: { sellerId: "seller-1", createdAt: { toMillis: () => 1 } } }]);
    const { _testables } = loadModule(db);
    const result = await _testables.handleGetAnalyticsOrders({ auth: { uid: "seller-1" } });
    expect(result.truncated).toBe(false);
  });
});

describe("getAnalyticsProducts", () => {
  test("tizimga kirmagan foydalanuvchi rad etiladi", async () => {
    const { _testables } = loadModule(buildMockDb());
    await expect(_testables.handleGetAnalyticsProducts({ auth: null })).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("mahsulotlar ro'yxatini to'g'ri qaytaradi", async () => {
    const db = buildMockDb([{ id: "prod-1", data: { sellerId: "seller-1", name: "Krem", costPrice: 40000 } }]);
    const { _testables } = loadModule(db);
    const result = await _testables.handleGetAnalyticsProducts({ auth: { uid: "seller-1" } });
    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({ id: "prod-1", name: "Krem", costPrice: 40000 });
  });
});
