/**
 * `aiCeo.js`dagi SOF funksiyalar (`buildDigestStats`, `buildDigestPrompt`)
 * uchun testlar. Bu ikkalasi ham Firestore/Gemini'ga BOG'LIQ EMAS -
 * shuning uchun to'g'ridan-to'g'ri, hech qanday tarmoq so'rovisiz
 * test qilinadi.
 *
 * ASOSIY MAQSAD: raqamli hisob-kitoblarning (tushum, foyda, foiz
 * o'zgarish) TO'G'RILIGINI tasdiqlash - bular Gemini'ga yuboriladigan
 * "haqiqat manbai" bo'lgani uchun, bu yerda xato bo'lsa, AI HAM
 * xato ma'lumot asosida yozadi ("garbage in, garbage out").
 */

// MUHIM: `lib/sentry.js` HAQIQIY `@sentry/node` paketini talab qiladi
// va `SENTRY_DSN.value()`ni chaqiradi - test muhitida bu HAQIQIY
// Firebase Functions muhiti bo'lmagani uchun, buni SOXTALASHTIRAMIZ
// (aks holda testlar `@sentry/node` o'rnatilmagan bo'lsa yoki secret
// noto'g'ri ishlasa, KUTILMAGANDA buzilib qolishi mumkin edi).
// `jest.mock` (`jest.doMock` EMAS) ataylab ishlatildi - bu HOISTED
// bo'lib, BUTUN fayl uchun, `jest.resetModules()` chaqirilishidan
// QAT'I NAZAR, doimiy qo'llaniladi.
jest.mock("../lib/sentry", () => ({
  withSentry: (fn) => fn,
  SENTRY_DSN: { value: () => null },
  Sentry: { captureException: jest.fn() },
  initSentry: jest.fn(),
}));

function loadAiCeoModule() {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: { firestore: { Timestamp: { fromMillis: (ms) => ({ toMillis: () => ms }) } } },
    db: {},
    BOT_TOKEN: { value: () => "mock-bot-token" },
    GEMINI_API_KEY: { value: () => "mock-gemini-key" },
  }));
  jest.doMock("../lib/helpers", () => ({
    sendTelegramMessage: jest.fn(),
  }));
  jest.doMock("@google/genai", () => ({
    GoogleGenAI: jest.fn(),
  }));
  return require("../aiCeo");
}

/**
 * `generateAnalyticsInsight`/`generateWinBackMessage` uchun -
 * bularga, oddiy sof funksiyalardan farqli, sotuvchining
 * `aiCeoEnabled` bayrog'ini o'qish (premium tekshiruvi) va
 * `checkRateLimit` (o'zining `db.runTransaction`i) kerak - shuning
 * uchun BOSHQACHA, to'liqroq `db` maketi (mock) kerak.
 */
function loadAiCeoModuleWithDb({ sellerData = null } = {}, generateContentMock = jest.fn()) {
  jest.resetModules();
  const db = {
    collection: (name) => {
      if (name === "sellers") {
        return { doc: () => ({ get: async () => (sellerData ? { exists: true, data: () => sellerData } : { exists: false }) }) };
      }
      return { doc: () => ({ get: async () => ({ exists: false }) }) };
    },
    runTransaction: async (callback) => callback({ get: async () => ({ exists: false }), set: () => {} }),
  };
  jest.doMock("../lib/admin", () => ({
    admin: { firestore: { Timestamp: { fromMillis: (ms) => ({ toMillis: () => ms }) } } },
    db,
    BOT_TOKEN: { value: () => "mock-bot-token" },
    GEMINI_API_KEY: { value: () => "mock-gemini-key" },
  }));
  jest.doMock("../lib/helpers", () => ({ sendTelegramMessage: jest.fn() }));
  jest.doMock("@google/genai", () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({ models: { generateContent: generateContentMock } })),
  }));
  return require("../aiCeo");
}

const makeOrder = (overrides = {}) => ({
  status: "delivered",
  totalAmount: 100_000,
  orders: [{ id: "prod-1", name: "Krem", price: 100_000, quantity: 1 }],
  ...overrides,
});

describe("computeTimeSavedMinutes", () => {
  test("hech qanday avtomatik harakat bo'lmasa, 0 qaytaradi", () => {
    const { _testables } = loadAiCeoModule();
    expect(_testables.computeTimeSavedMinutes({})).toBe(0);
  });

  test("eslatmalar sonini 3 daqiqaga ko'paytiradi (savat+sevimli+qayta xarid)", () => {
    const { _testables } = loadAiCeoModule();
    const minutes = _testables.computeTimeSavedMinutes({
      cartRemindersSent: 2,
      favoriteRemindersSent: 1,
      repurchaseRemindersSent: 3,
    });
    expect(minutes).toBe((2 + 1 + 3) * 3);
  });

  test("CRM xabari yuborilgan kunlar uchun 1 marta 15 daqiqa qo'shadi - yuborilgan mijozlar soniga BOG'LIQ EMAS", () => {
    const { _testables } = loadAiCeoModule();
    const oneRecipient = _testables.computeTimeSavedMinutes({ crmMessagesSent: 1 });
    const manyRecipients = _testables.computeTimeSavedMinutes({ crmMessagesSent: 40 });
    expect(oneRecipient).toBe(15);
    expect(manyRecipients).toBe(15);
  });

  test("Tier-1 avtonom harakatlarni 3 daqiqaga, AI mahsulot qoralamasini 5 daqiqaga ko'paytiradi", () => {
    const { _testables } = loadAiCeoModule();
    const minutes = _testables.computeTimeSavedMinutes({
      aiAutoActionsCount: 4,
      productsAddedTodayCount: 2,
    });
    expect(minutes).toBe(4 * 3 + 2 * 5);
  });

  test("barcha turdagi harakatlarni birlashtirib qo'shadi", () => {
    const { _testables } = loadAiCeoModule();
    const minutes = _testables.computeTimeSavedMinutes({
      cartRemindersSent: 5,
      favoriteRemindersSent: 2,
      repurchaseRemindersSent: 1,
      crmMessagesSent: 10,
      aiAutoActionsCount: 3,
      productsAddedTodayCount: 4,
    });
    // (5+2+1)*3 + 15 + 3*3 + 4*5 = 24 + 15 + 9 + 20 = 68
    expect(minutes).toBe(68);
  });
});

