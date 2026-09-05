/**
 * `pricingSuggestions.js` uchun testlar — "AI narx tavsiyalari"
 * (haftalik cron + sotuvchi tomonidan aniq tasdiqlanadigan
 * qo'llash/rad etish).
 *
 * ASOSIY E'TIBOR: (1) faqat `aiCeoEnabled` VA `aiPricingSuggestionsEnabled`
 * ikkalasi ham yoqilgan sotuvchilar uchun ishlashi, (2) signal
 * topilmasa eski tavsiyani tozalashi, (3) Gemini xato bersa ham
 * zaxira (fallback) matn bilan tavsiya baribir yaratilishi, (4)
 * `applyPricingSuggestion` HECH QACHON ko'r-ko'rona qo'llamasligi -
 * mahsulotning HOZIRGI holatidan qayta hisoblashi va eskirgan bo'lsa
 * rad etishi, (5) narx HECH QACHON avtomatik o'zgarmasligi - faqat
 * aniq `applyPricingSuggestion` chaqirilgandagina.
 */

function buildCronMockDb({ productsBySeller = {} } = {}) {
  const suggestionSetCalls = [];
  const suggestionDeleteCalls = [];

  return {
    collection: (name) => {
      if (name === "products") {
        return {
          where: (field, op, sellerId) => ({
            get: async () => {
              const products = productsBySeller[sellerId] || [];
              return { empty: products.length === 0, docs: products.map((p) => ({ id: p.id, data: () => p })) };
            },
          }),
        };
      }
      if (name === "sellers") {
        return {
          doc: (sellerId) => ({
            collection: (sub) => {
              if (sub !== "pricingSuggestions") throw new Error(`Kutilmagan subkolleksiya: ${sub}`);
              return {
                doc: (productId) => ({
                  set: async (data) => suggestionSetCalls.push({ sellerId, productId, data }),
                  delete: async () => suggestionDeleteCalls.push({ sellerId, productId }),
                }),
              };
            },
          }),
        };
      }
      throw new Error(`Kutilmagan kolleksiya: ${name}`);
    },
    __suggestionSetCalls: suggestionSetCalls,
    __suggestionDeleteCalls: suggestionDeleteCalls,
  };
}

function loadModule({ db, generateContentMock } = {}) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: { firestore: { FieldValue: { serverTimestamp: () => "MOCK_TS" } } },
    db,
    GEMINI_API_KEY: { value: () => "mock-gemini-key" },
  }));
  jest.doMock("../lib/dailyStats", () => ({ incrementDailyStat: jest.fn().mockResolvedValue(undefined) }));
  jest.doMock("@google/genai", () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: { generateContent: generateContentMock || jest.fn().mockResolvedValue({ text: "Bu mock izoh." }) },
    })),
  }));
  return require("../pricingSuggestions");
}

const sellerDoc = (id, data) => ({ id, data: () => data });

const NOW = Date.now();
const daysAgoIso = (days) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

const slowMoverProduct = { id: "p1", sellerId: "s1", name: "Krem", price: 50000, costPrice: 20000, stock: 15, sold: 1, createdAt: daysAgoIso(30) };
const healthyProduct = { id: "p2", sellerId: "s1", name: "Sovun", price: 20000, costPrice: 10000, stock: 20, sold: 5, createdAt: daysAgoIso(30) };

