/**
 * `orderRollups.js` — buyurtma "delivered" holatiga o'tganda/
 * chiqarilganda ishga tushadigan trigger, va bir martalik migratsiya
 * (`backfillSellerRollups`) uchun testlar. Sof hisoblash mantig'i
 * (`lib/rollups.js`) alohida, `rollups.test.js`da sinaladi - bu
 * yerda FAQAT Firestore bilan bog'liq "yig'ish/yozish" mantig'i
 * (mock db orqali) tekshiriladi.
 */

function makeIncrementRecorder() {
  return (amount) => ({ __op: "increment", amount });
}

/**
 * Kunlik yig'ma yozuvga (`orderRollups/{date}`) qilingan `.set()`
 * chaqiruvlarini eslab qoladigan, va tannarx/mahsulot qidiruvlarini
 * ta'minlaydigan minimal, lekin izchil mock Firestore.
 */
function buildMockDb({
  orderCostsData = {}, // orderId -> {items: [...]}
  productCostPrices = {}, // productId -> costPrice
  existingCustomer = null, // customer rollup doc mavjud holati
  sellerData = {}, // sotuvchi hujjati (masalan {loyaltyEnabled, loyaltyEarnPercent})
} = {}) {
  const dailyRollupWrites = []; // [{sellerId, dateKey, data}]
  const customerWrites = []; // [{sellerId, clientId, data|deleted}]
  const ordersCreatedWrites = [];
  // BIZNES BUYRUQ MARKAZI (2026-09, 3-band): `newCustomersCount`
  // hisoblagichi ALOHIDA `.set()` chaqiruvi orqali yoziladi
  // (`applyRollupsForOrder`da, `applyCustomerRollup` tugagach) -
  // shuning uchun boshqa ikkita turdan ALOHIDA to'plamga yig'iladi.
  const newCustomersCountWrites = [];
  // YANGI (Trust Badges, v39.13): `applyDailyRollupDelta` endi
  // sotuvchi hujjatining O'ZIGA (quyi kolleksiyaga emas) to'g'ridan
  // to'g'ri `.set()` chaqiradi - "umr bo'yi" yetkazilgan buyurtmalar
  // hisoblagichini oshirish uchun.
  const sellerDocSets = []; // [{sellerId, data}]

  const sellersCollection = (sellerId) => ({
    set: async (data, opts) => { sellerDocSets.push({ sellerId, data, opts }); },
    // Sodiqlik dasturi (bonus) sozlamasini o'qish uchun - `applyRollupsForOrder`
    // har bir yozuvda sotuvchi hujjatini shu orqali oladi.
    get: async () => ({ exists: true, data: () => sellerData }),
    collection: (subName) => {
      if (subName === "orderCosts") {
        return {
          doc: (orderId) => ({
            get: async () => (orderCostsData[orderId]
              ? { exists: true, data: () => orderCostsData[orderId] }
              : { exists: false }),
          }),
        };
      }
      if (subName === "orderRollups") {
        return {
          doc: (dateKey) => ({
            set: async (data, opts) => {
              const isIncrementCall = data.revenue !== undefined || data.cogs !== undefined || data.deliveredCount !== undefined;
              if (isIncrementCall) {
                dailyRollupWrites.push({ sellerId, dateKey, data, opts });
              } else if (data.newCustomersCount !== undefined) {
                newCustomersCountWrites.push({ sellerId, dateKey, data, opts });
              } else {
                ordersCreatedWrites.push({ sellerId, dateKey, data, opts });
              }
            },
          }),
        };
      }
      if (subName === "customers") {
        return {
          doc: (clientId) => ({ __sellerId: sellerId, __clientId: clientId }),
        };
      }
      return { doc: () => ({ get: async () => ({ exists: false }) }) };
    },
  });

  const db = {
    collection: (name) => {
      if (name === "sellers") {
        return { doc: (sellerId) => sellersCollection(sellerId) };
      }
      if (name === "products") {
        return {
          doc: (id) => ({
            get: async () => (productCostPrices[id] !== undefined
              ? { exists: true, data: () => ({ costPrice: productCostPrices[id] }) }
              : { exists: false }),
          }),
        };
      }
      return { doc: () => ({ get: async () => ({ exists: false }) }) };
    },
    runTransaction: async (callback) => {
      const tx = {
        get: async (_ref) => (existingCustomer
          ? { exists: true, data: () => existingCustomer }
          : { exists: false }),
        set: (ref, data) => customerWrites.push({ sellerId: ref.__sellerId, clientId: ref.__clientId, data }),
        delete: (ref) => customerWrites.push({ sellerId: ref.__sellerId, clientId: ref.__clientId, deleted: true }),
      };
      return callback(tx);
    },
    __dailyRollupWrites: dailyRollupWrites,
    __customerWrites: customerWrites,
    __ordersCreatedWrites: ordersCreatedWrites,
    __newCustomersCountWrites: newCustomersCountWrites,
    __sellerDocSets: sellerDocSets,
  };

  return db;
}