describe("buildDigestStats", () => {
  test("tushum va sof foydani FAQAT yetkazilgan buyurtmalardan hisoblaydi", () => {
    const { _testables } = loadAiCeoModule();
    const periodOrders = [
      makeOrder({ status: "delivered", totalAmount: 100_000 }),
      makeOrder({ status: "new", totalAmount: 999_999 }), // hisobga olinmasligi kerak
    ];
    const costPriceMap = new Map([["prod-1", 40_000]]);

    const stats = _testables.buildDigestStats(periodOrders, [], costPriceMap);

    expect(stats.orderCount).toBe(2);
    expect(stats.deliveredCount).toBe(1);
    expect(stats.revenue).toBe(100_000);
    expect(stats.netProfit).toBe(60_000); // 100000 - 40000
  });

  test("oldingi davr 0 bo'lsa, revenueChangePercent NULL bo'ladi (cheksizlikka bo'linmaydi)", () => {
    const { _testables } = loadAiCeoModule();
    const stats = _testables.buildDigestStats([makeOrder()], [], new Map());
    expect(stats.revenueChangePercent).toBeNull();
  });

  test("tushum o'zgarish foizini to'g'ri hisoblaydi", () => {
    const { _testables } = loadAiCeoModule();
    const periodOrders = [makeOrder({ totalAmount: 150_000 })];
    const prevPeriodOrders = [makeOrder({ totalAmount: 100_000 })];
    const stats = _testables.buildDigestStats(periodOrders, prevPeriodOrders, new Map());
    expect(stats.revenueChangePercent).toBe(50);
  });

  test("bekor qilish darajasini to'g'ri hisoblaydi", () => {
    const { _testables } = loadAiCeoModule();
    const periodOrders = [
      makeOrder({ status: "delivered" }),
      makeOrder({ status: "cancel" }),
      makeOrder({ status: "cancel" }),
      makeOrder({ status: "new" }),
    ];
    const stats = _testables.buildDigestStats(periodOrders, [], new Map());
    expect(stats.cancelRate).toBe(50);
  });

  test("eng ko'p tushum keltirgan mahsulotni to'g'ri topadi", () => {
    const { _testables } = loadAiCeoModule();
    const periodOrders = [
      makeOrder({ orders: [{ id: "a", name: "Arzon", price: 10_000, quantity: 1 }] }),
      makeOrder({ orders: [{ id: "b", name: "Qimmat", price: 90_000, quantity: 1 }] }),
    ];
    const stats = _testables.buildDigestStats(periodOrders, [], new Map());
    expect(stats.topProductName).toBe("Qimmat");
  });

  test("hech narsa sotilmagan bo'lsa topProductName null bo'ladi", () => {
    const { _testables } = loadAiCeoModule();
    const stats = _testables.buildDigestStats([makeOrder({ status: "new", orders: [] })], [], new Map());
    expect(stats.topProductName).toBeNull();
  });
});

describe("buildDigestPrompt", () => {
  test("prompt FAQAT berilgan raqamlarni o'z ichiga oladi va Gemini'ga o'ylab topmaslikni buyuradi", () => {
    const { _testables } = loadAiCeoModule();
    const stats = {
      orderCount: 5, deliveredCount: 4, revenue: 500_000, netProfit: 200_000,
      cancelRate: 10, revenueChangePercent: 25, topProductName: "Krem", topProductRevenue: 300_000,
    };
    const prompt = _testables.buildDigestPrompt(stats, "Bugungi kun", "Test Do'kon");

    expect(prompt).toContain("Test Do'kon");
    expect(prompt).toContain("5 ta");
    expect(prompt).toContain("O'YLAB TOPMA");
    expect(prompt).toContain("Krem");
  });

  test("revenueChangePercent NULL bo'lganda, 'yetarli ma'lumot yo'q' deb ko'rsatadi (soxta foiz yozmaydi)", () => {
    const { _testables } = loadAiCeoModule();
    const stats = {
      orderCount: 1, deliveredCount: 1, revenue: 100_000, netProfit: 50_000,
      cancelRate: 0, revenueChangePercent: null, topProductName: null, topProductRevenue: 0,
    };
    const prompt = _testables.buildDigestPrompt(stats, "Bugungi kun", "Do'kon");
    expect(prompt).toContain("yetarli ma'lumot yo'q");
  });
});