describe("processSellerPricingSuggestions (haftalik cron)", () => {
  test("aiCeoEnabled=false bo'lsa, hech narsa qilmaydi", async () => {
    const db = buildCronMockDb({ productsBySeller: { s1: [slowMoverProduct] } });
    const { _testables } = loadModule({ db });
    await _testables.processSellerPricingSuggestions(sellerDoc("s1", { aiCeoEnabled: false, aiPricingSuggestionsEnabled: true }));
    expect(db.__suggestionSetCalls.length).toBe(0);
  });

  test("aiPricingSuggestionsEnabled=false bo'lsa (standart holat), hech narsa qilmaydi", async () => {
    const db = buildCronMockDb({ productsBySeller: { s1: [slowMoverProduct] } });
    const { _testables } = loadModule({ db });
    await _testables.processSellerPricingSuggestions(sellerDoc("s1", { aiCeoEnabled: true }));
    expect(db.__suggestionSetCalls.length).toBe(0);
  });

  test("aniq signal topilgan mahsulot uchun, Gemini muvaffaqiyatli bo'lsa, to'g'ri tavsiya yozadi", async () => {
    const db = buildCronMockDb({ productsBySeller: { s1: [slowMoverProduct] } });
    const generateContentMock = jest.fn().mockResolvedValue({ text: "Bu mahsulot sekin sotilmoqda." });
    const { _testables } = loadModule({ db, generateContentMock });

    await _testables.processSellerPricingSuggestions(sellerDoc("s1", { aiCeoEnabled: true, aiPricingSuggestionsEnabled: true }));

    expect(db.__suggestionSetCalls.length).toBe(1);
    const written = db.__suggestionSetCalls[0];
    expect(written.sellerId).toBe("s1");
    expect(written.productId).toBe("p1");
    expect(written.data.type).toBe("slow_mover_discount");
    expect(written.data.reasoning).toBe("Bu mahsulot sekin sotilmoqda.");
    expect(written.data.status).toBe("pending");
    expect(written.data.suggestedPrice).toBeLessThan(written.data.currentPrice);
  });

  test("Gemini xato bersa, ZAXIRA (fallback) matn bilan baribir tavsiya yozadi", async () => {
    const db = buildCronMockDb({ productsBySeller: { s1: [slowMoverProduct] } });
    const generateContentMock = jest.fn().mockRejectedValue(new Error("Gemini vaqtincha ishlamayapti"));
    const { _testables } = loadModule({ db, generateContentMock });

    await _testables.processSellerPricingSuggestions(sellerDoc("s1", { aiCeoEnabled: true, aiPricingSuggestionsEnabled: true }));

    expect(db.__suggestionSetCalls.length).toBe(1);
    expect(db.__suggestionSetCalls[0].data.reasoning).toMatch(/chegirma|sekin/i);
  });

  test("signal topilmagan ('sog'lom') mahsulot uchun, mavjud (eski) tavsiyani o'chiradi, yangisini yozmaydi", async () => {
    const db = buildCronMockDb({ productsBySeller: { s1: [healthyProduct] } });
    const { _testables } = loadModule({ db });

    await _testables.processSellerPricingSuggestions(sellerDoc("s1", { aiCeoEnabled: true, aiPricingSuggestionsEnabled: true }));

    expect(db.__suggestionSetCalls.length).toBe(0);
    expect(db.__suggestionDeleteCalls.length).toBe(1);
    expect(db.__suggestionDeleteCalls[0].productId).toBe("p2");
  });

  test("nofaol (isActive:false) mahsulotlar UMUMAN ko'rib chiqilmaydi", async () => {
    const db = buildCronMockDb({ productsBySeller: { s1: [{ ...slowMoverProduct, isActive: false }] } });
    const { _testables } = loadModule({ db });

    await _testables.processSellerPricingSuggestions(sellerDoc("s1", { aiCeoEnabled: true, aiPricingSuggestionsEnabled: true }));

    expect(db.__suggestionSetCalls.length).toBe(0);
    expect(db.__suggestionDeleteCalls.length).toBe(0);
  });

  test("mahsulotning narxi o'z kategoriyasidagi (shu sotuvchining o'z katalogi) o'rtachadan sezilarli YUQORI bo'lsa - `category_price_high` tavsiyasini yozadi (#115)", async () => {
    const categoryOutlier = { id: "p10", sellerId: "s1", name: "Qimmat mahsulot", category: "Kiyim", price: 100000, costPrice: 0, stock: 20, sold: 5, createdAt: daysAgoIso(5) };
    const categoryNormal = (idx) => ({ id: `p1${idx}`, sellerId: "s1", name: `Oddiy ${idx}`, category: "Kiyim", price: 20000, costPrice: 0, stock: 20, sold: 5, createdAt: daysAgoIso(5) });
    const db = buildCronMockDb({ productsBySeller: { s1: [categoryOutlier, categoryNormal(1), categoryNormal(2), categoryNormal(3)] } });
    const { _testables } = loadModule({ db });

    await _testables.processSellerPricingSuggestions(sellerDoc("s1", { aiCeoEnabled: true, aiPricingSuggestionsEnabled: true }));

    const outlierWrite = db.__suggestionSetCalls.find((c) => c.productId === "p10");
    expect(outlierWrite).toBeTruthy();
    expect(outlierWrite.data.type).toBe("category_price_high");
    expect(outlierWrite.data.categoryAvgPrice).toBe(20000);
    expect(outlierWrite.data.categorySampleSize).toBe(3);
    expect(outlierWrite.data.suggestedPrice).toBeLessThan(100000);
  });

  test("bitta ishga tushirishda, sotuvchi uchun ko'rib chiqiladigan mahsulotlar soni MAX_PRODUCTS_PER_SELLER_PER_RUN bilan chegaralangan", async () => {
    const { MAX_PRODUCTS_PER_SELLER_PER_RUN } = require("../pricingSuggestions")._testables;
    const manyProducts = Array.from({ length: MAX_PRODUCTS_PER_SELLER_PER_RUN + 5 }, (_, i) => ({
      ...healthyProduct,
      id: `p-${i}`,
    }));
    const db = buildCronMockDb({ productsBySeller: { s1: manyProducts } });
    const { _testables } = loadModule({ db });

    await _testables.processSellerPricingSuggestions(sellerDoc("s1", { aiCeoEnabled: true, aiPricingSuggestionsEnabled: true }));

    // Hammasi "sog'lom" (signal yo'q) - har biri uchun delete chaqiriladi,
    // lekin faqat CHEGARAGACHA bo'lganlari uchun.
    expect(db.__suggestionDeleteCalls.length).toBe(MAX_PRODUCTS_PER_SELLER_PER_RUN);
  });
});