function loadModule(db) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: {
      firestore: {
        FieldValue: {
          increment: makeIncrementRecorder(),
          serverTimestamp: () => "MOCK_TS",
        },
      },
    },
    db,
  }));
  jest.doMock("../lib/rateLimit", () => ({ checkRateLimit: jest.fn(async () => undefined) }));
  return require("../orderRollups");
}

const makeOrderData = (overrides = {}) => ({
  sellerId: "seller-1",
  clientId: "client-1",
  totalAmount: 100_000,
  status: "delivered",
  orders: [{ id: "p1", quantity: 2 }],
  customer: { fullName: "Ali", phone: "+998901112233" },
  createdAt: { toMillis: () => new Date("2026-01-01T12:00:00+05:00").getTime() },
  ...overrides,
});

function makeEvent({ before, after, orderId = "order-1" }) {
  return {
    params: { orderId },
    data: {
      before: before ? { exists: true, data: () => before } : { exists: false },
      after: after ? { exists: true, data: () => after } : { exists: false },
    },
  };
}

describe("handleOrderRollupWrite", () => {
  test("buyurtma YANGI yaratilganda (before yo'q) - kunlik 'yaratilgan buyurtmalar' sonini oshiradi", async () => {
    const db = buildMockDb();
    const { _testables } = loadModule(db);
    const order = makeOrderData({ status: "new" });
    await _testables.handleOrderRollupWrite(makeEvent({ before: null, after: order }));

    expect(db.__ordersCreatedWrites).toHaveLength(1);
    expect(db.__ordersCreatedWrites[0].dateKey).toBe("2026-01-01");
    // Status hali "delivered" emas - rollup summasiga (revenue/cogs) tegilmaydi.
    expect(db.__dailyRollupWrites).toHaveLength(0);
  });

  test("status 'delivered'ga o'tganda - kunlik daromad/tannarxni SURATGA OLINGAN qiymatdan to'g'ri oshiradi", async () => {
    const db = buildMockDb({ orderCostsData: { "order-1": { items: [{ id: "p1", quantity: 2, costPrice: 15_000 }] } } });
    const { _testables } = loadModule(db);
    const before = makeOrderData({ status: "pending" });
    const after = makeOrderData({ status: "delivered" });
    await _testables.handleOrderRollupWrite(makeEvent({ before, after }));

    expect(db.__dailyRollupWrites).toHaveLength(1);
    const write = db.__dailyRollupWrites[0];
    expect(write.dateKey).toBe("2026-01-01");
    expect(write.data.revenue).toEqual({ __op: "increment", amount: 100_000 });
    expect(write.data.cogs).toEqual({ __op: "increment", amount: 30_000 }); // 2 * 15,000
    expect(write.data.deliveredCount).toEqual({ __op: "increment", amount: 1 });
  });

  // YANGI (Trust Badges, v39.13): `deliveredCount` bilan BIR VAQTDA,
  // sotuvchi hujjatining o'ziga ham "umr bo'yi" hisoblagich yoziladi -
  // real production trust-badge ko'rsatkichi shundan o'qiladi.
  test("status 'delivered'ga o'tganda - sotuvchi hujjatidagi 'umr bo'yi' trustStats.completedOrders hisoblagichini ham oshiradi", async () => {
    const db = buildMockDb({ orderCostsData: { "order-1": { items: [{ id: "p1", quantity: 2, costPrice: 15_000 }] } } });
    const { _testables } = loadModule(db);
    const before = makeOrderData({ status: "pending" });
    const after = makeOrderData({ status: "delivered" });
    await _testables.handleOrderRollupWrite(makeEvent({ before, after }));

    expect(db.__sellerDocSets).toHaveLength(1);
    expect(db.__sellerDocSets[0].data).toEqual({ trustStats: { completedOrders: { __op: "increment", amount: 1 } } });
    expect(db.__sellerDocSets[0].opts).toEqual({ merge: true });
  });

  test("costPrice SURATGA OLINMAGAN (eski buyurtma) - JORIY mahsulot tannarxidan foydalanadi", async () => {
    const db = buildMockDb({ productCostPrices: { p1: 8_000 } }); // orderCosts hujjati YO'Q
    const { _testables } = loadModule(db);
    const before = makeOrderData({ status: "pending" });
    const after = makeOrderData({ status: "delivered" });
    await _testables.handleOrderRollupWrite(makeEvent({ before, after }));

    const write = db.__dailyRollupWrites[0];
    expect(write.data.cogs).toEqual({ __op: "increment", amount: 16_000 }); // 2 * 8,000
  });

  test("'delivered'dan CHIQARILGANDA (bekor qilish) - SALBIY delta yuboradi", async () => {
    const db = buildMockDb({ orderCostsData: { "order-1": { items: [{ id: "p1", quantity: 2, costPrice: 15_000 }] } } });
    const { _testables } = loadModule(db);
    const before = makeOrderData({ status: "delivered" });
    const after = makeOrderData({ status: "cancel" });
    await _testables.handleOrderRollupWrite(makeEvent({ before, after }));

    const write = db.__dailyRollupWrites[0];
    expect(write.data.revenue).toEqual({ __op: "increment", amount: -100_000 });
    expect(write.data.deliveredCount).toEqual({ __op: "increment", amount: -1 });
    // Trust-badge hisoblagichi ham SALBIY tomonga tuzatiladi (bekor
    // qilingan buyurtma "muvaffaqiyatli yetkazilgan" sanalmaydi).
    expect(db.__sellerDocSets[0].data).toEqual({ trustStats: { completedOrders: { __op: "increment", amount: -1 } } });
  });

  test("status O'ZGARMAGAN yozuv (masalan faqat boshqa maydon) - rollup'ga TEGMAYDI", async () => {
    const db = buildMockDb();
    const { _testables } = loadModule(db);
    const before = makeOrderData({ status: "delivered" });
    const after = makeOrderData({ status: "delivered" }); // hali ham delivered
    await _testables.handleOrderRollupWrite(makeEvent({ before, after }));

    expect(db.__dailyRollupWrites).toHaveLength(0);
  });

  test("mijoz yig'ma yozuvini (customers/{clientId}) ham TRANZAKSIYA ichida yangilaydi", async () => {
    const db = buildMockDb({ orderCostsData: { "order-1": { items: [{ id: "p1", quantity: 2, costPrice: 15_000 }] } } });
    const { _testables } = loadModule(db);
    const before = makeOrderData({ status: "pending" });
    const after = makeOrderData({ status: "delivered" });
    await _testables.handleOrderRollupWrite(makeEvent({ before, after }));

    expect(db.__customerWrites).toHaveLength(1);
    expect(db.__customerWrites[0].clientId).toBe("client-1");
    expect(db.__customerWrites[0].data.ltv).toBe(100_000);
    expect(db.__customerWrites[0].data.orderCount).toBe(1);
  });

  // CAC (mijoz jalb qilish narxi, P&L paneli) — 2026-09 punkt-royxati,
  // 3-band.
  describe("firstOrderAtMs (CAC uchun)", () => {
    test("mijozning ANIQ birinchi buyurtmasida (yig'ma yozuv hali yo'q) firstOrderAtMs yoziladi", async () => {
      const db = buildMockDb(); // existingCustomer yo'q - bu client-1'ning birinchi buyurtmasi
      const { _testables } = loadModule(db);
      const before = makeOrderData({ status: "pending" });
      const after = makeOrderData({ status: "delivered" });
      await _testables.handleOrderRollupWrite(makeEvent({ before, after }));

      expect(db.__customerWrites[0].data.firstOrderAtMs).toBe(new Date("2026-01-01T12:00:00+05:00").getTime());
    });

    test("mijozda ALLAQACHON firstOrderAtMs bo'lsa - keyingi buyurtmada O'ZGARMAYDI", async () => {
      const db = buildMockDb({
        existingCustomer: { ltv: 100_000, orderCount: 1, lastOrderAtMs: 1, firstOrderAtMs: 1, fullName: "Ali", phone: "" },
      });
      const { _testables } = loadModule(db);
      const before = makeOrderData({ status: "pending" });
      const after = makeOrderData({ status: "delivered" });
      await _testables.handleOrderRollupWrite(makeEvent({ before, after }));

      expect(db.__customerWrites[0].data.firstOrderAtMs).toBe(1);
    });

    test("MIGRATSIYADAN OLDINGI mijoz (buyurtmasi bor, lekin firstOrderAtMs yo'q) - yangi buyurtmada HAM yozilmaydi (soxta sana o'ylab topilmaydi)", async () => {
      const db = buildMockDb({
        existingCustomer: { ltv: 100_000, orderCount: 1, lastOrderAtMs: 1, fullName: "Ali", phone: "" }, // firstOrderAtMs yo'q
      });
      const { _testables } = loadModule(db);
      const before = makeOrderData({ status: "pending" });
      const after = makeOrderData({ status: "delivered" });
      await _testables.handleOrderRollupWrite(makeEvent({ before, after }));

      expect(db.__customerWrites[0].data.firstOrderAtMs).toBeNull();
    });
  });

  // BIZNES BUYRUQ MARKAZI (2026-09, 3-band): kunlik "yangi mijozlar"
  // hisoblagichi (`orderRollups/{date}.newCustomersCount`) - Command
  // Center paneli "mijoz jalb qilish" tendentsiyasini ko'rsatishi
  // uchun.
  describe("newCustomersCount (Business Command Center)", () => {
    test("mijozning ENG BIRINCHI buyurtmasi 'delivered' bo'lganda - o'sha kunga +1 yoziladi", async () => {
      const db = buildMockDb(); // existingCustomer yo'q - bu client-1'ning birinchi buyurtmasi
      const { _testables } = loadModule(db);
      const before = makeOrderData({ status: "pending" });
      const after = makeOrderData({ status: "delivered" });
      await _testables.handleOrderRollupWrite(makeEvent({ before, after }));

      expect(db.__newCustomersCountWrites).toHaveLength(1);
      expect(db.__newCustomersCountWrites[0].dateKey).toBe("2026-01-01");
      expect(db.__newCustomersCountWrites[0].data.newCustomersCount).toEqual({ __op: "increment", amount: 1 });
    });

    test("QAYTIB xarid qilgan (mijoz allaqachon mavjud) mijozning buyurtmasi - HECH NARSA yozilmaydi", async () => {
      const db = buildMockDb({
        existingCustomer: { ltv: 100_000, orderCount: 1, lastOrderAtMs: 1, firstOrderAtMs: 1, fullName: "Ali", phone: "" },
      });
      const { _testables } = loadModule(db);
      const before = makeOrderData({ status: "pending" });
      const after = makeOrderData({ status: "delivered" });
      await _testables.handleOrderRollupWrite(makeEvent({ before, after }));

      expect(db.__newCustomersCountWrites).toHaveLength(0);
    });

    test("'delivered'dan CHIQARILGANDA (bekor qilish) - hech qachon yozilmaydi", async () => {
      const db = buildMockDb({
        existingCustomer: { ltv: 100_000, orderCount: 1, lastOrderAtMs: 1, firstOrderAtMs: 1, fullName: "Ali", phone: "" },
      });
      const { _testables } = loadModule(db);
      const before = makeOrderData({ status: "delivered" });
      const after = makeOrderData({ status: "cancel" });
      await _testables.handleOrderRollupWrite(makeEvent({ before, after }));

      expect(db.__newCustomersCountWrites).toHaveLength(0);
    });

    test("mijoz (clientId) yo'q buyurtma - customer rollup umuman ishlamaydi, newCustomersCount ham yozilmaydi", async () => {
      const db = buildMockDb();
      const { _testables } = loadModule(db);
      const before = makeOrderData({ status: "pending", clientId: null });
      const after = makeOrderData({ status: "delivered", clientId: null });
      await _testables.handleOrderRollupWrite(makeEvent({ before, after }));

      expect(db.__newCustomersCountWrites).toHaveLength(0);
    });
  });

  // MIJOZLAR RAZVEDKASI ("discount_hunter" belgisi, 2026-09 punkt-
  // royxati 9-band): mijoz yig'ma yozuvidagi `couponOrderCount` -
  // sof hisoblash mantig'i `rollups.test.js`da sinalgan, bu yerda
  // FAQAT tranzaksiya orqali TO'G'RI yozilishi tekshiriladi.
  describe("couponOrderCount (Mijozlar razvedkasi)", () => {
    test("promokod bilan qilingan buyurtma 'delivered' bo'lganda - mijoz yozuvida couponOrderCount=1 yoziladi", async () => {
      const db = buildMockDb();
      const { _testables } = loadModule(db);
      const before = makeOrderData({ status: "pending" });
      const after = makeOrderData({ status: "delivered", appliedCoupon: { code: "KUZGI20" } });
      await _testables.handleOrderRollupWrite(makeEvent({ before, after }));

      expect(db.__customerWrites[0].data.couponOrderCount).toBe(1);
    });

    test("promokodsiz buyurtma 'delivered' bo'lganda - mavjud couponOrderCount O'ZGARMAYDI", async () => {
      const db = buildMockDb({
        existingCustomer: { ltv: 100_000, orderCount: 1, lastOrderAtMs: 1, firstOrderAtMs: 1, fullName: "Ali", phone: "", couponOrderCount: 1 },
      });
      const { _testables } = loadModule(db);
      const before = makeOrderData({ status: "pending" });
      const after = makeOrderData({ status: "delivered" });
      await _testables.handleOrderRollupWrite(makeEvent({ before, after }));

      expect(db.__customerWrites[0].data.couponOrderCount).toBe(1);
    });

    test("promokodli buyurtma 'delivered'dan CHIQARILGANDA - couponOrderCount kamayadi", async () => {
      const db = buildMockDb({
        existingCustomer: { ltv: 100_000, orderCount: 2, lastOrderAtMs: 1, firstOrderAtMs: 1, fullName: "Ali", phone: "", couponOrderCount: 1 },
      });
      const { _testables } = loadModule(db);
      const before = makeOrderData({ status: "delivered", appliedCoupon: { code: "KUZGI20" } });
      const after = makeOrderData({ status: "cancel", appliedCoupon: { code: "KUZGI20" } });
      await _testables.handleOrderRollupWrite(makeEvent({ before, after }));

      expect(db.__customerWrites[0].data.couponOrderCount).toBe(0);
    });
  });

  // SODIQLIK DASTURI ("Bonus hisobi") - `functions/orders.js`da
  // buyurtma yaratilganda hisoblab qo'yilgan `loyaltyBonusEarnBase`dan,
  // sotuvchining `loyaltyEarnPercent` foizi bo'yicha, mijozning
  // `customers/{clientId}.bonusBalance`iga qo'shiladi/ayiriladi.
  describe("sodiqlik dasturi (bonus) balansi", () => {
    test("sotuvchida YOQILGAN bo'lsa - 'delivered'ga o'tganda bonus balansini to'g'ri oshiradi", async () => {
      const db = buildMockDb({
        sellerData: { loyaltyEnabled: true, loyaltyEarnPercent: 2 },
      });
      const { _testables } = loadModule(db);
      const before = makeOrderData({ status: "pending" });
      const after = makeOrderData({ status: "delivered", loyaltyBonusEarnBase: 100_000 });
      await _testables.handleOrderRollupWrite(makeEvent({ before, after }));

      expect(db.__customerWrites[0].data.bonusBalance).toBe(2_000); // 100,000 * 2%
    });

    test("mavjud bonus balansi ustiga QO'SHIB boradi (ustidan yozib yubormaydi)", async () => {
      const db = buildMockDb({
        sellerData: { loyaltyEnabled: true, loyaltyEarnPercent: 2 },
        existingCustomer: { ltv: 500_000, orderCount: 3, lastOrderAtMs: 1, fullName: "Ali", phone: "", bonusBalance: 5_000 },
      });
      const { _testables } = loadModule(db);
      const before = makeOrderData({ status: "pending" });
      const after = makeOrderData({ status: "delivered", loyaltyBonusEarnBase: 100_000 });
      await _testables.handleOrderRollupWrite(makeEvent({ before, after }));

      expect(db.__customerWrites[0].data.bonusBalance).toBe(7_000); // 5,000 + 2,000
    });

    test("sotuvchida O'CHIRILGAN bo'lsa - bonus HECH QACHON berilmaydi", async () => {
      const db = buildMockDb({ sellerData: { loyaltyEnabled: false, loyaltyEarnPercent: 10 } });
      const { _testables } = loadModule(db);
      const before = makeOrderData({ status: "pending" });
      const after = makeOrderData({ status: "delivered", loyaltyBonusEarnBase: 100_000 });
      await _testables.handleOrderRollupWrite(makeEvent({ before, after }));

      expect(db.__customerWrites[0].data.bonusBalance).toBe(0);
    });

    test("'delivered'dan CHIQARILGANDA (bekor qilish) - avval berilgan bonus TESKARISIGA qaytariladi", async () => {
      const db = buildMockDb({
        sellerData: { loyaltyEnabled: true, loyaltyEarnPercent: 2 },
        existingCustomer: { ltv: 100_000, orderCount: 2, lastOrderAtMs: 1, fullName: "Ali", phone: "", bonusBalance: 2_000 },
      });
      const { _testables } = loadModule(db);
      const before = makeOrderData({ status: "delivered", loyaltyBonusEarnBase: 100_000 });
      const after = makeOrderData({ status: "cancel", loyaltyBonusEarnBase: 100_000 });
      await _testables.handleOrderRollupWrite(makeEvent({ before, after }));

      expect(db.__customerWrites[0].data.bonusBalance).toBe(0); // 2,000 - 2,000
    });

    test("eski buyurtmada `loyaltyBonusEarnBase` bo'lmasa - bonus berilmaydi (regressiya emas)", async () => {
      const db = buildMockDb({ sellerData: { loyaltyEnabled: true, loyaltyEarnPercent: 2 } });
      const { _testables } = loadModule(db);
      const before = makeOrderData({ status: "pending" });
      const after = makeOrderData({ status: "delivered" }); // loyaltyBonusEarnBase yo'q
      await _testables.handleOrderRollupWrite(makeEvent({ before, after }));

      expect(db.__customerWrites[0].data.bonusBalance).toBe(0);
    });
  });
});