describe("generateAnalyticsInsight", () => {
  const baseRequest = (overrides = {}) => ({
    auth: { uid: "seller-1" },
    data: { deadStockNames: ["Krem A"], lowStockNames: [], topProductName: "Krem B", totalRevenue: 500000, ...overrides },
  });

  test("aiCeoEnabled=false bo'lgan sotuvchi rad etiladi, Gemini chaqirilmaydi", async () => {
    const genContent = jest.fn();
    const { _testables } = loadAiCeoModuleWithDb({ sellerData: { aiCeoEnabled: false } }, genContent);
    await expect(_testables.handleGenerateAnalyticsInsight(baseRequest())).rejects.toMatchObject({ code: "permission-denied" });
    expect(genContent).not.toHaveBeenCalled();
  });

  test("hech qanday ma'lumot berilmasa rad etiladi", async () => {
    const genContent = jest.fn();
    const { _testables } = loadAiCeoModuleWithDb({ sellerData: { aiCeoEnabled: true } }, genContent);
    await expect(
      _testables.handleGenerateAnalyticsInsight(baseRequest({ deadStockNames: [], lowStockNames: [], topProductName: null }))
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(genContent).not.toHaveBeenCalled();
  });

  test("premium sotuvchi uchun Gemini chaqiriladi va sharh qaytariladi", async () => {
    const genContent = jest.fn().mockResolvedValue({ text: "Krem A uzoq vaqt sotilmagan, chegirma qo'ying." });
    const { _testables } = loadAiCeoModuleWithDb({ sellerData: { aiCeoEnabled: true } }, genContent);
    const result = await _testables.handleGenerateAnalyticsInsight(baseRequest());
    expect(genContent).toHaveBeenCalledTimes(1);
    expect(result.insight).toBe("Krem A uzoq vaqt sotilmagan, chegirma qo'ying.");
  });
});

describe("generateWinBackMessage", () => {
  const baseRequest = (overrides = {}) => ({
    auth: { uid: "seller-1" },
    data: { customerName: "Ali", daysSinceLastOrder: 45, lastProductName: "Krem", storeName: "Zelo", ...overrides },
  });

  test("aiCeoEnabled=false bo'lgan sotuvchi rad etiladi, Gemini chaqirilmaydi", async () => {
    const genContent = jest.fn();
    const { _testables } = loadAiCeoModuleWithDb({ sellerData: { aiCeoEnabled: false } }, genContent);
    await expect(_testables.handleGenerateWinBackMessage(baseRequest())).rejects.toMatchObject({ code: "permission-denied" });
    expect(genContent).not.toHaveBeenCalled();
  });

  test("daysSinceLastOrder berilmasa rad etiladi", async () => {
    const genContent = jest.fn();
    const { _testables } = loadAiCeoModuleWithDb({ sellerData: { aiCeoEnabled: true } }, genContent);
    await expect(_testables.handleGenerateWinBackMessage(baseRequest({ daysSinceLastOrder: null }))).rejects.toMatchObject({ code: "invalid-argument" });
    expect(genContent).not.toHaveBeenCalled();
  });

  test("premium sotuvchi uchun Gemini chaqiriladi va xabar qaytariladi", async () => {
    const genContent = jest.fn().mockResolvedValue({ text: "Assalomu alaykum Ali, sizni sog'indik!" });
    const { _testables } = loadAiCeoModuleWithDb({ sellerData: { aiCeoEnabled: true } }, genContent);
    const result = await _testables.handleGenerateWinBackMessage(baseRequest());
    expect(genContent).toHaveBeenCalledTimes(1);
    expect(result.message).toBe("Assalomu alaykum Ali, sizni sog'indik!");
  });
});

describe("parseCrmCampaignResponse", () => {
  test("SARLAVHA/XABAR/SABAB formatidagi javobni to'g'ri ajratadi", () => {
    const { _testables } = loadAiCeoModule();
    const raw = "SARLAVHA: Sizni sog'indik!\nXABAR: Yana bizga tashrif buyuring, siz uchun yangiliklar bor.\nSABAB: Uxlab qolgan mijozlarni iliq ohang bilan qaytarish samarali.";
    const result = _testables.parseCrmCampaignResponse(raw);
    expect(result.title).toBe("Sizni sog'indik!");
    expect(result.message).toBe("Yana bizga tashrif buyuring, siz uchun yangiliklar bor.");
    expect(result.reasoning).toBe("Uxlab qolgan mijozlarni iliq ohang bilan qaytarish samarali.");
  });

  test("SABAB qismi bo'lmasa ham NOM/XABAR'ni to'g'ri ajratadi", () => {
    const { _testables } = loadAiCeoModule();
    const raw = "SARLAVHA: VIP mijozlarga maxsus\nXABAR: Sizga alohida rahmat aytmoqchimiz.";
    const result = _testables.parseCrmCampaignResponse(raw);
    expect(result.title).toBe("VIP mijozlarga maxsus");
    expect(result.message).toBe("Sizga alohida rahmat aytmoqchimiz.");
    expect(result.reasoning).toBeNull();
  });
});

describe("handleGenerateCrmCampaign", () => {
  const baseRequest = (overrides = {}) => ({
    auth: { uid: "seller-1" },
    data: { segment: "churn", segmentCount: 12, storeName: "Zelo", topProductName: "Krem", ...overrides },
  });

  test("aiCeoEnabled=false bo'lgan sotuvchi rad etiladi, Gemini chaqirilmaydi", async () => {
    const genContent = jest.fn();
    const { _testables } = loadAiCeoModuleWithDb({ sellerData: { aiCeoEnabled: false } }, genContent);
    await expect(_testables.handleGenerateCrmCampaign(baseRequest())).rejects.toMatchObject({ code: "permission-denied" });
    expect(genContent).not.toHaveBeenCalled();
  });

  test("noto'g'ri segment (masalan 'all' yoki 'regular') rad etiladi", async () => {
    const genContent = jest.fn();
    const { _testables } = loadAiCeoModuleWithDb({ sellerData: { aiCeoEnabled: true } }, genContent);
    await expect(_testables.handleGenerateCrmCampaign(baseRequest({ segment: "all" }))).rejects.toMatchObject({ code: "invalid-argument" });
    expect(genContent).not.toHaveBeenCalled();
  });

  test("segmentCount 0 yoki manfiy bo'lsa rad etiladi", async () => {
    const genContent = jest.fn();
    const { _testables } = loadAiCeoModuleWithDb({ sellerData: { aiCeoEnabled: true } }, genContent);
    await expect(_testables.handleGenerateCrmCampaign(baseRequest({ segmentCount: 0 }))).rejects.toMatchObject({ code: "invalid-argument" });
    expect(genContent).not.toHaveBeenCalled();
  });

  test("premium sotuvchi uchun Gemini chaqiriladi va kampaniya qaytariladi", async () => {
    const genContent = jest.fn().mockResolvedValue({
      text: "SARLAVHA: Sizni sog'indik!\nXABAR: Yana bizga tashrif buyuring.\nSABAB: Iliq ohang samarali.",
    });
    const { _testables } = loadAiCeoModuleWithDb({ sellerData: { aiCeoEnabled: true } }, genContent);
    const result = await _testables.handleGenerateCrmCampaign(baseRequest());
    expect(genContent).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      title: "Sizni sog'indik!",
      message: "Yana bizga tashrif buyuring.",
      reasoning: "Iliq ohang samarali.",
    });
  });

  test("Gemini kutilgan formatda javob bermasa (sarlavha/xabar yo'q) xato qaytariladi", async () => {
    const genContent = jest.fn().mockResolvedValue({ text: "tushunarsiz erkin matn" });
    const { _testables } = loadAiCeoModuleWithDb({ sellerData: { aiCeoEnabled: true } }, genContent);
    await expect(_testables.handleGenerateCrmCampaign(baseRequest())).rejects.toMatchObject({ code: "internal" });
  });
});

