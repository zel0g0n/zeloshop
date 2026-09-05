/**
 * `managerAlerts.js` — sotuvchiga (menejerga) proaktiv ogohlantirishlar
 * (kam zaxira, eskirgan buyurtmalar). 2026-09 punkt-royxati, "Advanced
 * Automation" (Z-Biznes), 5-band.
 *
 * ASOSIY E'TIBOR: (1) faqat `aiCeoEnabled` VA tegishli maxsus opt-in
 * bayrog'i ikkalasi ham yoqilgan sotuvchilar uchun ishlashi (standart
 * holatda o'chiq), (2) bir xil mahsulot/buyurtma qayta-qayta
 * bezovta qilmasligi (idempotentlik), (3) hech qanday soxta ETA/sana
 * ishlatilmasligi.
 */

function buildStaleOrdersMockDb({ sellerData = {} } = {}) {
  const batchUpdates = [];
  return {
    collection: (name) => {
      if (name === "sellers") {
        return {
          doc: () => ({
            get: async () => ({ exists: true, data: () => sellerData }),
          }),
        };
      }
      throw new Error(`Kutilmagan kolleksiya: ${name}`);
    },
    batch: () => ({
      update: (ref, data) => batchUpdates.push({ orderId: ref.__orderId, data }),
      commit: async () => {},
    }),
    __batchUpdates: batchUpdates,
  };
}

const staleOrderDoc = (id, data) => ({ id, ref: { __orderId: id }, data: () => data });

function buildLowStockMockDb({ products = [] } = {}) {
  const batchUpdates = [];
  const sentMessages = [];

  const productsQuery = {
    where: () => productsQuery,
    orderBy: () => productsQuery,
    get: async () => ({
      empty: products.length === 0,
      docs: products.map((p) => ({
        id: p.id,
        ref: { __productId: p.id },
        data: () => p,
      })),
    }),
  };

  return {
    collection: (name) => {
      if (name === "products") return productsQuery;
      throw new Error(`Kutilmagan kolleksiya: ${name}`);
    },
    batch: () => ({
      update: (ref, data) => batchUpdates.push({ productId: ref.__productId, data }),
      commit: async () => {},
    }),
    __batchUpdates: batchUpdates,
    __sentMessages: sentMessages,
  };
}

function loadModule(db, sendTelegramMessageMock) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: { firestore: { FieldValue: { serverTimestamp: () => "MOCK_TS" } } },
    db,
    BOT_TOKEN: { value: () => "mock-bot-token" },
  }));
  jest.doMock("../lib/helpers", () => ({
    sendTelegramMessage: sendTelegramMessageMock,
    buildSellerAppLink: (path) => `https://commerce-zelo.web.app${path}`,
  }));
  jest.doMock("../lib/dailyStats", () => ({ incrementDailyStat: jest.fn().mockResolvedValue(undefined) }));
  return require("../managerAlerts");
}

const sellerDoc = (id, data) => ({ id, data: () => data });

