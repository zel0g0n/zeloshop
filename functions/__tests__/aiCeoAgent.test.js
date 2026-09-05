/**
 * `aiCeoAgent.js` — AI CEO 6-BOSQICH ("tool-calling arxitekturasi",
 * "avtonom agent" yo'l xaritasining 2-fazasi) uchun testlar.
 *
 * ASOSIY MAQSAD: (1) har bir VOSITA BAJARUVCHISI (`execGet*`) real
 * ma'lumotdan TO'G'RI agregatsiya qilishini, (2) `runToolCallingLoop`
 * ning aylanma suhbat mexanizmi (vosita chaqiruvi -> natija ->
 * yakuniy matn, VA xavfsizlik chegarasi - cheksiz tsiklga
 * tushmasligi) TO'G'RI ishlashini, va (3) `handleAskAiCeo`ning
 * auth/premium/validatsiya tekshiruvlari HAMDA muvaffaqiyatli
 * yo'lini tasdiqlash.
 */

jest.mock("../lib/sentry", () => ({
  withSentry: (fn) => fn,
  SENTRY_DSN: { value: () => null },
  Sentry: { captureException: jest.fn() },
  initSentry: jest.fn(),
}));

// Haqiqiy Firestore query semantikasini (where/orderBy/limit)
// TAQLID qiladigan yordamchi — `execGetLowStockProducts`/
// `execGetCustomerSegments`dagi (2026-09 audit fixi) so'rov
// zanjirining O'ZI to'g'ri filtrlash/tartiblash/cheklash mantig'ini
// bajarayotganini haqiqatan tekshirish uchun (soxta/har doim
// muvaffaqiyatli bo'ladigan mock EMAS).
function makeQueryable(docs) {
  const compare = (v, op, target) => {
    switch (op) {
      case "==":
        return v === target;
      case "!=":
        return v !== target;
      case ">":
        return v > target;
      case ">=":
        return v >= target;
      case "<":
        return v < target;
      case "<=":
        return v <= target;
      default:
        throw new Error(`Testda qo'llab-quvvatlanmaydigan operator: ${op}`);
    }
  };
  return {
    where: (field, op, value) => makeQueryable(docs.filter((d) => compare(d[field], op, value))),
    orderBy: (field, dir = "asc") =>
      makeQueryable([...docs].sort((a, b) => (dir === "desc" ? b[field] - a[field] : a[field] - b[field]))),
    limit: (n) => makeQueryable(docs.slice(0, n)),
    get: async () => ({ docs: docs.map((d) => ({ data: () => d })), size: docs.length }),
  };
}

function buildMockDb({ sellerData = null, orders = [], products = [], customers = [], learningData = null, coupons = [], orderRollupDays = [], pricingSuggestions = [], carts = [], favorites = [], pendingActions = {} } = {}) {
  const auditLogs = [];
  const db = {
    collection: (name) => {
      if (name === "sellers") {
        return {
          doc: () => ({
            get: async () => (sellerData ? { exists: true, data: () => sellerData } : { exists: false }),
            collection: (subName) => {
              if (subName === "customers") {
                return makeQueryable(customers);
              }
              if (subName === "aiCeoLearning") {
                return { doc: () => ({ get: async () => (learningData ? { exists: true, data: () => learningData } : { exists: false }) }) };
              }
              // YANGI (8-BOSQICH bilan bog'lovchi vosita: `get_recent_auto_discounts`).
              if (subName === "coupons") {
                return { where: () => ({ limit: () => ({ get: async () => ({ docs: coupons.map((c) => ({ data: () => c })) }) }) }) };
              }
              // YANGI (`get_pnl_summary`) - doc ID'lari ("YYYY-MM-DD")
              // bo'yicha oraliq so'rovni taqlid qiladi (haqiqiy
              // FieldPath.documentId() qiymatidan qat'i nazar - test
              // sodda tutiladi, faqat `startDateKey`ning o'zi kerak).
              if (subName === "orderRollups") {
                return {
                  where: (_fieldPath, _op, startDateKey) => ({
                    // `id` HAM qo'shildi (haqiqiy Firestore
                    // `QueryDocumentSnapshot`da bo'lgani kabi) -
                    // `execGetSalesDeclineDiagnostic` davrlarni
                    // hujjat ID'sining O'ZI bo'yicha (`d.id`) ajratadi.
                    get: async () => ({ docs: orderRollupDays.filter((d) => d.id >= startDateKey).map((d) => ({ id: d.id, data: () => d })) }),
                  }),
                };
              }
              // YANGI (`get_pending_pricing_suggestions`).
              if (subName === "pricingSuggestions") {
                return {
                  where: (field, _op, value) => {
                    const matched = pricingSuggestions.filter((s) => s[field] === value);
                    return { limit: (n) => ({ get: async () => ({ docs: matched.slice(0, n).map((d) => ({ data: () => d })), size: Math.min(matched.length, n) }) }) };
                  },
                };
              }
              // YANGI (`propose_ad_campaign` -> `lib/aiApprovalEngine.js`):
              // haqiqiy, xotiradagi (`pendingActions` obyekti orqali,
              // chaqiruvchi test tekshira oladi) idempotensiya/holat
              // saqlash - boshqa hech qanday test bu quyi kolleksiya
              // nomlarini ishlatmaydi, shuning uchun ZARARSIZ qo'shimcha.
              if (subName === "aiCeoPendingActions") {
                return {
                  doc: (actionId) => ({
                    get: async () => (pendingActions[actionId] ? { exists: true, data: () => ({ ...pendingActions[actionId] }) } : { exists: false }),
                    set: async (data) => { pendingActions[actionId] = { ...data }; },
                    update: async (data) => { pendingActions[actionId] = { ...pendingActions[actionId], ...data }; },
                  }),
                };
              }
              if (subName === "aiAuditLog") {
                return { add: async (data) => { auditLogs.push(data); } };
              }
              return { doc: () => ({ get: async () => ({ exists: false }), set: async () => {} }) };
            },
          }),
        };
      }
      if (name === "products") {
        // YANGILANDI ("AI Business Manager" uchun): endi `.doc(id).get()`
        // orqali BITTA mahsulotni ID bo'yicha o'qishni ham qo'llab-
        // quvvatlaydi (`execGetSalesDeclineDiagnostic`/
        // `execGetTrendingProducts`ning zaxira-tekshirish qidiruvi
        // uchun) - mavjud `where`/`orderBy`/`limit`/`get` xatti-harakati
        // O'ZGARISHSIZ qoladi.
        return {
          ...makeQueryable(products),
          doc: (id) => {
            const found = products.find((p) => p.id === id);
            return { get: async () => (found ? { exists: true, data: () => found } : { exists: false }) };
          },
        };
      }
      if (name === "orders") {
        // YANGILANDI ("AI Business Manager", 2026-09 punkt-royxati
        // 4-band uchun): endi `.limit()`ni ham qo'llab-quvvatlaydi
        // (yopilish/`closure` asosida, RO'YXATNI haqiqatan qisqartirib) -
        // yangi vositalar (`execGetSalesDeclineDiagnostic` va h.k.)
        // xarajat-xavfsizlik chegarasi sifatida `.limit(N)` chaqiradi.
        // `.where()` hamon ATAYLAB filtrlamaydi (dumb pass-through) -
        // mavjud testlar fixture'ning o'zida kerakli buyurtmalarnigina
        // berish orqali ishlaydi, bu xatti-harakatga tayanadi.
        const makeChain = (list) => ({
          where: () => makeChain(list),
          limit: (n) => makeChain(list.slice(0, n)),
          get: async () => ({ docs: list.map((o) => ({ data: () => o })), size: list.length }),
        });
        return makeChain(orders);
      }
      // MIJOZLAR RAZVEDKASI ("high_intent" belgisi, 9-band):
      // `execGetCustomerIntelligence`/`execPlanAdCampaign`ning
      // `loadHighIntentClientIds` yordamchisi FAQAT `sellerId` bo'yicha
      // TENGLIK filtri ishlatadi - `makeQueryable`ning haqiqiy
      // where/limit/get zanjiri yetarli.
      if (name === "carts") return makeQueryable(carts);
      if (name === "favorites") return makeQueryable(favorites);
      return { doc: () => ({ get: async () => ({ exists: false }) }) };
    },
    // MUHIM: `checkRateLimit` shu orqali ishlaydi - standart holatda
    // "hali chegaradan o'tmagan" holatni simulyatsiya qiladi (bo'sh
    // oyna), shuning uchun aksariyat testlar rate-limit haqida
    // qayg'urmasligi mumkin.
    runTransaction: async (callback) => callback({ get: async () => ({ exists: false }), set: () => {} }),
  };
  db.__pendingActions = pendingActions;
  db.__auditLogs = auditLogs;
  return db;
}