describe("handleGenerateDailyReport", () => {
  /**
   * MUHIM MOCK STRATEGIYASI: `handleGenerateDailyReport` bir vaqtda
   * (`Promise.all`) 3 xil "orders" so'rovini yuboradi (bugungi,
   * kechagi, so'nggi 500 ta). `Promise.all([a, b, c])` massividagi
   * elementlar HAR DOIM YOZILGAN TARTIBDA sinxron baholanadi (garchi
   * natijalar asinxron kelsa ham) - shuning uchun `db.collection("orders")`
   * chaqiruvlarini HISOBLAGICH orqali, chaqirilish TARTIBIGA qarab
   * farqlash ISHONCHLI usul.
   */
  function buildMockDb({ sellerData, todayOrders = [], yesterdayOrders = [], recentOrders = [], products = [], dailyStats = null, customers = [], learningData = null }) {
    let ordersCallCount = 0;
    const dailyStatsSetCalls = [];
    const db = {
      collection: (name) => {
        if (name === "sellers") {
          return {
            doc: () => ({
              get: async () => (sellerData ? { exists: true, data: () => sellerData } : { exists: false }),
              // MUHIM: `buildDailyReport` shu quyi kolleksiyaning
              // IKKALASINI ham ishlatadi - "dailyStats" (`.doc().get()`
              // orqali, ENDI `.set()` ham - AI reja keshlanganda) va
              // "customers" (to'g'ridan-to'g'ri `.get()` orqali,
              // "diqqat talab qiladi" hisoblash uchun) - nom bo'yicha
              // farqlaymiz.
              collection: (subName) => {
                if (subName === "customers") {
                  return { get: async () => ({ docs: customers.map((c) => ({ data: () => c })) }) };
                }
                // YANGI (7-BOSQICH): `aiCeoLearning/summary` - "dailyStats"dan
                // ALOHIDA hujjat, shuning uchun ALOHIDA farqlanadi (aks holda
                // ikkalasi bir-birining o'rniga o'qilib qolar edi).
                if (subName === "aiCeoLearning") {
                  return { doc: () => ({ get: async () => (learningData ? { exists: true, data: () => learningData } : { exists: false }) }) };
                }
                return {
                  doc: () => ({
                    get: async () => (dailyStats ? { exists: true, data: () => dailyStats } : { exists: false }),
                    set: async (data) => { dailyStatsSetCalls.push(data); },
                  }),
                };
              },
            }),
          };
        }
        if (name === "products") {
          return {
            where: () => ({
              get: async () => ({ docs: products.map((p) => ({ id: p.id, data: () => p })) }),
            }),
          };
        }
        if (name === "orders") {
          ordersCallCount += 1;
          const callIndex = ordersCallCount; // 1=bugungi, 2=kechagi, 3=so'nggi 500
          const chain = {
            where: () => chain,
            orderBy: () => chain,
            limit: () => chain,
            get: async () => {
              const data = callIndex === 1 ? todayOrders : callIndex === 2 ? yesterdayOrders : recentOrders;
              return { docs: data.map((o) => ({ data: () => o })) };
            },
          };
          return chain;
        }
        return { doc: () => ({ get: async () => ({ exists: false }) }) };
      },
      runTransaction: async (callback) => callback({ get: async () => ({ exists: false }), set: () => {} }),
    };
    db.__dailyStatsSetCalls = dailyStatsSetCalls;
    return db;
  }

  function loadModuleWithFullMock(mockDb, generateContentMock = jest.fn()) {
    jest.resetModules();
    jest.doMock("../lib/admin", () => ({
      admin: {
        firestore: {
          Timestamp: { fromMillis: (ms) => ({ toMillis: () => ms }) },
          FieldValue: { serverTimestamp: () => "MOCK_TS" },
        },
      },
      db: mockDb,
      BOT_TOKEN: { value: () => "mock-bot-token" },
      GEMINI_API_KEY: { value: () => "mock-gemini-key" },
    }));
    jest.doMock("../lib/helpers", () => ({ sendTelegramMessage: jest.fn() }));
    jest.doMock("@google/genai", () => ({
      GoogleGenAI: jest.fn().mockImplementation(() => ({ models: { generateContent: generateContentMock } })),
    }));
    return require("../aiCeo");
  }

  test("premium bo'lmagan sotuvchini rad etadi", async () => {
    const db = buildMockDb({ sellerData: { aiCeoEnabled: false } });
    const aiCeo = loadModuleWithFullMock(db);
    await expect(
      aiCeo._testables.handleGenerateDailyReport({ auth: { uid: "seller-1" }, data: {} })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("moliyaviy hisobotni TO'G'RI hisoblaydi (bugun vs kecha)", async () => {
    const db = buildMockDb({
      sellerData: { aiCeoEnabled: true },
      todayOrders: [{ status: "delivered", totalAmount: 100_000, clientId: "c1", orders: [] }],
      yesterdayOrders: [{ status: "delivered", totalAmount: 50_000, clientId: "c2", orders: [] }],
    });
    const aiCeo = loadModuleWithFullMock(db);
    const report = await aiCeo._testables.handleGenerateDailyReport({ auth: { uid: "seller-1" }, data: {} });

    expect(report.financial.todayRevenue).toBe(100_000);
    expect(report.financial.yesterdayRevenue).toBe(50_000);
    expect(report.financial.revenueChangePercent).toBe(100); // 2 barobar o'sish
  });

  test("kecha savdo bo'lmagan bo'lsa, foiz o'zgarishni hisoblamaydi (cheksizlikka bo'linmaydi)", async () => {
    const db = buildMockDb({
      sellerData: { aiCeoEnabled: true },
      todayOrders: [{ status: "delivered", totalAmount: 100_000, clientId: "c1", orders: [] }],
      yesterdayOrders: [],
    });
    const aiCeo = loadModuleWithFullMock(db);
    const report = await aiCeo._testables.handleGenerateDailyReport({ auth: { uid: "seller-1" }, data: {} });

    expect(report.financial.revenueChangePercent).toBeNull();
  });

  test("sotilmagan, zaxirada bor mahsulotlarni chegirma nomzodi sifatida topadi", async () => {
    const db = buildMockDb({
      sellerData: { aiCeoEnabled: true },
      products: [
        { id: "p1", name: "Sotilmagan krem", stock: 10, discountPrice: null },
        { id: "p2", name: "Sotilgan krem", stock: 5, discountPrice: null },
      ],
      recentOrders: [{ orders: [{ id: "p2", quantity: 2 }] }],
    });
    const aiCeo = loadModuleWithFullMock(db);
    const report = await aiCeo._testables.handleGenerateDailyReport({ auth: { uid: "seller-1" }, data: {} });

    expect(report.productRecommendations.discountCandidates.map((c) => c.id)).toContain("p1");
    expect(report.productRecommendations.discountCandidates.map((c) => c.id)).not.toContain("p2");
  });

  test("mahsulot tavsifi/rasmi sifatini (#118) `products`dan to'g'ri hisoblaydi", async () => {
    const db = buildMockDb({
      sellerData: { aiCeoEnabled: true },
      products: [
        { id: "p1", name: "Yaxshi", description: "a".repeat(50), image: "https://x.com/1.jpg" },
        { id: "p2", name: "Tavsifsiz", description: "qisqa", image: "https://x.com/2.jpg" },
        { id: "p3", name: "Rasmsiz", description: "a".repeat(50) },
        { id: "p4", name: "Nofaol", isActive: false }, // hisobga olinmasligi kerak
      ],
    });
    const aiCeo = loadModuleWithFullMock(db);
    const report = await aiCeo._testables.handleGenerateDailyReport({ auth: { uid: "seller-1" }, data: {} });

    expect(report.contentQuality.weakDescriptionCount).toBe(1);
    expect(report.contentQuality.weakDescriptionProducts.map((p) => p.id)).toEqual(["p2"]);
    expect(report.contentQuality.noImageCount).toBe(1);
    expect(report.contentQuality.noImageProducts.map((p) => p.id)).toEqual(["p3"]);
  });

  test("CRM konversiyasini TO'G'RI hisoblaydi (xabar olgan + bugun buyurtma bergan)", async () => {
    const db = buildMockDb({
      sellerData: { aiCeoEnabled: true },
      dailyStats: { crmMessagesSent: 5, crmMessageRecipientIds: ["c1", "c2", "c3"] },
      todayOrders: [
        { status: "delivered", totalAmount: 10_000, clientId: "c1", orders: [] }, // xabar oldi VA sotib oldi
        { status: "new", totalAmount: 20_000, clientId: "c99", orders: [] }, // xabar OLMAGAN mijoz
      ],
    });
    const aiCeo = loadModuleWithFullMock(db);
    const report = await aiCeo._testables.handleGenerateDailyReport({ auth: { uid: "seller-1" }, data: {} });

    expect(report.crmActivity.convertedCount).toBe(1); // faqat c1
    expect(report.crmActivity.crmMessagesSent).toBe(5);
  });

  test("'diqqat talab qiladi' (VIP/uxlab qolgan) sonini `customers` yig'ma kolleksiyasidan to'g'ri hisoblaydi", async () => {
    const NOW = Date.now();
    const db = buildMockDb({
      sellerData: { aiCeoEnabled: true },
      customers: [
        { clientId: "vip-1", ltv: 600_000, lastOrderAtMs: NOW }, // VIP
        { clientId: "churn-1", ltv: 10_000, lastOrderAtMs: NOW - 40 * 24 * 60 * 60 * 1000 }, // 40 kun - uxlab qolgan
        { clientId: "regular-1", ltv: 10_000, lastOrderAtMs: NOW - 5 * 24 * 60 * 60 * 1000 }, // yaqinda - oddiy
      ],
    });
    const aiCeo = loadModuleWithFullMock(db);
    const report = await aiCeo._testables.handleGenerateDailyReport({ auth: { uid: "seller-1" }, data: {} });

    expect(report.attentionNeeded.vipCount).toBe(1);
    expect(report.attentionNeeded.churnCount).toBe(1);
  });

  test("AI CEO avtomatik yuborgan qaytarish xabarlari sonini hisobotga chiqaradi", async () => {
    const db = buildMockDb({
      sellerData: { aiCeoEnabled: true },
      dailyStats: { aiCeoAutoWinBackSent: 3 },
    });
    const aiCeo = loadModuleWithFullMock(db);
    const report = await aiCeo._testables.handleGenerateDailyReport({ auth: { uid: "seller-1" }, data: {} });

    expect(report.crmActivity.aiAutoActionsCount).toBe(3);
  });

  test("AI CEO avtomatik yuborgan IKKALA turdagi (qaytarish + sevimlilar) xabarlarni QO'SHIB hisoblaydi", async () => {
    const db = buildMockDb({
      sellerData: { aiCeoEnabled: true },
      dailyStats: { aiCeoAutoWinBackSent: 3, aiCeoAutoFavoriteSent: 2 },
    });
    const aiCeo = loadModuleWithFullMock(db);
    const report = await aiCeo._testables.handleGenerateDailyReport({ auth: { uid: "seller-1" }, data: {} });

    expect(report.crmActivity.aiAutoActionsCount).toBe(5);
  });

  // AI CEO — 8-BOSQICH: "avtonom harakatlar doirasini kengaytirish" -
  // avtomatik chegirmalar soni YUQORIDAGI oddiy harakatlar sonidan
  // ALOHIDA ko'rsatiladi (batafsil izoh: `aiCeoAutoDiscount.js`).
  test("AI CEO avtomatik bergan chegirmalar sonini ALOHIDA (aiAutoActionsCount'ga ARALASHTIRMASDAN) hisobotga chiqaradi", async () => {
    const db = buildMockDb({
      sellerData: { aiCeoEnabled: true },
      dailyStats: { aiCeoAutoWinBackSent: 3, aiCeoAutoDiscountsIssued: 2 },
    });
    const aiCeo = loadModuleWithFullMock(db);
    const report = await aiCeo._testables.handleGenerateDailyReport({ auth: { uid: "seller-1" }, data: {} });

    expect(report.crmActivity.aiAutoActionsCount).toBe(3);
    expect(report.crmActivity.autoDiscountsIssuedCount).toBe(2);
  });

  test("hali hech qanday avtomatik chegirma berilmagan bo'lsa, autoDiscountsIssuedCount 0 bo'ladi", async () => {
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true } });
    const aiCeo = loadModuleWithFullMock(db);
    const report = await aiCeo._testables.handleGenerateDailyReport({ auth: { uid: "seller-1" }, data: {} });

    expect(report.crmActivity.autoDiscountsIssuedCount).toBe(0);
  });

  // AI CEO — 7-BOSQICH: "natija kuzatuvi va o'rganish" - `learningSummary`
  // maydonining xatti-harakati (batafsil izoh: `aiCeoLearning.js`).
  describe("learningSummary (AI CEO avtonom xabarlarining HAQIQIY konversiyasi)", () => {
    test("hali umuman AI xabari yuborilmagan bo'lsa (hujjat yo'q), ikkala tur ham NULL bo'ladi", async () => {
      const db = buildMockDb({ sellerData: { aiCeoEnabled: true } });
      const aiCeo = loadModuleWithFullMock(db);
      const report = await aiCeo._testables.handleGenerateDailyReport({ auth: { uid: "seller-1" }, data: {} });

      expect(report.learningSummary).toEqual({ winback: null, favorite: null });
    });

    test("evaluatsiya qilingan ma'lumot bo'lsa, TO'G'RI konversiya foizini hisoblab qaytaradi", async () => {
      const db = buildMockDb({
        sellerData: { aiCeoEnabled: true },
        learningData: { winbackAiSent: 20, winbackAiConverted: 5, favoriteAiSent: 0, favoriteAiConverted: 0 },
      });
      const aiCeo = loadModuleWithFullMock(db);
      const report = await aiCeo._testables.handleGenerateDailyReport({ auth: { uid: "seller-1" }, data: {} });

      expect(report.learningSummary).toEqual({
        winback: { sentCount: 20, convertedCount: 5, conversionRatePercent: 25 },
        favorite: null,
      });
    });
  });

  // AI CEO — 5-BOSQICH (1-qism): "O'ZI REJA TUZADI" - `aiActionPlan`
  // maydonining xatti-harakati.
  describe("aiActionPlan (AI'ning o'zi tanlagan ustuvorlik tartibi)", () => {
    test("0 yoki 1 ta band mavjud bo'lsa, Gemini UMUMAN chaqirilmaydi va aiActionPlan null qoladi", async () => {
      const generateContentMock = jest.fn();
      const db = buildMockDb({
        sellerData: { aiCeoEnabled: true },
        customers: [{ clientId: "vip-1", ltv: 600_000, lastOrderAtMs: Date.now() }], // faqat VIP - 1 ta band
      });
      const aiCeo = loadModuleWithFullMock(db, generateContentMock);
      const report = await aiCeo._testables.handleGenerateDailyReport({ auth: { uid: "seller-1" }, data: {} });

      expect(generateContentMock).not.toHaveBeenCalled();
      expect(report.aiActionPlan).toBeNull();
    });

    test("2+ band mavjud bo'lsa, Gemini chaqiriladi va TO'G'RI tartib+sabab qaytadi, keshga yoziladi", async () => {
      const generateContentMock = jest.fn().mockResolvedValue({ text: "TARTIB: churn, vip\nSABAB: Uxlab qolganlar ko'proq." });
      const NOW = Date.now();
      const db = buildMockDb({
        sellerData: { aiCeoEnabled: true, storeName: "Zelo" },
        customers: [
          { clientId: "vip-1", ltv: 600_000, lastOrderAtMs: NOW },
          { clientId: "churn-1", ltv: 10_000, lastOrderAtMs: NOW - 40 * 24 * 60 * 60 * 1000 },
        ],
      });
      const aiCeo = loadModuleWithFullMock(db, generateContentMock);
      const report = await aiCeo._testables.handleGenerateDailyReport({ auth: { uid: "seller-1" }, data: {} });

      expect(generateContentMock).toHaveBeenCalledTimes(1);
      expect(report.aiActionPlan).toEqual({ order: ["churn", "vip"], reasoning: "Uxlab qolganlar ko'proq." });
      expect(db.__dailyStatsSetCalls).toHaveLength(1);
      expect(db.__dailyStatsSetCalls[0].aiActionPlanOrder).toEqual(["churn", "vip"]);
    });

    test("BUGUN allaqachon KESHLANGAN (bir xil band to'plami) bo'lsa, Gemini QAYTA chaqirilmaydi", async () => {
      const generateContentMock = jest.fn();
      const NOW = Date.now();
      const db = buildMockDb({
        sellerData: { aiCeoEnabled: true },
        customers: [
          { clientId: "vip-1", ltv: 600_000, lastOrderAtMs: NOW },
          { clientId: "churn-1", ltv: 10_000, lastOrderAtMs: NOW - 40 * 24 * 60 * 60 * 1000 },
        ],
        dailyStats: {
          aiActionPlanKeysFingerprint: "churn,vip", // availableActionKeys ["vip","churn"].sort() = ["churn","vip"]
          aiActionPlanOrder: ["vip", "churn"],
          aiActionPlanReasoning: "Eski sabab (keshdan).",
        },
      });
      const aiCeo = loadModuleWithFullMock(db, generateContentMock);
      const report = await aiCeo._testables.handleGenerateDailyReport({ auth: { uid: "seller-1" }, data: {} });

      expect(generateContentMock).not.toHaveBeenCalled();
      expect(report.aiActionPlan).toEqual({ order: ["vip", "churn"], reasoning: "Eski sabab (keshdan)." });
    });

    test("band to'plami KECHAGIDAN farqli bo'lsa (masalan VIP harakati bajarilgan), ESKI kesh e'tiborsiz qoldirilib, QAYTA hisoblanadi", async () => {
      const generateContentMock = jest.fn().mockResolvedValue({ text: "TARTIB: churn\nSABAB: Yangi sabab." });
      const NOW = Date.now();
      const db = buildMockDb({
        sellerData: { aiCeoEnabled: true },
        // ENDI faqat churn bor (VIP hal qilingan) - lekin 1 ta band
        // bo'lgani uchun (Gemini chaqirilmasligi kerak edi), shuning
        // uchun productRecommendations orqali yana bitta band qo'shamiz.
        customers: [{ clientId: "churn-1", ltv: 10_000, lastOrderAtMs: NOW - 40 * 24 * 60 * 60 * 1000 }],
        products: [{ id: "p1", name: "Sotilmagan krem", stock: 10, discountPrice: null }],
        dailyStats: {
          aiActionPlanKeysFingerprint: "churn,vip", // ESKI (endi mos kelmaydi: hozir "churn,discount")
          aiActionPlanOrder: ["vip", "churn"],
          aiActionPlanReasoning: "Eski sabab.",
        },
      });
      const aiCeo = loadModuleWithFullMock(db, generateContentMock);
      const report = await aiCeo._testables.handleGenerateDailyReport({ auth: { uid: "seller-1" }, data: {} });

      expect(generateContentMock).toHaveBeenCalledTimes(1);
      expect(report.aiActionPlan.reasoning).toBe("Yangi sabab.");
    });

    test("Gemini xato bersa - aiActionPlan null qoladi, hisobot BUZILMAYDI (jim fallback)", async () => {
      const generateContentMock = jest.fn().mockRejectedValue(new Error("Gemini vaqtincha ishlamayapti"));
      const NOW = Date.now();
      const db = buildMockDb({
        sellerData: { aiCeoEnabled: true },
        customers: [
          { clientId: "vip-1", ltv: 600_000, lastOrderAtMs: NOW },
          { clientId: "churn-1", ltv: 10_000, lastOrderAtMs: NOW - 40 * 24 * 60 * 60 * 1000 },
        ],
      });
      const aiCeo = loadModuleWithFullMock(db, generateContentMock);
      const report = await aiCeo._testables.handleGenerateDailyReport({ auth: { uid: "seller-1" }, data: {} });

      expect(report.aiActionPlan).toBeNull();
      // Hisobotning QOLGAN qismi baribir to'g'ri qaytishi kerak.
      expect(report.attentionNeeded.vipCount).toBe(1);
      expect(report.attentionNeeded.churnCount).toBe(1);
    });
  });
});