describe("handleBackfillSellerRollups", () => {
  function buildBackfillMockDb({ orders = [], products = {} } = {}) {
    const dailyBatchWrites = [];
    const customerBatchWrites = [];
    const sellerUpdates = [];

    const ordersQuery = {
      orderBy: () => ordersQuery,
      limit: () => ordersQuery,
      startAfter: () => ({ ...ordersQuery, get: async () => ({ empty: true, docs: [] }) }),
      get: async () => ({
        empty: orders.length === 0,
        docs: orders.map((o, i) => ({ id: `order-${i}`, data: () => o })),
      }),
    };

    return {
      collection: (name) => {
        if (name === "products") {
          return {
            where: () => ({
              get: async () => ({
                forEach: (cb) => Object.entries(products).forEach(([id, costPrice]) => cb({ id, data: () => ({ costPrice }) })),
              }),
            }),
          };
        }
        if (name === "orders") {
          return { where: () => ordersQuery };
        }
        if (name === "sellers") {
          return {
            doc: (sellerId) => ({
              set: async (data) => sellerUpdates.push({ sellerId, data }),
              collection: (subName) => ({
                doc: (docId) => ({ __sub: subName, __sellerId: sellerId, __docId: docId }),
              }),
            }),
          };
        }
        return { doc: () => ({ get: async () => ({ exists: false }) }) };
      },
      batch: () => {
        const writes = [];
        return {
          set: (ref, data) => writes.push({ ref, data }),
          commit: async () => {
            writes.forEach((w) => {
              if (w.ref.__sub === "orderRollups") dailyBatchWrites.push(w);
              if (w.ref.__sub === "customers") customerBatchWrites.push(w);
            });
          },
        };
      },
      __dailyBatchWrites: dailyBatchWrites,
      __customerBatchWrites: customerBatchWrites,
      __sellerUpdates: sellerUpdates,
    };
  }

  test("faqat 'delivered' buyurtmalarni daromad/tannarxga qo'shadi, boshqa holatlarni FAQAT faoliyat sanog'iga", async () => {
    const orders = [
      makeOrderData({ status: "delivered", totalAmount: 100_000, orders: [{ id: "p1", quantity: 1 }] }),
      makeOrderData({ status: "pending", totalAmount: 500_000 }),
    ];
    const db = buildBackfillMockDb({ orders, products: { p1: 10_000 } });
    jest.resetModules();
    jest.doMock("../lib/admin", () => ({
      admin: { firestore: { FieldValue: { increment: makeIncrementRecorder(), serverTimestamp: () => "MOCK_TS" } } },
      db,
    }));
    jest.doMock("../lib/rateLimit", () => ({ checkRateLimit: jest.fn(async () => undefined) }));
    const { _testables } = require("../orderRollups");

    const result = await _testables.handleBackfillSellerRollups({ auth: { uid: "seller-1" }, data: { sellerId: "seller-1" } });

    expect(result.ordersProcessed).toBe(2);
    expect(db.__dailyBatchWrites).toHaveLength(1); // ikkalasi ham bir kunga tegishli
    const dayWrite = db.__dailyBatchWrites[0].data;
    expect(dayWrite.revenue).toBe(100_000); // faqat delivered
    expect(dayWrite.cogs).toBe(10_000);
    expect(dayWrite.deliveredCount).toBe(1);
    expect(dayWrite.ordersCreatedCount).toBe(2); // barcha holat
    // Migratsiya yakunida sotuvchi hujjatiga bayroq yoziladi:
    expect(db.__sellerUpdates).toHaveLength(1);
    expect(db.__sellerUpdates[0].sellerId).toBe("seller-1");
  });

  // CAC uchun: migratsiya BUYURTMALARNI createdAt bo'yicha O'SISH
  // TARTIBIDA o'qiganligi sababli (`.orderBy("createdAt","asc")`), bu
  // yerda (jonli trigger'dan farqli o'laroq) mijozning HAQIQIY birinchi
  // buyurtma sanasi har doim ANIQ tiklanadi - hatto mijoz bir necha
  // marta xarid qilgan bo'lsa ham.
  test("mijoz bir necha marta xarid qilgan bo'lsa - firstOrderAtMs ENG BIRINCHI (eng eski) buyurtma sanasi bo'ladi", async () => {
    const orders = [
      makeOrderData({ status: "delivered", totalAmount: 50_000, createdAt: { toMillis: () => 1000 } }),
      makeOrderData({ status: "delivered", totalAmount: 70_000, createdAt: { toMillis: () => 2000 } }),
    ];
    const db = buildBackfillMockDb({ orders, products: {} });
    jest.resetModules();
    jest.doMock("../lib/admin", () => ({
      admin: { firestore: { FieldValue: { increment: makeIncrementRecorder(), serverTimestamp: () => "MOCK_TS" } } },
      db,
    }));
    jest.doMock("../lib/rateLimit", () => ({ checkRateLimit: jest.fn(async () => undefined) }));
    const { _testables } = require("../orderRollups");

    await _testables.handleBackfillSellerRollups({ auth: { uid: "seller-1" }, data: { sellerId: "seller-1" } });

    expect(db.__customerBatchWrites).toHaveLength(1);
    expect(db.__customerBatchWrites[0].data.firstOrderAtMs).toBe(1000);
    expect(db.__customerBatchWrites[0].data.ltv).toBe(120_000);
  });

  // BIZNES BUYRUQ MARKAZI (2026-09, 3-band): migratsiya ham
  // `newCustomersCount`ni butun tarixdan to'g'ri qayta tiklashi kerak
  // - buyurtmalar `createdAt asc` bo'yicha ketma-ket o'ynatilgani
  // uchun, mijozning ANIQ birinchi buyurtmasi qaysi kunga to'g'ri
  // kelishi ANIQ hisoblanadi.
  test("newCustomersCount - har bir mijozning FAQAT birinchi buyurtmasi kuni +1 bo'ladi", async () => {
    const orders = [
      // client-1: birinchi buyurtma 2026-01-01, ikkinchi (qaytib xarid) 2026-01-02.
      makeOrderData({ status: "delivered", clientId: "client-1", totalAmount: 50_000, createdAt: { toMillis: () => new Date("2026-01-01T10:00:00+05:00").getTime() } }),
      makeOrderData({ status: "delivered", clientId: "client-1", totalAmount: 30_000, createdAt: { toMillis: () => new Date("2026-01-02T10:00:00+05:00").getTime() } }),
      // client-2: birinchi (va yagona) buyurtmasi ham 2026-01-01.
      makeOrderData({ status: "delivered", clientId: "client-2", totalAmount: 20_000, createdAt: { toMillis: () => new Date("2026-01-01T15:00:00+05:00").getTime() } }),
    ];
    const db = buildBackfillMockDb({ orders, products: {} });
    jest.resetModules();
    jest.doMock("../lib/admin", () => ({
      admin: { firestore: { FieldValue: { increment: makeIncrementRecorder(), serverTimestamp: () => "MOCK_TS" } } },
      db,
    }));
    jest.doMock("../lib/rateLimit", () => ({ checkRateLimit: jest.fn(async () => undefined) }));
    const { _testables } = require("../orderRollups");

    await _testables.handleBackfillSellerRollups({ auth: { uid: "seller-1" }, data: { sellerId: "seller-1" } });

    const day1 = db.__dailyBatchWrites.find((w) => w.ref.__docId === "2026-01-01").data;
    const day2 = db.__dailyBatchWrites.find((w) => w.ref.__docId === "2026-01-02").data;
    // 2026-01-01: client-1'ning BIRINCHI buyurtmasi + client-2'ning yagona buyurtmasi -> 2 ta yangi mijoz.
    expect(day1.newCustomersCount).toBe(2);
    // 2026-01-02: client-1'ning QAYTIB xaridi (yangi mijoz EMAS) -> 0.
    expect(day2.newCustomersCount).toBe(0);
  });

  // MIJOZLAR RAZVEDKASI (2026-09, 9-band): migratsiya `couponOrderCount`ni
  // ham butun buyurtma tarixidan to'g'ri qayta tiklashi kerak.
  test("couponOrderCount - migratsiya mijozning promokodli buyurtmalari sonini to'g'ri qayta tiklaydi", async () => {
    const orders = [
      makeOrderData({ status: "delivered", clientId: "client-1", totalAmount: 50_000, appliedCoupon: { code: "A" }, createdAt: { toMillis: () => 1000 } }),
      makeOrderData({ status: "delivered", clientId: "client-1", totalAmount: 30_000, createdAt: { toMillis: () => 2000 } }), // promokodsiz
      makeOrderData({ status: "delivered", clientId: "client-1", totalAmount: 20_000, appliedCoupon: { code: "B" }, createdAt: { toMillis: () => 3000 } }),
    ];
    const db = buildBackfillMockDb({ orders, products: {} });
    jest.resetModules();
    jest.doMock("../lib/admin", () => ({
      admin: { firestore: { FieldValue: { increment: makeIncrementRecorder(), serverTimestamp: () => "MOCK_TS" } } },
      db,
    }));
    jest.doMock("../lib/rateLimit", () => ({ checkRateLimit: jest.fn(async () => undefined) }));
    const { _testables } = require("../orderRollups");

    await _testables.handleBackfillSellerRollups({ auth: { uid: "seller-1" }, data: { sellerId: "seller-1" } });

    expect(db.__customerBatchWrites).toHaveLength(1);
    expect(db.__customerBatchWrites[0].data.couponOrderCount).toBe(2);
  });

  test("o'z do'koni bo'lmagan sotuvchi uchun ishga tushirishga URINISHNI rad etadi", async () => {
    const db = buildBackfillMockDb({ orders: [] });
    jest.resetModules();
    jest.doMock("../lib/admin", () => ({
      admin: { firestore: { FieldValue: { increment: makeIncrementRecorder(), serverTimestamp: () => "MOCK_TS" } } },
      db,
    }));
    jest.doMock("../lib/rateLimit", () => ({ checkRateLimit: jest.fn(async () => undefined) }));
    const { _testables } = require("../orderRollups");

    await expect(
      _testables.handleBackfillSellerRollups({ auth: { uid: "seller-1" }, data: { sellerId: "seller-2" } })
    ).rejects.toThrow();
  });
});