function loadAiCeoAgentModule(mockDb, generateContentMock = jest.fn()) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: {
      firestore: {
        Timestamp: { fromMillis: (ms) => ({ toMillis: () => ms }) },
        FieldPath: { documentId: () => "__name__" },
        // YANGI (`propose_ad_campaign` -> `lib/aiApprovalEngine.js`dagi
        // `createPendingAction`): pending action yozuvi va audit log
        // `serverTimestamp()`dan foydalanadi.
        FieldValue: { serverTimestamp: () => "MOCK_TS" },
      },
    },
    db: mockDb,
    GEMINI_API_KEY: { value: () => "mock-gemini-key" },
  }));
  // `execGetPnlSummary` `lib/rollups.js`dagi `dateKeyFromMillis`ni
  // ishlatadi - haqiqiy (mock qilinmagan) modul, sof funksiya bo'lgani
  // uchun xavfsiz.
  jest.doMock("@google/genai", () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({ models: { generateContent: generateContentMock } })),
  }));
  return require("../aiCeoAgent");
}

describe("clampInt", () => {
  test("son berilgan va oraliqda bo'lsa, O'ZINI qaytaradi", () => {
    const { _testables } = loadAiCeoAgentModule(buildMockDb());
    expect(_testables.clampInt(5, 7, 1, 10)).toBe(5);
  });

  test("son berilmagan/noto'g'ri bo'lsa, FALLBACK qaytaradi", () => {
    const { _testables } = loadAiCeoAgentModule(buildMockDb());
    expect(_testables.clampInt(undefined, 7, 1, 10)).toBe(7);
    expect(_testables.clampInt("noto'g'ri", 7, 1, 10)).toBe(7);
  });

  test("chegaradan CHIQIB ketsa, MIN/MAX'ga qisqartiradi", () => {
    const { _testables } = loadAiCeoAgentModule(buildMockDb());
    expect(_testables.clampInt(999, 7, 1, 10)).toBe(10);
    expect(_testables.clampInt(-5, 7, 1, 10)).toBe(1);
  });
});

describe("execGetRevenueSummary", () => {
  test("FAQAT yetkazilgan buyurtmalardan tushum hisoblaydi, bekor qilish darajasini to'g'ri chiqaradi", async () => {
    const db = buildMockDb({
      orders: [
        { status: "delivered", totalAmount: 100_000 },
        { status: "delivered", totalAmount: 50_000 },
        { status: "cancel", totalAmount: 30_000 },
        { status: "new", totalAmount: 20_000 },
      ],
    });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetRevenueSummary("seller-1", { days: 7 });
    expect(result).toEqual({ days: 7, orderCount: 4, deliveredCount: 2, revenue: 150_000, cancelRatePercent: 25 });
  });

  test("`days` berilmasa, standart 7 kunni ishlatadi", async () => {
    const db = buildMockDb({ orders: [] });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetRevenueSummary("seller-1", {});
    expect(result.days).toBe(7);
    expect(result.orderCount).toBe(0);
  });
});

describe("execGetTopProducts", () => {
  test("eng ko'p sotilgan mahsulotlarni SONI bo'yicha kamayish tartibida qaytaradi", async () => {
    const db = buildMockDb({
      orders: [
        { status: "delivered", orders: [{ name: "Krem", quantity: 2, price: 50_000 }, { name: "Serum", quantity: 1, price: 80_000 }] },
        { status: "delivered", orders: [{ name: "Krem", quantity: 3, price: 50_000 }] },
      ],
    });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetTopProducts("seller-1", { days: 7, limit: 5 });
    expect(result.products).toEqual([
      { name: "Krem", soldQty: 5, revenue: 250_000 },
      { name: "Serum", soldQty: 1, revenue: 80_000 },
    ]);
  });

  test("`limit` parametri natijalar sonini cheklaydi", async () => {
    const db = buildMockDb({
      orders: [
        { status: "delivered", orders: [{ name: "A", quantity: 1, price: 1000 }, { name: "B", quantity: 2, price: 1000 }, { name: "C", quantity: 3, price: 1000 }] },
      ],
    });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetTopProducts("seller-1", { days: 7, limit: 2 });
    expect(result.products).toHaveLength(2);
    expect(result.products[0].name).toBe("C");
  });
});

describe("execGetCustomerSegments", () => {
  test("VIP (yuqori LTV) va uxlab qolgan (30+ kun) mijozlarni TO'G'RI sanaydi", async () => {
    const nowMs = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const db = buildMockDb({
      customers: [
        { ltv: 600_000, lastOrderAtMs: nowMs }, // VIP
        { ltv: 100_000, lastOrderAtMs: nowMs - 40 * DAY_MS }, // churn
        { ltv: 100_000, lastOrderAtMs: nowMs }, // faol, na VIP na churn
      ],
    });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetCustomerSegments("seller-1");
    expect(result).toEqual({ vipCount: 1, churnCount: 1, totalCustomers: 3, isApproximate: false });
  });

  // 2026-09 audit fixi: OOM/timeout xavfini yo'qotish uchun qo'shilgan
  // `limit(CUSTOMER_SEGMENTS_SAMPLE_LIMIT)` xavfsizlik chegarasini
  // haqiqatan tekshiradi — sample chegarasiga urilganda natija
  // `isApproximate: true` bilan belgilanishi SHART, aks holda Gemini
  // taxminiy raqamni "aniq" deb noto'g'ri taqdim qilib qo'yishi mumkin.
  test("mijozlar soni sample chegarasidan (5000) oshsa - natija isApproximate:true bilan belgilanadi", async () => {
    const manyCustomers = Array.from({ length: 5000 }, () => ({ ltv: 0, lastOrderAtMs: Date.now() }));
    const db = buildMockDb({ customers: manyCustomers });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetCustomerSegments("seller-1");
    expect(result.totalCustomers).toBe(5000);
    expect(result.isApproximate).toBe(true);
  });
});