describe("countAttentionSegments", () => {
  test("VIP chegarasidan yuqori LTV'ga ega mijozni VIP deb sanaydi, 'uxlab qolgan'ga EMAS", () => {
    const { _testables } = loadAiCeoModule();
    const NOW = Date.now();
    // VIP HAM, 40 kundan beri xarid qilmagan HAM bo'lsa - VIP
    // ustuvor (xuddi frontend `computeCustomerSegments`dagi kabi).
    const result = _testables.countAttentionSegments(
      [{ ltv: 600_000, lastOrderAtMs: NOW - 40 * 24 * 60 * 60 * 1000 }],
      NOW
    );
    expect(result).toEqual({ vip: 1, churn: 0 });
  });

  test("aniq 30 kun chegarasida (30 kun EMAS, 31+ kun) 'uxlab qolgan' deb sanaydi", () => {
    const { _testables } = loadAiCeoModule();
    const NOW = Date.now();
    const exactlyThirty = _testables.countAttentionSegments(
      [{ ltv: 0, lastOrderAtMs: NOW - 30 * 24 * 60 * 60 * 1000 }],
      NOW
    );
    expect(exactlyThirty.churn).toBe(0);
    const thirtyOne = _testables.countAttentionSegments(
      [{ ltv: 0, lastOrderAtMs: NOW - 31 * 24 * 60 * 60 * 1000 }],
      NOW
    );
    expect(thirtyOne.churn).toBe(1);
  });

  test("bo'sh massiv uchun {vip:0, churn:0} qaytaradi", () => {
    const { _testables } = loadAiCeoModule();
    expect(_testables.countAttentionSegments([], Date.now())).toEqual({ vip: 0, churn: 0 });
  });
});

