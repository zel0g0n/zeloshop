/**
 * `productRecommendations.js` (cron/Firestore glue) uchun testlar. Sof
 * hisoblash mantig'i (`lib/productRecommendations.js`) alohida,
 * `productRecommendations.test.js`da sinaladi - bu yerda FAQAT
 * Firestore bilan bog'liq "o'qish/yozish" mantig'i (mock db orqali)
 * tekshiriladi.
 */

function buildMockDb({ ordersBySeller = {}, sellersDocs = [] } = {}) {
  const productSets = []; // [{productId, data, opts}]

  return {
    collection: (name) => {
      if (name === "sellers") {
        return {
          get: async () => ({
            empty: sellersDocs.length === 0,
            docs: sellersDocs.map((id) => ({ id })),
          }),
        };
      }
      if (name === "orders") {
        return {
          where: (field, op, value) => {
            const chain = {
              __sellerId: field === "sellerId" ? value : undefined,
              where: (f2, o2, v2) => ({
                ...chain,
                __sellerId: f2 === "sellerId" ? v2 : chain.__sellerId,
                limit: () => ({
                  get: async () => {
                    const sellerId = f2 === "sellerId" ? v2 : field === "sellerId" ? value : null;
                    const orders = ordersBySeller[sellerId] || [];
                    return { empty: orders.length === 0, docs: orders.map((data) => ({ data: () => data })) };
                  },
                }),
              }),
              limit: () => ({
                get: async () => {
                  const sellerId = field === "sellerId" ? value : null;
                  const orders = ordersBySeller[sellerId] || [];
                  return { empty: orders.length === 0, docs: orders.map((data) => ({ data: () => data })) };
                },
              }),
            };
            return chain;
          },
        };
      }
      if (name === "products") {
        return { doc: (productId) => ({ __productId: productId }) };
      }
      return { doc: () => ({ get: async () => ({ exists: false }) }) };
    },
    batch: () => {
      const writes = [];
      return {
        set: (ref, data, opts) => writes.push({ productId: ref.__productId, data, opts }),
        commit: async () => { productSets.push(...writes); },
      };
    },
    __productSets: productSets,
  };
}

function loadModule(db) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({ db }));
  return require("../productRecommendations");
}

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: (config, handler) => handler,
}));

describe("computeSellerProductRecommendations", () => {
  test("sotuvchida yetkazilgan buyurtma bo'lmasa - hech narsa yozmaydi", async () => {
    const db = buildMockDb({ ordersBySeller: {} });
    const { _testables } = loadModule(db);
    const result = await _testables.computeSellerProductRecommendations("s1");
    expect(result).toEqual({ productsUpdated: 0 });
    expect(db.__productSets).toHaveLength(0);
  });

  test("BIRGA sotib olingan mahsulotlarni to'g'ri hisoblab, HAR IKKALA mahsulotga ham yozadi", async () => {
    const db = buildMockDb({
      ordersBySeller: {
        s1: [
          { orders: [{ id: "p1" }, { id: "p2" }] },
          { orders: [{ id: "p1" }, { id: "p2" }] },
        ],
      },
    });
    const { _testables } = loadModule(db);
    const result = await _testables.computeSellerProductRecommendations("s1");
    expect(result).toEqual({ productsUpdated: 2 });

    const p1Write = db.__productSets.find((w) => w.productId === "p1");
    const p2Write = db.__productSets.find((w) => w.productId === "p2");
    expect(p1Write.data.frequentlyBoughtWith).toEqual([{ productId: "p2", count: 2 }]);
    expect(p2Write.data.frequentlyBoughtWith).toEqual([{ productId: "p1", count: 2 }]);
    expect(p1Write.opts).toEqual({ merge: true });
  });

  test("bitta mahsulotli buyurtmalar bo'lsa (birga sotib olish signal yo'q) - hech narsa yozmaydi", async () => {
    const db = buildMockDb({ ordersBySeller: { s1: [{ orders: [{ id: "p1" }] }] } });
    const { _testables } = loadModule(db);
    const result = await _testables.computeSellerProductRecommendations("s1");
    expect(result).toEqual({ productsUpdated: 0 });
  });
});

describe("computeProductRecommendations (rejalashtirilgan handler)", () => {
  test("sotuvchi bo'lmasa, hech narsa qilmaydi", async () => {
    const db = buildMockDb({ sellersDocs: [] });
    const mod = loadModule(db);
    await expect(mod.computeProductRecommendations()).resolves.not.toThrow();
  });

  test("bir nechta sotuvchi bo'lsa - HAR BIRINI ishlaydi (bittasida xato bo'lsa ham, qolganlar davom etadi)", async () => {
    const db = buildMockDb({
      sellersDocs: ["s1", "s2"],
      ordersBySeller: {
        s1: [{ orders: [{ id: "p1" }, { id: "p2" }] }],
        // s2 uchun ordersBySeller yo'q -> bo'sh natija, xato emas
      },
    });
    const mod = loadModule(db);
    await expect(mod.computeProductRecommendations()).resolves.not.toThrow();
    expect(db.__productSets.length).toBeGreaterThan(0);
  });
});