describe("execGetLowStockProducts", () => {
  test("FAQAT 0 dan katta, lekin 5 yoki undan kam zaxirali mahsulotlarni, o'sish tartibida qaytaradi", async () => {
    const db = buildMockDb({
      products: [
        { sellerId: "seller-1", name: "Tugagan", stock: 0 },
        { sellerId: "seller-1", name: "Ko'p", stock: 50 },
        { sellerId: "seller-1", name: "Kam-2", stock: 2 },
        { sellerId: "seller-1", name: "Kam-1", stock: 1 },
        // BOSHQA sotuvchining kam-zaxirali mahsuloti - natijaga
        // HECH QACHON aralashmasligi kerak (tenant isolation, endi
        // Firestore so'rovining o'zida `sellerId` filtri orqali).
        { sellerId: "seller-2", name: "Boshqa sotuvchi", stock: 1 },
      ],
    });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetLowStockProducts("seller-1", { limit: 5 });
    expect(result.lowStock).toEqual([{ name: "Kam-1", stock: 1 }, { name: "Kam-2", stock: 2 }]);
  });
});

describe("execGetAiCeoLearningSummary", () => {
  // AI CEO — 7-BOSQICH ("natija kuzatuvi va o'rganish") bilan
  // BOG'LOVCHI vosita - `aiCeoLearning.js`dagi
  // `buildLearningSummaryForDisplay` BILAN BIR XIL natija berishi kerak.
  test("hujjat mavjud bo'lmasa, ikkala tur ham NULL bo'lgan holatni qaytaradi", async () => {
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true } });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetAiCeoLearningSummary("seller-1");
    expect(result).toEqual({ winback: null, favorite: null });
  });

  test("ma'lumot mavjud bo'lsa, TO'G'RI konversiya foizini hisoblab qaytaradi", async () => {
    const db = buildMockDb({ learningData: { winbackAiSent: 10, winbackAiConverted: 3 } });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetAiCeoLearningSummary("seller-1");
    expect(result).toEqual({ winback: { sentCount: 10, convertedCount: 3, conversionRatePercent: 30 }, favorite: null });
  });
});

describe("execGetRecentAutoDiscounts", () => {
  // AI CEO — 8-BOSQICH ("avtonom harakatlar doirasini kengaytirish")
  // bilan BOG'LOVCHI vosita - `aiCeoAutoDiscount.js` tomonidan
  // yaratilgan HAQIQIY promokod hujjatlarini (allaqachon mavjud
  // `coupons` kolleksiyasidan) o'qiydi.
  test("hech qanday AI CEO chegirmasi bo'lmasa, bo'sh natija qaytaradi", async () => {
    const db = buildMockDb({ coupons: [] });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetRecentAutoDiscounts("seller-1");
    expect(result).toEqual({ totalIssuedCount: 0, activeUnusedCount: 0, recent: [] });
  });

  test("faol/ishlatilmagan sonini TO'G'RI hisoblaydi va ENG YANGI 5tasini qaytaradi", async () => {
    const coupons = [
      { code: "SOGINDIK-A", discountValue: 10, isActive: true, usedCount: 0, usageLimit: 1, createdAtMs: 1000 },
      { code: "SOGINDIK-B", discountValue: 15, isActive: true, usedCount: 1, usageLimit: 1, createdAtMs: 3000 }, // ishlatilgan
      { code: "SOGINDIK-C", discountValue: 5, isActive: false, usedCount: 0, usageLimit: 1, createdAtMs: 2000 }, // faol emas
    ];
    const db = buildMockDb({ coupons });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetRecentAutoDiscounts("seller-1");
    expect(result.totalIssuedCount).toBe(3);
    expect(result.activeUnusedCount).toBe(1); // faqat SOGINDIK-A
    expect(result.recent.map((c) => c.code)).toEqual(["SOGINDIK-B", "SOGINDIK-C", "SOGINDIK-A"]); // eng yangidan eskiga
    expect(result.recent[0]).toEqual({ code: "SOGINDIK-B", discountPercent: 15, used: true });
  });
});

describe("execGetPnlSummary", () => {
  // "AI Business Manager" (Z-Biznes, 2026-09 punkt-royxati 4-band)
  // bilan BOG'LOVCHI vosita - server tomonida OLDINDAN hisoblangan
  // `orderRollups` kunlik yozuvlaridan (`orderRollups.js`) yalpi
  // foydani o'qiydi, o'zi hech narsa qayta hisoblamaydi.
  test("kunlik yozuvlarni jamlab, TO'G'RI yalpi foyda va margin foizini hisoblaydi", async () => {
    // Sana kalitlari ("YYYY-MM-DD") HOZIRGI vaqtga NISBATAN (bir necha
    // kun oldin) - `execGetPnlSummary` `startDateKey`dan KATTA-TENG
    // hujjatlarni oladi, shuning uchun test o'tkazilgan sana bilan
    // emas, "hozir"ga nisbatan qurilishi shart.
    const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
    const yesterdayKey = new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
    const orderRollupDays = [
      { id: yesterdayKey, revenue: 100_000, cogs: 40_000, deliveredCount: 2 },
      { id: todayKey, revenue: 50_000, cogs: 10_000, deliveredCount: 1 },
    ];
    const db = buildMockDb({ orderRollupDays });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetPnlSummary("seller-1", { days: 30 });
    expect(result.revenue).toBe(150_000);
    expect(result.cogs).toBe(50_000);
    expect(result.grossProfit).toBe(100_000);
    expect(result.marginPercent).toBe(67); // 100,000/150,000
    expect(result.deliveredCount).toBe(3);
  });

  test("hech qanday kunlik yozuv bo'lmasa - hammasi 0, margin 0 (0'ga bo'linish yo'q)", async () => {
    const db = buildMockDb({ orderRollupDays: [] });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetPnlSummary("seller-1", { days: 7 });
    expect(result).toEqual(expect.objectContaining({ revenue: 0, cogs: 0, grossProfit: 0, marginPercent: 0, deliveredCount: 0 }));
  });
});