describe("collectAttentionSegmentClientIds", () => {
  // YANGI (Telegram "1-tugmali tasdiqlash" uchun): `countAttentionSegments`
  // bilan BIR XIL segmentatsiya, lekin SON emas, HAQIQIY `clientId`
  // ro'yxatini qaytaradi - `customers` massividagi har bir element
  // `id` maydoniga ega bo'lishi kerak (Firestore hujjat ID'si).
  test("VIP va 'uxlab qolgan' mijozlarning ID'larini TO'G'RI ajratadi", () => {
    const { _testables } = loadAiCeoModule();
    const NOW = Date.now();
    const result = _testables.collectAttentionSegmentClientIds(
      [
        { id: "vip-1", ltv: 600_000, lastOrderAtMs: NOW },
        { id: "churn-1", ltv: 10_000, lastOrderAtMs: NOW - 40 * 24 * 60 * 60 * 1000 },
        { id: "regular-1", ltv: 10_000, lastOrderAtMs: NOW - 5 * 24 * 60 * 60 * 1000 },
      ],
      NOW
    );
    expect(result).toEqual({ vipClientIds: ["vip-1"], churnClientIds: ["churn-1"] });
  });

  test("VIP HAM, uxlab qolgan HAM bo'lgan mijoz faqat vipClientIds'ga tushadi (VIP ustuvor)", () => {
    const { _testables } = loadAiCeoModule();
    const NOW = Date.now();
    const result = _testables.collectAttentionSegmentClientIds(
      [{ id: "both-1", ltv: 600_000, lastOrderAtMs: NOW - 40 * 24 * 60 * 60 * 1000 }],
      NOW
    );
    expect(result).toEqual({ vipClientIds: ["both-1"], churnClientIds: [] });
  });

  test("`id` maydoni yo'q mijozni O'TKAZIB YUBORADI (xavfsizlik - bo'sh clientId'ga xabar yuborilmasligi kerak)", () => {
    const { _testables } = loadAiCeoModule();
    const NOW = Date.now();
    const result = _testables.collectAttentionSegmentClientIds(
      [{ ltv: 600_000, lastOrderAtMs: NOW }],
      NOW
    );
    expect(result).toEqual({ vipClientIds: [], churnClientIds: [] });
  });

  test("bo'sh massiv uchun bo'sh ro'yxatlar qaytaradi", () => {
    const { _testables } = loadAiCeoModule();
    expect(_testables.collectAttentionSegmentClientIds([], Date.now())).toEqual({ vipClientIds: [], churnClientIds: [] });
  });
});