describe("processSellerLowStockAlert", () => {
  test("aiCeoEnabled=false bo'lsa - hech qanday xabar yubormaydi", async () => {
    const db = buildLowStockMockDb({ products: [{ id: "p1", sellerId: "s1", name: "Krem", stock: 2 }] });
    const sendMock = jest.fn();
    const { _testables } = loadModule(db, sendMock);
    await _testables.processSellerLowStockAlert(sellerDoc("s1", { aiCeoEnabled: false, aiCeoLowStockAlertEnabled: true }), "token");
    expect(sendMock).not.toHaveBeenCalled();
  });

  test("aiCeoLowStockAlertEnabled=false (standart holat) bo'lsa - hech qanday xabar yubormaydi", async () => {
    const db = buildLowStockMockDb({ products: [{ id: "p1", sellerId: "s1", name: "Krem", stock: 2 }] });
    const sendMock = jest.fn();
    const { _testables } = loadModule(db, sendMock);
    await _testables.processSellerLowStockAlert(sellerDoc("s1", { aiCeoEnabled: true }), "token");
    expect(sendMock).not.toHaveBeenCalled();
  });

  test("kam zaxirali mahsulot bo'lsa - sotuvchiga jamlangan xabar yuboradi va mahsulotlarni belgilaydi", async () => {
    const db = buildLowStockMockDb({
      products: [
        { id: "p1", sellerId: "s1", name: "Krem", stock: 2 },
        { id: "p2", sellerId: "s1", name: "Sovun", stock: 4 },
      ],
    });
    const sendMock = jest.fn().mockResolvedValue(undefined);
    const { _testables } = loadModule(db, sendMock);
    await _testables.processSellerLowStockAlert(sellerDoc("s1", { aiCeoEnabled: true, aiCeoLowStockAlertEnabled: true }), "token");

    expect(sendMock).toHaveBeenCalledTimes(1);
    const [token, chatId, text] = sendMock.mock.calls[0];
    expect(token).toBe("token");
    expect(chatId).toBe("s1");
    expect(text).toContain("Krem");
    expect(text).toContain("Sovun");
    expect(db.__batchUpdates).toHaveLength(2);
  });

  test("mahsulot YAQINDA (7 kundan kam) allaqachon ogohlantirilgan bo'lsa - qayta yubormaydi", async () => {
    const recentAlertMs = Date.now() - 2 * 24 * 60 * 60 * 1000; // 2 kun oldin
    const db = buildLowStockMockDb({
      products: [{ id: "p1", sellerId: "s1", name: "Krem", stock: 2, lowStockAlertedAt: { toMillis: () => recentAlertMs } }],
    });
    const sendMock = jest.fn();
    const { _testables } = loadModule(db, sendMock);
    await _testables.processSellerLowStockAlert(sellerDoc("s1", { aiCeoEnabled: true, aiCeoLowStockAlertEnabled: true }), "token");

    expect(sendMock).not.toHaveBeenCalled();
  });

  test("mahsulot UZOQ VAQT (7 kundan ko'p) oldin ogohlantirilgan bo'lsa - QAYTA yuboradi", async () => {
    const oldAlertMs = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 kun oldin
    const db = buildLowStockMockDb({
      products: [{ id: "p1", sellerId: "s1", name: "Krem", stock: 2, lowStockAlertedAt: { toMillis: () => oldAlertMs } }],
    });
    const sendMock = jest.fn().mockResolvedValue(undefined);
    const { _testables } = loadModule(db, sendMock);
    await _testables.processSellerLowStockAlert(sellerDoc("s1", { aiCeoEnabled: true, aiCeoLowStockAlertEnabled: true }), "token");

    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  test("kam zaxirali mahsulot bo'lmasa - hech narsa qilmaydi", async () => {
    const db = buildLowStockMockDb({ products: [] });
    const sendMock = jest.fn();
    const { _testables } = loadModule(db, sendMock);
    await _testables.processSellerLowStockAlert(sellerDoc("s1", { aiCeoEnabled: true, aiCeoLowStockAlertEnabled: true }), "token");

    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe("processStaleOrdersForSeller", () => {
  const order1 = staleOrderDoc("order-1", { sellerId: "s1", totalAmount: 100_000, status: "processing", createdAt: { toMillis: () => Date.now() - 60 * 60 * 60 * 1000 } });

  test("aiCeoEnabled=false bo'lsa - xabar yubormaydi", async () => {
    const db = buildStaleOrdersMockDb({ sellerData: { aiCeoEnabled: false, aiCeoStaleOrderAlertEnabled: true } });
    const sendMock = jest.fn();
    const { _testables } = loadModule(db, sendMock);
    await _testables.processStaleOrdersForSeller("s1", [order1], "token");
    expect(sendMock).not.toHaveBeenCalled();
  });

  test("aiCeoStaleOrderAlertEnabled=false (standart holat) bo'lsa - xabar yubormaydi", async () => {
    const db = buildStaleOrdersMockDb({ sellerData: { aiCeoEnabled: true } });
    const sendMock = jest.fn();
    const { _testables } = loadModule(db, sendMock);
    await _testables.processStaleOrdersForSeller("s1", [order1], "token");
    expect(sendMock).not.toHaveBeenCalled();
  });

  test("ikkalasi ham yoqilgan bo'lsa - jamlangan xabar yuboradi va buyurtmalarni belgilaydi", async () => {
    const db = buildStaleOrdersMockDb({ sellerData: { aiCeoEnabled: true, aiCeoStaleOrderAlertEnabled: true } });
    const sendMock = jest.fn().mockResolvedValue(undefined);
    const { _testables } = loadModule(db, sendMock);
    await _testables.processStaleOrdersForSeller("s1", [order1], "token");

    expect(sendMock).toHaveBeenCalledTimes(1);
    const [token, chatId, text] = sendMock.mock.calls[0];
    expect(token).toBe("token");
    expect(chatId).toBe("s1");
    expect(text).toContain("#order-");
    expect(text).toContain("100,000 so'm");
    expect(db.__batchUpdates).toEqual([{ orderId: "order-1", data: { staleOrderAlerted: true } }]);
  });
});