describe("execGetPendingPricingSuggestions", () => {
  // AI narx tavsiyalari (`pricingSuggestions.js`) bilan BOG'LOVCHI
  // vosita - FAQAT O'QISH, narxni hech qachon o'zi o'zgartirmaydi.
  test("kutilayotgan tavsiyalarni TO'G'RI qaytaradi", async () => {
    const pricingSuggestions = [
      { productName: "Krem", type: "slow_mover_discount", currentPrice: 50_000, suggestedPrice: 40_000, changePercent: -20, status: "pending" },
      { productName: "Sovun", type: "high_demand_increase", currentPrice: 20_000, suggestedPrice: 24_000, changePercent: 20, status: "pending" },
    ];
    const db = buildMockDb({ pricingSuggestions });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetPendingPricingSuggestions("seller-1");
    expect(result.pendingCount).toBe(2);
    expect(result.suggestions).toHaveLength(2);
    expect(result.suggestions[0]).toEqual({ productName: "Krem", type: "slow_mover_discount", currentPrice: 50_000, suggestedPrice: 40_000, changePercent: -20 });
  });

  test("kutilayotgan tavsiya bo'lmasa - bo'sh natija qaytaradi", async () => {
    const db = buildMockDb({ pricingSuggestions: [] });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetPendingPricingSuggestions("seller-1");
    expect(result).toEqual({ pendingCount: 0, suggestions: [] });
  });
});

describe("execGetSalesDeclineDiagnostic (AI Business Manager, Z-Biznes)", () => {
  const { dateKeyFromMillis } = require("../lib/rollups");
  const DAY_MS_T = 24 * 60 * 60 * 1000;

  test("joriy va oldingi davrni TO'G'RI taqqoslaydi, yetarli tarixi bo'lmagan mahsulotni chiqarib tashlaydi, zaxirani qo'shadi", async () => {
    const now = Date.now();
    const days = 30;
    const currentStart = now - days * DAY_MS_T;
    const previousStart = currentStart - days * DAY_MS_T;

    const orders = [
      // "Krem" - oldingi davrda 10 dona (yetarli tarix), joriy davrda 2 dona -> -80% (pasaygan deb belgilanishi SHART).
      { status: "delivered", totalAmount: 500_000, createdAt: { toMillis: () => previousStart + 5 * DAY_MS_T }, orders: [{ id: "krem-1", name: "Krem", quantity: 10, price: 50_000 }] },
      { status: "delivered", totalAmount: 100_000, createdAt: { toMillis: () => currentStart + 5 * DAY_MS_T }, orders: [{ id: "krem-1", name: "Krem", quantity: 2, price: 50_000 }] },
      // "Serum" - oldingi davrda FAQAT 2 dona (chegaradan - `DECLINE_MIN_PREVIOUS_UNITS=3` - kam) -> HISOBGA OLINMASLIGI SHART.
      { status: "delivered", totalAmount: 20_000, createdAt: { toMillis: () => previousStart + 2 * DAY_MS_T }, orders: [{ id: "serum-1", name: "Serum", quantity: 2, price: 10_000 }] },
      // Joriy davrda bekor qilingan buyurtma - bekor qilish darajasiga ta'sir qilishi SHART.
      { status: "cancel", totalAmount: 30_000, createdAt: { toMillis: () => currentStart + 1 * DAY_MS_T }, orders: [] },
    ];
    const products = [{ id: "krem-1", stock: 3 }];
    const orderRollupDays = [
      { id: dateKeyFromMillis(currentStart + 2 * DAY_MS_T), newCustomersCount: 4 },
      { id: dateKeyFromMillis(previousStart + 2 * DAY_MS_T), newCustomersCount: 7 },
    ];

    const db = buildMockDb({ orders, products, orderRollupDays });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetSalesDeclineDiagnostic("seller-1", { days });

    expect(result.current).toEqual({ revenue: 100_000, orderCount: 2, deliveredCount: 1, cancelRatePercent: 50 });
    expect(result.previous).toEqual({ revenue: 520_000, orderCount: 2, deliveredCount: 2, cancelRatePercent: 0 });
    expect(result.revenueChangePercent).toBeCloseTo(-80.8, 1);
    expect(result.topDecliningProducts).toEqual([{ name: "Krem", previousUnits: 10, currentUnits: 2, changePercent: -80, currentStock: 3 }]);
    expect(result.topDecliningProducts.find((p) => p.name === "Serum")).toBeUndefined();
    expect(result.newCustomersCurrent).toBe(4);
    expect(result.newCustomersPrevious).toBe(7);
    expect(result.isApproximate).toBe(false);
    expect(result.note).toContain("sabab-oqibat");
  });

  test("hech qanday buyurtma bo'lmasa - 0'ga bo'linish YO'Q, bo'sh natija qaytaradi", async () => {
    const db = buildMockDb({ orders: [] });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetSalesDeclineDiagnostic("seller-1", { days: 30 });
    expect(result.current).toEqual({ revenue: 0, orderCount: 0, deliveredCount: 0, cancelRatePercent: 0 });
    expect(result.revenueChangePercent).toBeNull();
    expect(result.topDecliningProducts).toEqual([]);
  });
});