describe("craftCrmCampaign / craftFavoriteReminderMessage (sof Gemini chaqiruvlari)", () => {
  test("craftCrmCampaign - Gemini javobini to'g'ri ajratib, {title, message, reasoning} qaytaradi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({
      text: "SARLAVHA: Maxsus taklif\nXABAR: Siz uchun maxsus kampaniya.\nSABAB: VIP mijozlar qadrlanishni yaxshi ko'radi.",
    });
    const { _testables } = loadAiCeoModuleWithDb({}, generateContentMock);
    const result = await _testables.craftCrmCampaign("vip", 5, "Zelo", null);
    expect(result).toEqual({
      title: "Maxsus taklif",
      message: "Siz uchun maxsus kampaniya.",
      reasoning: "VIP mijozlar qadrlanishni yaxshi ko'radi.",
    });
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  test("craftCrmCampaign - Gemini bo'sh/noto'g'ri formatli javob bersa, xato tashlaydi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({ text: "tushunarsiz erkin matn" });
    const { _testables } = loadAiCeoModuleWithDb({}, generateContentMock);
    await expect(_testables.craftCrmCampaign("vip", 5, "Zelo", null)).rejects.toThrow();
  });

  test("craftFavoriteReminderMessage - Gemini matnini qaytaradi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({ text: "Sevimlilaringizdagi krem hali kutmoqda!" });
    const { _testables } = loadAiCeoModuleWithDb({}, generateContentMock);
    const result = await _testables.craftFavoriteReminderMessage({ itemNames: ["Krem"], storeName: "Zelo" });
    expect(result).toBe("Sevimlilaringizdagi krem hali kutmoqda!");
  });

  test("craftFavoriteReminderMessage - Gemini bo'sh javob bersa, xato tashlaydi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({ text: "" });
    const { _testables } = loadAiCeoModuleWithDb({}, generateContentMock);
    await expect(_testables.craftFavoriteReminderMessage({ itemNames: ["Krem"], storeName: "Zelo" })).rejects.toThrow();
  });

  // FOYDALANUVCHI SO'ROVI BILAN QO'SHILDI ("AI Copywriter va SMM Setup
  // Guide" hujjatidan) - `carts.js`dagi statik savat eslatmasini
  // AI'lashtirish uchun yangi funksiya.
  test("craftCartRecoveryMessage - Gemini matnini qaytaradi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({ text: "Savatchangiz sizni kutmoqda!" });
    const { _testables } = loadAiCeoModuleWithDb({}, generateContentMock);
    const result = await _testables.craftCartRecoveryMessage({ itemNames: ["Krem"], storeName: "Zelo" });
    expect(result).toBe("Savatchangiz sizni kutmoqda!");
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  test("craftCartRecoveryMessage - Gemini bo'sh javob bersa, xato tashlaydi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({ text: "" });
    const { _testables } = loadAiCeoModuleWithDb({}, generateContentMock);
    await expect(_testables.craftCartRecoveryMessage({ itemNames: ["Krem"], storeName: "Zelo" })).rejects.toThrow();
  });
});

/**
 * AI CEO — 7-BOSQICH: "natija kuzatuvi va o'rganish" - `recentPerformance`
 * promptga QANDAY ta'sir qilishini tekshiradi (batafsil izoh:
 * `aiCeoLearning.js` va `buildWinBackPrompt` ustidagi izoh).
 */
describe("buildRecentPerformanceLine (AI CEO 'o'z-o'zini yaxshilash' qatlami)", () => {
  test("recentPerformance null bo'lsa, BO'SH qator qaytaradi", () => {
    const { _testables } = loadAiCeoModule();
    expect(_testables.buildRecentPerformanceLine(null)).toBe("");
  });

  test("konversiya PAST (<15%) bo'lsa, 'yaxshilash' ohangidagi qatorni qaytaradi", () => {
    const { _testables } = loadAiCeoModule();
    const line = _testables.buildRecentPerformanceLine({ sentCount: 20, convertedCount: 2, conversionRatePercent: 10 });
    expect(line).toContain("o'z-o'zini yaxshilash");
    expect(line).toContain("10%");
    expect(line).toContain("20");
  });

  test("konversiya YAXSHI (>=15%) bo'lsa, 'davom et' ohangidagi qatorni qaytaradi", () => {
    const { _testables } = loadAiCeoModule();
    const line = _testables.buildRecentPerformanceLine({ sentCount: 20, convertedCount: 6, conversionRatePercent: 30 });
    expect(line).toContain("Yaxshi natija");
    expect(line).toContain("30%");
  });
});