function buildAppDb({ suggestionData = null, productData = null, categoryProducts = [] } = {}) {
  const calls = { transactionUpdate: [], transactionDelete: 0, directDelete: 0 };
  const suggestionRef = {
    get: async () => (suggestionData ? { exists: true, data: () => suggestionData } : { exists: false }),
    delete: async () => { calls.directDelete += 1; },
  };
  const productRef = {};
  // `handleApplyPricingSuggestion` kategoriya-asoslangan tavsiyani
  // qayta tekshirish uchun `products.where(sellerId).where(category)`
  // SO'ROVINI (hujjat EMAS) o'qiydi - shuning uchun bu alohida
  // "ref" sifatida ajratiladi.
  const categoryQueryRef = { __isCategoryQuery: true };

  return {
    __calls: calls,
    collection: (name) => {
      if (name === "sellers") {
        return {
          doc: () => ({
            collection: (sub) => {
              if (sub !== "pricingSuggestions") throw new Error(`Kutilmagan subkolleksiya: ${sub}`);
              return { doc: () => suggestionRef };
            },
          }),
        };
      }
      if (name === "products") {
        return {
          doc: () => productRef,
          where: (field1) => {
            if (field1 !== "sellerId") throw new Error(`Kutilmagan filtr: ${field1}`);
            return { where: (field2) => (field2 !== "category" ? (() => { throw new Error(`Kutilmagan filtr: ${field2}`); })() : categoryQueryRef) };
          },
        };
      }
      throw new Error(`Kutilmagan kolleksiya: ${name}`);
    },
    runTransaction: async (callback) => {
      const transaction = {
        get: async (ref) => {
          if (ref === suggestionRef) return suggestionData ? { exists: true, data: () => suggestionData } : { exists: false };
          if (ref === productRef) return productData ? { exists: true, data: () => productData } : { exists: false };
          if (ref === categoryQueryRef) return { docs: categoryProducts.map((p) => ({ data: () => p })) };
          throw new Error("noma'lum ref");
        },
        update: (ref, data) => { if (ref === productRef) calls.transactionUpdate.push(data); },
        delete: (ref) => { if (ref === suggestionRef) calls.transactionDelete += 1; },
      };
      return callback(transaction);
    },
  };
}