describe("execPlanAdCampaign (AI Business Manager, Z-Biznes)", () => {
  const DAY_MS_T = 24 * 60 * 60 * 1000;
  const nowMs = Date.now();

  // MIJOZLAR RAZVEDKASI (9-band) 7-segment tasnifiga ko'chirilgandan
  // keyin: vip (o'zgarmadi), churn_risk (eski "churn"), new
  // (o'zgarmadi), returning (eski "regular").
  function buildCustomers() {
    return [
      { clientId: "c1", ltv: 600_000, lastOrderAtMs: nowMs, orderCount: 5 }, // vip
      { clientId: "c2", ltv: 100_000, lastOrderAtMs: nowMs - 40 * DAY_MS_T, orderCount: 2 }, // churn_risk
      { clientId: "c3", ltv: 100_000, lastOrderAtMs: nowMs - 45 * DAY_MS_T, orderCount: 3 }, // churn_risk
      { clientId: "c4", ltv: 50_000, lastOrderAtMs: nowMs, orderCount: 1 }, // new
      { clientId: "c5", ltv: 50_000, lastOrderAtMs: nowMs, orderCount: 2 }, // returning
    ];
  }

  function buildOrdersForAovAndPeakHour() {
    return [
      { status: "delivered", totalAmount: 100_000, createdAt: { toMillis: () => Date.UTC(2026, 0, 1, 5, 0, 0) } }, // Toshkent 10:00
      { status: "delivered", totalAmount: 200_000, createdAt: { toMillis: () => Date.UTC(2026, 0, 1, 5, 30, 0) } }, // Toshkent 10:30 (bir xil soat)
      { status: "delivered", totalAmount: 300_000, createdAt: { toMillis: () => Date.UTC(2026, 0, 1, 10, 0, 0) } }, // Toshkent 15:00
    ];
  }

  test("segmentda mijoz bo'lmasa - 0'ga bo'linishsiz, halol xabar bilan qaytaradi", async () => {
    const db = buildMockDb({ customers: [{ ltv: 50_000, lastOrderAtMs: nowMs, orderCount: 2 }] }); // faqat "regular"
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execPlanAdCampaign("seller-1", { budget: 200_000, segment: "vip" });
    expect(result.recipientCount).toBe(0);
    expect(result.maxDiscountPerRecipient).toBeUndefined();
    expect(result.note).toContain("segment");
  });

  test("byudjet/segment bo'yicha TO'G'RI reja tuzadi - chegirma chegarasi, AOV va HAQIQIY eng maqbul soat", async () => {
    const db = buildMockDb({ customers: buildCustomers(), orders: buildOrdersForAovAndPeakHour() });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execPlanAdCampaign("seller-1", { budget: 200_000, segment: "churn_risk" });
    expect(result.recipientCount).toBe(2);
    expect(result.maxDiscountPerRecipient).toBe(100_000);
    expect(result.averageOrderValue).toBe(200_000);
    expect(result.peakOrderHourTashkent).toBe(10);
    expect(result.suggestedSendHourTashkent).toBe(9);
    expect(result.isApproximateRecipientCount).toBe(false);
    expect(result.suggestedMessageAngle).toContain("QAYTARISH");
    expect(result.note).toContain("ENG YUQORI CHEGARA");
  });

  test("byudjet minimal chegaradan kichik bo'lsa - MINga qisqartiriladi, noma'lum segment 'all'ga tushadi", async () => {
    const db = buildMockDb({ customers: buildCustomers(), orders: buildOrdersForAovAndPeakHour() });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execPlanAdCampaign("seller-1", { budget: 100, segment: "noma'lum-segment" });
    expect(result.budget).toBe(10_000);
    expect(result.segment).toBe("all");
    expect(result.recipientCount).toBe(5);
  });

  // MIJOZLAR RAZVEDKASI (9-band): `tag: "high_intent"` berilganda,
  // FAQAT o'sha paytda savatcha/sevimlilar so'rovi chiqishi va
  // natija TO'G'RI filtrlanishi kerak.
  test("tag: 'high_intent' berilsa - FAQAT faol savatcha/sevimlilarga ega mijozlar hisoblanadi", async () => {
    const db = buildMockDb({
      customers: buildCustomers(),
      orders: buildOrdersForAovAndPeakHour(),
      carts: [{ sellerId: "seller-1", clientId: "c2", status: "active", items: [{ id: "p1", quantity: 1 }] }],
    });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execPlanAdCampaign("seller-1", { budget: 200_000, segment: "churn_risk", tag: "high_intent" });
    // churn_risk segmentida 2 ta mijoz bor (c2, c3), lekin FAQAT c2'ning faol savatchasi bor.
    expect(result.recipientCount).toBe(1);
    expect(result.tag).toBe("high_intent");
  });

  test("tag berilmasa - savatcha/sevimlilar so'rovi UMUMAN chiqarilmaydi (xarajat nazorati)", async () => {
    let cartsQueried = false;
    const db = buildMockDb({ customers: buildCustomers(), orders: buildOrdersForAovAndPeakHour() });
    const originalCollection = db.collection;
    db.collection = (name) => {
      if (name === "carts") cartsQueried = true;
      return originalCollection(name);
    };
    const { _testables } = loadAiCeoAgentModule(db);
    await _testables.execPlanAdCampaign("seller-1", { budget: 200_000, segment: "vip" });
    expect(cartsQueried).toBe(false);
  });
});

describe("execProposeAdCampaign (YANGI - YOZISH qobiliyatiga ega birinchi vosita, Z-Biznes)", () => {
  const nowMs2 = Date.now();
  function buildProposeCustomers() {
    return [
      { clientId: "c1", ltv: 600_000, lastOrderAtMs: nowMs2, orderCount: 5 }, // vip
      { clientId: "c2", ltv: 100_000, lastOrderAtMs: nowMs2 - 40 * 24 * 60 * 60 * 1000, orderCount: 2 }, // churn_risk
    ];
  }
  const validArgs = { budget: 200_000, segment: "vip", discountPercent: 12, title: "Bahorgi aksiya", message: "Sizga maxsus taklif!" };

  test("to'g'ri kirish bilan HAQIQIY pending action yaratadi - hali hech kimga yuborilmagan", async () => {
    const db = buildMockDb({ customers: buildProposeCustomers() });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execProposeAdCampaign("seller-1", validArgs);

    expect(result.proposed).toBe(true);
    expect(result.isNewProposal).toBe(true);
    expect(result.requiresApproval).toBe(true);
    expect(result.riskLevel).toBe("MEDIUM");
    expect(result.recipientCount).toBe(1); // faqat c1 (vip)
    expect(result.note).toContain("tasdig'ini kutmoqda");

    const stored = Object.values(db.__pendingActions)[0];
    expect(stored.status).toBe("pending");
    expect(stored.segment).toBe("vip");
    expect(stored.discountPercent).toBe(12);
    expect(stored.targetClientIds).toEqual(["c1"]);
    expect(stored.actionType).toBe("adCampaign");
  });

  test("BIR XIL parametrlar bilan qayta chaqirilsa - DUBLIKAT yaratmaydi (idempotensiya)", async () => {
    const db = buildMockDb({ customers: buildProposeCustomers() });
    const { _testables } = loadAiCeoAgentModule(db);
    await _testables.execProposeAdCampaign("seller-1", validArgs);
    const result2 = await _testables.execProposeAdCampaign("seller-1", validArgs);

    expect(result2.proposed).toBe(true);
    expect(result2.isNewProposal).toBe(false);
    expect(Object.keys(db.__pendingActions).length).toBe(1);
  });

  test("segmentda mijoz bo'lmasa - taklif YARATILMAYDI (bo'sh pending action)", async () => {
    const db = buildMockDb({ customers: [{ clientId: "c9", ltv: 10_000, lastOrderAtMs: nowMs2, orderCount: 1 }] }); // faqat "new"
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execProposeAdCampaign("seller-1", { ...validArgs, segment: "vip" });

    expect(result.proposed).toBe(false);
    expect(result.note).toContain("YARATILMADI");
    expect(Object.keys(db.__pendingActions).length).toBe(0);
  });

  test("title yoki message bo'lmasa - taklif YARATILMAYDI, tushunarli xato qaytaradi", async () => {
    const db = buildMockDb({ customers: buildProposeCustomers() });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execProposeAdCampaign("seller-1", { ...validArgs, title: "" });
    expect(result.proposed).toBe(false);
    expect(result.error).toBeDefined();
    expect(Object.keys(db.__pendingActions).length).toBe(0);
  });

  test("chegirma foizi chegaradan tashqarida bo'lsa - xavfsiz oralig'ga QISQARTIRILADI (rad etilmaydi)", async () => {
    const db = buildMockDb({ customers: buildProposeCustomers() });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execProposeAdCampaign("seller-1", { ...validArgs, discountPercent: 999 });
    expect(result.proposed).toBe(true);
    const stored = Object.values(db.__pendingActions)[0];
    expect(stored.discountPercent).toBeLessThanOrEqual(30);
  });

  test("katta byudjet bilan HIGH xavf darajasiga o'tadi (Approval Engine to'g'ri ishlayotganini tasdiqlaydi)", async () => {
    const db = buildMockDb({ customers: buildProposeCustomers() });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execProposeAdCampaign("seller-1", { ...validArgs, discountPercent: 25 });
    expect(result.riskLevel).toBe("HIGH");
    expect(result.requiresApproval).toBe(true);
  });
});