describe("buildWinBackPrompt/buildFavoriteReminderPrompt — recentPerformance promptga qo'shilishi", () => {
  test("buildWinBackPrompt: recentPerformance berilsa, promptga kiritadi", () => {
    const { _testables } = loadAiCeoModule();
    const prompt = _testables.buildWinBackPrompt({
      customerName: "Ali", daysSinceLastOrder: 30, lastProductName: "Krem", storeName: "Zelo",
      recentPerformance: { sentCount: 10, convertedCount: 1, conversionRatePercent: 10 },
    });
    expect(prompt).toContain("o'z-o'zini yaxshilash");
  });

  test("buildWinBackPrompt: recentPerformance berilmasa, eski xatti-harakat O'ZGARMAYDI", () => {
    const { _testables } = loadAiCeoModule();
    const prompt = _testables.buildWinBackPrompt({ customerName: "Ali", daysSinceLastOrder: 30, lastProductName: "Krem", storeName: "Zelo" });
    expect(prompt).not.toContain("o'z-o'zini yaxshilash");
    expect(prompt).not.toContain("Yaxshi natija");
  });

  test("buildFavoriteReminderPrompt: recentPerformance berilsa, promptga kiritadi", () => {
    const { _testables } = loadAiCeoModule();
    const prompt = _testables.buildFavoriteReminderPrompt({
      itemNames: ["Krem"], storeName: "Zelo",
      recentPerformance: { sentCount: 10, convertedCount: 4, conversionRatePercent: 40 },
    });
    expect(prompt).toContain("Yaxshi natija");
  });
});

describe("parseActionPlanResponse (AI CEO 'o'zi reja tuzadi' - xavfsizlik filtri)", () => {
  test("TO'G'RI formatdagi javobni to'liq ajratadi", () => {
    const { _testables } = loadAiCeoModule();
    const result = _testables.parseActionPlanResponse(
      "TARTIB: vip, discount, promote\nSABAB: VIP mijozlar eng qimmatli.",
      ["vip", "discount", "promote"]
    );
    expect(result).toEqual({ order: ["vip", "discount", "promote"], reasoning: "VIP mijozlar eng qimmatli." });
  });

  test("MAVJUD BO'LMAGAN (o'ylab topilgan) kalitni E'TIBORSIZ qoldiradi", () => {
    const { _testables } = loadAiCeoModule();
    const result = _testables.parseActionPlanResponse(
      "TARTIB: vip, restock, promote\nSABAB: sabab.",
      ["vip", "promote"]
    );
    expect(result.order).toEqual(["vip", "promote"]);
  });

  test("takrorlangan kalitlarni FAQAT BIR MARTA hisoblaydi", () => {
    const { _testables } = loadAiCeoModule();
    const result = _testables.parseActionPlanResponse(
      "TARTIB: vip, vip, churn\nSABAB: sabab.",
      ["vip", "churn"]
    );
    expect(result.order).toEqual(["vip", "churn"]);
  });

  test("AI biror MAVJUD kalitni tushirib qoldirsa, uni OXIRIGA qo'shadi (yo'qotmaydi)", () => {
    const { _testables } = loadAiCeoModule();
    const result = _testables.parseActionPlanResponse(
      "TARTIB: promote\nSABAB: sabab.",
      ["vip", "churn", "discount", "promote"]
    );
    expect(result.order).toEqual(["promote", "vip", "churn", "discount"]);
  });

  test("TARTIB qatori umuman bo'lmasa, bo'sh order qaytaradi (chaqiruvchi xato tashlaydi)", () => {
    const { _testables } = loadAiCeoModule();
    const result = _testables.parseActionPlanResponse("tushunarsiz erkin matn", ["vip"]);
    expect(result.order).toEqual(["vip"]); // yagona mavjud kalit baribir oxiriga qo'shiladi
  });
});

describe("craftActionPlan", () => {
  test("Gemini javobini to'g'ri ajratib qaytaradi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({ text: "TARTIB: churn, vip\nSABAB: Sabab matni." });
    const { _testables } = loadAiCeoModuleWithDb({}, generateContentMock);
    const result = await _testables.craftActionPlan(
      { vipCount: 1, churnCount: 2, discountCandidateName: null, promoteCandidateName: null, revenueChangeText: "+10%", convertedCount: 0, availableKeys: ["vip", "churn"] },
      "Zelo"
    );
    expect(result).toEqual({ order: ["churn", "vip"], reasoning: "Sabab matni." });
  });

  test("Gemini bo'sh javob bersa, xato tashlaydi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({ text: "" });
    const { _testables } = loadAiCeoModuleWithDb({}, generateContentMock);
    await expect(
      _testables.craftActionPlan({ availableKeys: ["vip"] }, "Zelo")
    ).rejects.toThrow();
  });

  test("Gemini TARTIB'siz javob bersa, xato tashlaydi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({ text: "tushunarsiz erkin matn" });
    const { _testables } = loadAiCeoModuleWithDb({}, generateContentMock);
    await expect(
      _testables.craftActionPlan({ availableKeys: [] }, "Zelo")
    ).rejects.toThrow();
  });
});

describe("15-NICHE UNIVERSAL PLATFORMA: buildActionPlanPrompt/buildCrmCampaignPrompt niche-aware", () => {
  test("buildActionPlanPrompt - niche berilmasa, standart ('Boshqa') kontekstga tushmaydi, xato bermaydi", () => {
    const { _testables } = loadAiCeoModuleWithDb({});
    const prompt = _testables.buildActionPlanPrompt({ availableKeys: ["vip"] }, "Zelo");
    expect(prompt).toContain("strategik maslahatchisan");
  });

  test("buildActionPlanPrompt - Elektronika niche berilsa, uning AI konteksti promptga kiritiladi", () => {
    const { getNicheConfig } = require("../lib/niches");
    const { _testables } = loadAiCeoModuleWithDb({});
    const prompt = _testables.buildActionPlanPrompt({ availableKeys: ["vip"] }, "Zelo", "Elektronika");
    expect(prompt).toContain(getNicheConfig("Elektronika").aiContext);
  });

  test("buildActionPlanPrompt - Kosmetika niche uchun kosmetika konteksti kiritiladi (eski sotuvchilar uchun orqaga moslik)", () => {
    const { getNicheConfig } = require("../lib/niches");
    const { _testables } = loadAiCeoModuleWithDb({});
    const prompt = _testables.buildActionPlanPrompt({ availableKeys: ["vip"] }, "Zelo", "Kosmetika");
    expect(prompt).toContain(getNicheConfig("Kosmetika").aiContext);
  });

  test("buildCrmCampaignPrompt - berilgan niche'ning AI konteksti promptga kiritiladi", () => {
    const { getNicheConfig } = require("../lib/niches");
    const { _testables } = loadAiCeoModuleWithDb({});
    const prompt = _testables.buildCrmCampaignPrompt("vip", 5, "Zelo", null, "Kiyim-kechak");
    expect(prompt).toContain(getNicheConfig("Kiyim-kechak").aiContext);
  });

  test("craftCrmCampaign - berilgan nicheId Gemini promptiga uzatiladi", async () => {
    const { getNicheConfig } = require("../lib/niches");
    const generateContentMock = jest.fn().mockResolvedValue({ text: "SARLAVHA: Test\nXABAR: Test xabar.\nSABAB: Test sabab." });
    const { _testables } = loadAiCeoModuleWithDb({}, generateContentMock);
    await _testables.craftCrmCampaign("vip", 5, "Zelo", null, "Poyabzal");
    const sentPrompt = generateContentMock.mock.calls[0][0].contents;
    expect(sentPrompt).toContain(getNicheConfig("Poyabzal").aiContext);
  });
});