describe("handleApplyPricingSuggestion", () => {
  test("autentifikatsiyasiz chaqiruvni rad etadi", async () => {
    const { _testables } = loadModule({ db: buildAppDb({}) });
    await expect(
      _testables.handleApplyPricingSuggestion({ auth: null, data: { productId: "p1" } })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("productId berilmasa rad etadi", async () => {
    const { _testables } = loadModule({ db: buildAppDb({}) });
    await expect(
      _testables.handleApplyPricingSuggestion({ auth: { uid: "s1" }, data: {} })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("mavjud bo'lmagan tavsiya - 'not-found' beradi", async () => {
    const { _testables } = loadModule({ db: buildAppDb({ suggestionData: null }) });
    await expect(
      _testables.handleApplyPricingSuggestion({ auth: { uid: "s1" }, data: { productId: "p1" } })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  test("boshqa sotuvchining mahsulotiga urinish - 'permission-denied' beradi", async () => {
    const db = buildAppDb({
      suggestionData: { type: "slow_mover_discount" },
      productData: { ...slowMoverProduct, sellerId: "boshqa-sotuvchi" },
    });
    const { _testables } = loadModule({ db });
    await expect(
      _testables.handleApplyPricingSuggestion({ auth: { uid: "s1" }, data: { productId: "p1" } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("mahsulot holati o'zgargan (tavsiya ESKIRGAN) - 'failed-precondition' beradi va eskirgan tavsiyani o'chiradi", async () => {
    // Tavsiya "slow_mover_discount" edi, lekin sotuvchi shu orada
    // narxni o'zgartirgan/zaxirani sotgan - endi qayta hisoblasak,
    // signal umuman yo'q ("sog'lom" mahsulotga aylangan).
    const db = buildAppDb({
      suggestionData: { type: "slow_mover_discount" },
      productData: healthyProduct,
    });
    const { _testables } = loadModule({ db });
    await expect(
      _testables.handleApplyPricingSuggestion({ auth: { uid: "s1" }, data: { productId: "p2" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(db.__calls.transactionDelete).toBe(1);
    expect(db.__calls.transactionUpdate.length).toBe(0);
  });

  test("haqiqiy, yaroqli holatda - mahsulot narxini yangilaydi, tavsiyani o'chiradi va qo'llangan narxni qaytaradi", async () => {
    const db = buildAppDb({
      suggestionData: { type: "slow_mover_discount" },
      productData: slowMoverProduct,
    });
    const { _testables } = loadModule({ db });

    const result = await _testables.handleApplyPricingSuggestion({ auth: { uid: "s1" }, data: { productId: "p1" } });

    expect(db.__calls.transactionUpdate.length).toBe(1);
    expect(db.__calls.transactionUpdate[0].price).toBe(result.appliedPrice);
    expect(db.__calls.transactionDelete).toBe(1);
    expect(result.appliedPrice).toBeLessThan(slowMoverProduct.price);
  });

  test("kategoriya-asoslangan (`category_price_high`) tavsiyani ham TO'G'RI qayta hisoblab qo'llaydi (#115)", async () => {
    // Tavsiya yaratilgan payt bilan bir xil holat: mahsulot narxi
    // (100000) shu SOTUVCHIning o'z "Kiyim" kategoriyasidagi boshqa
    // 3 ta mahsulotining o'rtachasidan (20000) sezilarli yuqori.
    const outlierProduct = { sellerId: "s1", category: "Kiyim", price: 100000, costPrice: 0, stock: 20, sold: 5, createdAt: daysAgoIso(5) };
    const otherCategoryProducts = [
      { category: "Kiyim", price: 20000, isActive: true },
      { category: "Kiyim", price: 20000, isActive: true },
      { category: "Kiyim", price: 20000, isActive: true },
    ];
    const db = buildAppDb({
      suggestionData: { type: "category_price_high" },
      productData: outlierProduct,
      categoryProducts: [outlierProduct, ...otherCategoryProducts],
    });
    const { _testables } = loadModule({ db });

    const result = await _testables.handleApplyPricingSuggestion({ auth: { uid: "s1" }, data: { productId: "p10" } });

    expect(db.__calls.transactionUpdate.length).toBe(1);
    expect(result.appliedPrice).toBeLessThan(100000);
  });

  test("kategoriya-asoslangan tavsiya ESKIRGAN bo'lsa (masalan, sotuvchi shu orada boshqa mahsulotlar narxini o'zgartirgan, farq endi chegaradan kam) - rad etadi", async () => {
    const nowNormalProduct = { sellerId: "s1", category: "Kiyim", price: 22000, costPrice: 0, stock: 20, sold: 5, createdAt: daysAgoIso(5) };
    const db = buildAppDb({
      suggestionData: { type: "category_price_high" },
      productData: nowNormalProduct,
      categoryProducts: [
        nowNormalProduct,
        { category: "Kiyim", price: 20000 },
        { category: "Kiyim", price: 20000 },
        { category: "Kiyim", price: 20000 },
      ],
    });
    const { _testables } = loadModule({ db });

    await expect(
      _testables.handleApplyPricingSuggestion({ auth: { uid: "s1" }, data: { productId: "p10" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });
});

describe("handleDismissPricingSuggestion", () => {
  test("autentifikatsiyasiz chaqiruvni rad etadi", async () => {
    const { _testables } = loadModule({ db: buildAppDb({}) });
    await expect(
      _testables.handleDismissPricingSuggestion({ auth: null, data: { productId: "p1" } })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("productId berilmasa rad etadi", async () => {
    const { _testables } = loadModule({ db: buildAppDb({}) });
    await expect(
      _testables.handleDismissPricingSuggestion({ auth: { uid: "s1" }, data: {} })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("mavjud bo'lmagan tavsiya - 'not-found' beradi", async () => {
    const { _testables } = loadModule({ db: buildAppDb({ suggestionData: null }) });
    await expect(
      _testables.handleDismissPricingSuggestion({ auth: { uid: "s1" }, data: { productId: "p1" } })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  test("haqiqiy holatda - tavsiyani o'chiradi, mahsulotga TEGMAYDI", async () => {
    const db = buildAppDb({ suggestionData: { type: "slow_mover_discount" } });
    const { _testables } = loadModule({ db });

    const result = await _testables.handleDismissPricingSuggestion({ auth: { uid: "s1" }, data: { productId: "p1" } });

    expect(result).toEqual({ ok: true });
    expect(db.__calls.directDelete).toBe(1);
    expect(db.__calls.transactionUpdate.length).toBe(0);
  });
});