describe("execGetCustomerIntelligence (Mijozlar razvedkasi, Z-Biznes, 9-band)", () => {
  const DAY_MS_T = 24 * 60 * 60 * 1000;
  const nowMs = Date.now();

  function buildCustomers() {
    return [
      { clientId: "c1", fullName: "Vip Ali", ltv: 600_000, lastOrderAtMs: nowMs, orderCount: 5, couponOrderCount: 0 },
      { clientId: "c2", fullName: "Chegirma Vali", ltv: 50_000, lastOrderAtMs: nowMs, orderCount: 2, couponOrderCount: 2 },
      { clientId: "c3", fullName: "Uxlab Qolgan", ltv: 30_000, lastOrderAtMs: nowMs - 100 * DAY_MS_T, orderCount: 2, couponOrderCount: 0 },
    ];
  }

  test("segment berilmasa (all) - BARCHA segment/belgilarning umumiy sonini qaytaradi", async () => {
    const db = buildMockDb({ customers: buildCustomers() });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetCustomerIntelligence("seller-1", {});
    expect(result.segment).toBe("all");
    expect(result.counts.all).toBe(3);
    expect(result.counts.vip).toBe(1);
    expect(result.counts.sleeping).toBe(1);
    expect(result.tagCounts.discount_hunter).toBe(1);
    expect(result.matchingCount).toBe(3);
  });

  test("segment berilsa - FAQAT o'sha segmentga mos mijozlar namunasi qaytadi", async () => {
    const db = buildMockDb({ customers: buildCustomers() });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetCustomerIntelligence("seller-1", { segment: "sleeping" });
    expect(result.matchingCount).toBe(1);
    expect(result.sample).toHaveLength(1);
    expect(result.sample[0].fullName).toBe("Uxlab Qolgan");
    expect(result.sample[0].primarySegment).toBe("sleeping");
  });

  test("tag: 'discount_hunter' berilsa - FAQAT shu belgiga ega mijozlar qaytadi", async () => {
    const db = buildMockDb({ customers: buildCustomers() });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetCustomerIntelligence("seller-1", { tag: "discount_hunter" });
    expect(result.matchingCount).toBe(1);
    expect(result.sample[0].fullName).toBe("Chegirma Vali");
    expect(result.sample[0].tags).toContain("discount_hunter");
  });

  test("tag: 'high_intent' - FAOL savatchasi bor mijoz TO'G'RI aniqlanadi", async () => {
    const db = buildMockDb({
      customers: buildCustomers(),
      favorites: [{ sellerId: "seller-1", clientId: "c1", items: [{ id: "p1" }] }],
    });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetCustomerIntelligence("seller-1", { tag: "high_intent" });
    expect(result.matchingCount).toBe(1);
    expect(result.sample[0].fullName).toBe("Vip Ali");
  });

  test("noto'g'ri/noma'lum segment yoki tag berilsa - jim ravishda standart ('all'/hech qanday) holatga tushadi", async () => {
    const db = buildMockDb({ customers: buildCustomers() });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetCustomerIntelligence("seller-1", { segment: "noto'g'ri", tag: "noto'g'ri" });
    expect(result.segment).toBe("all");
    expect(result.tag).toBeNull();
    expect(result.matchingCount).toBe(3);
  });
});

describe("execGetTrendingProducts (AI Business Manager, Z-Biznes)", () => {
  const DAY_MS_T = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const recentStart = now - 3 * DAY_MS_T;
  const baselineStart = now - 17 * DAY_MS_T;

  test("faqat OMBORDA MAVJUD mahsulotlarni, tendentsiya ko'paytiruvchisi bilan saralangan holda qaytaradi", async () => {
    const orders = [
      // "A" - bazaviy davrda 14 dona (kunlik o'rtacha 1), joriy davrda 6 dona (kunlik o'rtacha 2) -> 2x tendentsiya.
      { status: "delivered", createdAt: { toMillis: () => baselineStart + 2 * DAY_MS_T }, orders: [{ id: "a1", name: "A", quantity: 14 }] },
      { status: "delivered", createdAt: { toMillis: () => recentStart + 1 * DAY_MS_T }, orders: [{ id: "a1", name: "A", quantity: 6 }] },
      // "B" - bazaviy tarix YO'Q, faqat joriy davrda 3 dona sotilgan (ombordan tugagan - CHIQARIB TASHLANISHI SHART).
      { status: "delivered", createdAt: { toMillis: () => recentStart + 1 * DAY_MS_T }, orders: [{ id: "b1", name: "B", quantity: 3 }] },
    ];
    const products = [{ id: "a1", stock: 5 }, { id: "b1", stock: 0 }];
    const db = buildMockDb({ orders, products });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetTrendingProducts("seller-1", {});

    expect(result.products).toEqual([
      { name: "A", recentUnitsSold: 6, baselineDailyAverage: 1, momentumRatio: 2, currentStock: 5, isNewOrRarelyPreviouslySold: false },
    ]);
    expect(result.method).toBe("deterministic_heuristic");
    expect(result.note).toContain("HAQIQIY sun'iy intellekt");
  });

  test("bazaviy tarixi bo'lmagan (yangi) mahsulot - `isNewOrRarelyPreviouslySold:true` bilan belgilanadi", async () => {
    const orders = [
      { status: "delivered", createdAt: { toMillis: () => recentStart + 1 * DAY_MS_T }, orders: [{ id: "b1", name: "Yangi mahsulot", quantity: 5 }] },
    ];
    const products = [{ id: "b1", stock: 4 }];
    const db = buildMockDb({ orders, products });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetTrendingProducts("seller-1", { limit: 10 });
    expect(result.products).toEqual([
      { name: "Yangi mahsulot", recentUnitsSold: 5, baselineDailyAverage: 0, momentumRatio: null, currentStock: 4, isNewOrRarelyPreviouslySold: true },
    ]);
  });

  test("`limit` parametri natijalar sonini cheklaydi", async () => {
    const orders = [
      { status: "delivered", createdAt: { toMillis: () => recentStart + 1 * DAY_MS_T }, orders: [{ id: "p1", name: "P1", quantity: 10 }, { id: "p2", name: "P2", quantity: 5 }] },
    ];
    const products = [{ id: "p1", stock: 5 }, { id: "p2", stock: 5 }];
    const db = buildMockDb({ orders, products });
    const { _testables } = loadAiCeoAgentModule(db);
    const result = await _testables.execGetTrendingProducts("seller-1", { limit: 1 });
    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe("P1");
  });
});

describe("runToolCallingLoop", () => {
  test("Gemini DARHOL matn bilan javob bersa (vosita chaqirmasa), BITTA turda tugaydi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({ text: "Javob tayyor.", functionCalls: undefined });
    const db = buildMockDb();
    const { _testables } = loadAiCeoAgentModule(db, generateContentMock);
    const result = await _testables.runToolCallingLoop({
      prompt: "test", toolDeclarations: [], executors: {}, executorContext: "seller-1",
    });
    expect(result).toEqual({ text: "Javob tayyor.", toolsUsed: [] });
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  test("Gemini vosita chaqirsa, NATIJANI oladi va YAKUNIY matn bilan javob beradi (2 turli suhbat)", async () => {
    const generateContentMock = jest.fn()
      .mockResolvedValueOnce({ functionCalls: [{ id: "1", name: "get_revenue_summary", args: { days: 7 } }] })
      .mockResolvedValueOnce({ text: "Bu hafta tushum 150,000 so'm.", functionCalls: undefined });
    const executor = jest.fn().mockResolvedValue({ revenue: 150_000 });
    const db = buildMockDb();
    const { _testables } = loadAiCeoAgentModule(db, generateContentMock);
    const result = await _testables.runToolCallingLoop({
      prompt: "test",
      toolDeclarations: [{ name: "get_revenue_summary" }],
      executors: { get_revenue_summary: executor },
      executorContext: "seller-1",
    });
    expect(result.text).toBe("Bu hafta tushum 150,000 so'm.");
    expect(result.toolsUsed).toEqual([{ name: "get_revenue_summary", args: { days: 7 } }]);
    expect(executor).toHaveBeenCalledWith("seller-1", { days: 7 });
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });

  test("noma'lum vosita chaqirilsa, XATOSIZ davom etadi (functionResponse'da xato xabari bilan)", async () => {
    const generateContentMock = jest.fn()
      .mockResolvedValueOnce({ functionCalls: [{ id: "1", name: "hech_qanday_vosita", args: {} }] })
      .mockResolvedValueOnce({ text: "Yakuniy javob.", functionCalls: undefined });
    const db = buildMockDb();
    const { _testables } = loadAiCeoAgentModule(db, generateContentMock);
    const result = await _testables.runToolCallingLoop({
      prompt: "test", toolDeclarations: [], executors: {}, executorContext: "seller-1",
    });
    expect(result.text).toBe("Yakuniy javob.");
    // Ikkinchi (yakuniy) chaqiruvga uzatilgan "contents"da functionResponse
    // xato bilan borganini bilvosita tekshiramiz - jarayon YIQILMAGANI
    // (davom etganligi) o'zi asosiy tasdiq.
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });

  test("vosita bajaruvchisi XATO tashlasa, jarayon YIQILMAYDI - xato natija sifatida qaytariladi", async () => {
    const generateContentMock = jest.fn()
      .mockResolvedValueOnce({ functionCalls: [{ id: "1", name: "buzilgan_vosita", args: {} }] })
      .mockResolvedValueOnce({ text: "Baribir javob berdim.", functionCalls: undefined });
    const brokenExecutor = jest.fn().mockRejectedValue(new Error("Firestore xatosi"));
    const db = buildMockDb();
    const { _testables } = loadAiCeoAgentModule(db, generateContentMock);
    const result = await _testables.runToolCallingLoop({
      prompt: "test",
      toolDeclarations: [],
      executors: { buzilgan_vosita: brokenExecutor },
      executorContext: "seller-1",
    });
    expect(result.text).toBe("Baribir javob berdim.");
  });

  test("Gemini 3 `thoughtSignature`ni (candidate.content orqali) KEYINGI turga O'ZGARISHSIZ uzatadi - vosita chaqirilgandan keyin bu maydon yo'qolib qolmasligi kerak (aks holda API 'missing thought_signature' 400-xatosi qaytaradi)", async () => {
    const modelContentWithSignature = {
      role: "model",
      parts: [{ functionCall: { id: "1", name: "get_revenue_summary", args: { days: 7 } }, thoughtSignature: "opaque-signature-abc" }],
    };
    const generateContentMock = jest.fn()
      .mockResolvedValueOnce({
        functionCalls: [{ id: "1", name: "get_revenue_summary", args: { days: 7 } }],
        candidates: [{ content: modelContentWithSignature }],
      })
      .mockResolvedValueOnce({ text: "Bu hafta tushum 150,000 so'm.", functionCalls: undefined });
    const executor = jest.fn().mockResolvedValue({ revenue: 150_000 });
    const db = buildMockDb();
    const { _testables } = loadAiCeoAgentModule(db, generateContentMock);
    await _testables.runToolCallingLoop({
      prompt: "test",
      toolDeclarations: [{ name: "get_revenue_summary" }],
      executors: { get_revenue_summary: executor },
      executorContext: "seller-1",
    });
    // Ikkinchi (keyingi) `generateContent` chaqiruviga uzatilgan `contents`
    // ichida, model turi ASL `thoughtSignature`ni saqlab qolgani SHART -
    // qo'lda `{ functionCall: c }` qayta qurish bu maydonni tushirib
    // qoldirar edi (chunki u `FunctionCall` emas, `Part` darajasida).
    const secondCallArgs = generateContentMock.mock.calls[1][0];
    const modelTurn = secondCallArgs.contents.find((c) => c.role === "model");
    expect(modelTurn).toEqual(modelContentWithSignature);
    expect(modelTurn.parts[0].thoughtSignature).toBe("opaque-signature-abc");
  });

  test("XAVFSIZLIK CHEGARASI: Gemini CHEKSIZ vosita chaqirsa ham, `maxRounds`dan keyin to'xtaydi (bo'sh matn bilan)", async () => {
    // Gemini HAR DOIM vosita chaqiryapti deb simulyatsiya qilamiz (hech
    // qachon yakuniy matn bermaydi) - bu, real hayotda, Gemini'ning
    // "gallyutsinatsiya"si yoki noto'g'ri konfiguratsiya bilan sodir
    // bo'lishi mumkin. MUHIM: loop CHEKSIZ aylanmasligi kerak.
    const generateContentMock = jest.fn().mockResolvedValue({ functionCalls: [{ id: "x", name: "get_revenue_summary", args: {} }] });
    const executor = jest.fn().mockResolvedValue({ ok: true });
    const db = buildMockDb();
    const { _testables } = loadAiCeoAgentModule(db, generateContentMock);
    const result = await _testables.runToolCallingLoop({
      prompt: "test",
      toolDeclarations: [{ name: "get_revenue_summary" }],
      executors: { get_revenue_summary: executor },
      executorContext: "seller-1",
      maxRounds: 2,
    });
    expect(result.text).toBe("");
    expect(generateContentMock).toHaveBeenCalledTimes(2);
    expect(result.toolsUsed).toHaveLength(2);
  });
});

describe("buildAskAiCeoPrompt", () => {
  test("savol va do'kon nomini promptga TO'G'RI kiritadi", () => {
    const { _testables } = loadAiCeoAgentModule(buildMockDb());
    const prompt = _testables.buildAskAiCeoPrompt("Bu hafta nima sotildi?", "Gulnora Cosmetics");
    expect(prompt).toContain("Bu hafta nima sotildi?");
    expect(prompt).toContain("Gulnora Cosmetics");
  });

  test("do'kon nomi berilmasa, standart \"Do'kon\"ni ishlatadi", () => {
    const { _testables } = loadAiCeoAgentModule(buildMockDb());
    const prompt = _testables.buildAskAiCeoPrompt("Savol", null);
    expect(prompt).toContain("\"Do'kon\"");
  });

  test("15-NICHE: berilgan niche'ning AI konteksti promptga kiritiladi (kosmetikaga qattiq bog'lanmagan)", () => {
    const { getNicheConfig } = require("../lib/niches");
    const { _testables } = loadAiCeoAgentModule(buildMockDb());
    const prompt = _testables.buildAskAiCeoPrompt("Savol", "Zelo", "Avto ehtiyot qismlari");
    expect(prompt).toContain(getNicheConfig("Avto ehtiyot qismlari").aiContext);
  });

  test("niche berilmasa, xato bermaydi ('Boshqa' zaxira sohasiga tushadi)", () => {
    const { _testables } = loadAiCeoAgentModule(buildMockDb());
    const prompt = _testables.buildAskAiCeoPrompt("Savol", "Zelo");
    expect(prompt).toContain("AI CEO yordamchisisan");
  });
});

describe("handleAskAiCeo", () => {
  test("tizimga kirmagan foydalanuvchini rad etadi", async () => {
    const { _testables } = loadAiCeoAgentModule(buildMockDb());
    await expect(_testables.handleAskAiCeo({ auth: null, data: { question: "Savol" } }))
      .rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("premium bo'lmagan sotuvchini rad etadi", async () => {
    const db = buildMockDb({ sellerData: { aiCeoEnabled: false } });
    const { _testables } = loadAiCeoAgentModule(db);
    await expect(_testables.handleAskAiCeo({ auth: { uid: "seller-1" }, data: { question: "Savol" } }))
      .rejects.toMatchObject({ code: "permission-denied" });
  });

  test("bo'sh savolni rad etadi", async () => {
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true } });
    const { _testables } = loadAiCeoAgentModule(db);
    await expect(_testables.handleAskAiCeo({ auth: { uid: "seller-1" }, data: { question: "   " } }))
      .rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("juda uzun (300 belgidan ortiq) savolni rad etadi", async () => {
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true } });
    const { _testables } = loadAiCeoAgentModule(db);
    await expect(_testables.handleAskAiCeo({ auth: { uid: "seller-1" }, data: { question: "a".repeat(301) } }))
      .rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("muvaffaqiyatli holatda, javob VA ishlatilgan vositalar nomlarini qaytaradi", async () => {
    const generateContentMock = jest.fn()
      .mockResolvedValueOnce({ functionCalls: [{ id: "1", name: "get_revenue_summary", args: { days: 7 } }] })
      .mockResolvedValueOnce({ text: "Bu hafta tushum 150,000 so'm bo'ldi.", functionCalls: undefined });
    const db = buildMockDb({
      sellerData: { aiCeoEnabled: true, storeName: "Gulnora Cosmetics" },
      orders: [{ status: "delivered", totalAmount: 150_000 }],
    });
    const { _testables } = loadAiCeoAgentModule(db, generateContentMock);
    const result = await _testables.handleAskAiCeo({ auth: { uid: "seller-1" }, data: { question: "Bu hafta tushum qancha?" } });
    expect(result).toEqual({ answer: "Bu hafta tushum 150,000 so'm bo'ldi.", toolsUsed: ["get_revenue_summary"] });
  });

  test("AI bo'sh javob qaytarsa (yoki umuman javob bera olmasa), ICHKI xatolik tashlaydi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({ text: "", functionCalls: undefined });
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true } });
    const { _testables } = loadAiCeoAgentModule(db, generateContentMock);
    await expect(_testables.handleAskAiCeo({ auth: { uid: "seller-1" }, data: { question: "Savol" } }))
      .rejects.toMatchObject({ code: "internal" });
  });

  // "AI Business Manager" (2026-09 punkt-royxati, 4-band) - Z-BIZNES'GA
  // XOS gatelash: chuqurroq vositalar FAQAT samarali tarifi "biznes"
  // bo'lgan sotuvchiga Gemini'ga TAQDIM ETILADI (Gemini e'lon
  // qilinmagan vositani chaqira olmaydi - shuning uchun bu haqiqiy
  // xavfsizlik chegarasi, faqat "aytish"/prompt darajasidagi cheklov
  // emas).
  describe("Z-Biznes'ga xos vositalarni gatelash", () => {
    test("tarifi 'biznes' bo'lgan sotuvchi uchun, Gemini'ga BIZNES vositalari HAM taqdim etiladi", async () => {
      const generateContentMock = jest.fn().mockResolvedValue({ text: "Javob.", functionCalls: undefined });
      const db = buildMockDb({ sellerData: { aiCeoEnabled: true, tariffPlan: "biznes" } });
      const { _testables } = loadAiCeoAgentModule(db, generateContentMock);
      await _testables.handleAskAiCeo({ auth: { uid: "seller-1" }, data: { question: "Savol" } });

      const firstCallArgs = generateContentMock.mock.calls[0][0];
      const sentToolNames = firstCallArgs.config.tools[0].functionDeclarations.map((d) => d.name);
      expect(sentToolNames).toEqual(expect.arrayContaining(["get_sales_decline_diagnostic", "plan_ad_campaign", "get_trending_products"]));
    });

    test("tarifi 'pro' bo'lgan sotuvchi uchun, BIZNES vositalari Gemini'ga UMUMAN taqdim ETILMAYDI", async () => {
      const generateContentMock = jest.fn().mockResolvedValue({ text: "Javob.", functionCalls: undefined });
      const db = buildMockDb({ sellerData: { aiCeoEnabled: true, tariffPlan: "pro" } });
      const { _testables } = loadAiCeoAgentModule(db, generateContentMock);
      await _testables.handleAskAiCeo({ auth: { uid: "seller-1" }, data: { question: "Savol" } });

      const firstCallArgs = generateContentMock.mock.calls[0][0];
      const sentToolNames = firstCallArgs.config.tools[0].functionDeclarations.map((d) => d.name);
      expect(sentToolNames).not.toEqual(expect.arrayContaining(["get_sales_decline_diagnostic", "plan_ad_campaign", "get_trending_products"]));
      expect(sentToolNames).toContain("get_revenue_summary"); // bazaviy vositalar hamon mavjud
    });

    test("Z-Pro sotuvchisi FAOL Z-Biznes SINOVIDA bo'lsa, BIZNES vositalari taqdim etiladi", async () => {
      const generateContentMock = jest.fn().mockResolvedValue({ text: "Javob.", functionCalls: undefined });
      const db = buildMockDb({
        sellerData: {
          aiCeoEnabled: true,
          tariffPlan: "pro",
          tariffTrialActive: true,
          tariffTrialPlan: "biznes",
          tariffTrialExpiresAt: Date.now() + 3 * 24 * 60 * 60 * 1000,
        },
      });
      const { _testables } = loadAiCeoAgentModule(db, generateContentMock);
      await _testables.handleAskAiCeo({ auth: { uid: "seller-1" }, data: { question: "Savol" } });

      const firstCallArgs = generateContentMock.mock.calls[0][0];
      const sentToolNames = firstCallArgs.config.tools[0].functionDeclarations.map((d) => d.name);
      expect(sentToolNames).toEqual(expect.arrayContaining(["get_sales_decline_diagnostic", "plan_ad_campaign", "get_trending_products"]));
    });
  });
});
