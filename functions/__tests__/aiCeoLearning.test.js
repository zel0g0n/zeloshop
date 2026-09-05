/**
 * `aiCeoLearning.js` — AI CEO 7-BOSQICH ("natija kuzatuvi va o'rganish",
 * "avtonom agent" yo'l xaritasining 3-fazasi) uchun testlar.
 *
 * ASOSIY MAQSAD: (1) `recordAiCeoOutcome` xabar yuborilganda TO'G'RI
 * hujjat yozishini va hisoblagichni oshirishini, (2) `getRecentAiPerformance`
 * FAQAT yetarli namuna to'plangandan keyin (`MIN_SAMPLE_SIZE`) natija
 * qaytarishini, (3) `buildLearningSummaryForDisplay` xom maydonlarni
 * TO'G'RI inson-o'qiydigan shaklga aylantirishini, va (4)
 * `evaluateSellerOutcomes`ning "pending -> converted/not_converted"
 * baholash mantig'i TO'G'RI ishlashini tasdiqlash.
 */

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: (config, handler) => handler,
}));

function buildMockDb({ summaryData = null, pendingOutcomes = [], newerOrderExists = false, eligibleSellerIds = [] } = {}) {
  const summarySetCalls = [];
  const outcomeUpdateCalls = [];
  const outcomeAddCalls = [];

  const db = {
    collection: (name) => {
      if (name === "sellers") {
        return {
          where: () => ({
            get: async () => ({
              empty: eligibleSellerIds.length === 0,
              docs: eligibleSellerIds.map((id) => ({ id })),
            }),
          }),
          doc: () => ({
            collection: (subName) => {
              if (subName === "aiCeoOutcomes") {
                return {
                  add: async (data) => { outcomeAddCalls.push(data); },
                  where: () => ({
                    limit: () => ({
                      get: async () => ({
                        empty: pendingOutcomes.length === 0,
                        docs: pendingOutcomes.map((o) => ({
                          id: o.id,
                          data: () => o.data,
                          ref: { update: async (data) => outcomeUpdateCalls.push({ id: o.id, data }) },
                        })),
                      }),
                    }),
                  }),
                };
              }
              if (subName === "aiCeoLearning") {
                return {
                  doc: () => ({
                    get: async () => (summaryData ? { exists: true, data: () => summaryData } : { exists: false }),
                    set: async (data) => { summarySetCalls.push(data); },
                  }),
                };
              }
              return { doc: () => ({ get: async () => ({ exists: false }) }) };
            },
          }),
        };
      }
      if (name === "orders") {
        const chain = { where: () => chain, limit: () => ({ get: async () => ({ empty: !newerOrderExists }) }) };
        return chain;
      }
      return { doc: () => ({ get: async () => ({ exists: false }) }) };
    },
  };
  db.__summarySetCalls = summarySetCalls;
  db.__outcomeUpdateCalls = outcomeUpdateCalls;
  db.__outcomeAddCalls = outcomeAddCalls;
  return db;
}

function loadModule(db) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: {
      firestore: {
        Timestamp: { fromMillis: (ms) => ({ __ms: ms }) },
        FieldValue: { increment: (n) => ({ __increment: n }) },
      },
    },
    db,
  }));
  return require("../aiCeoLearning");
}

describe("recordAiCeoOutcome", () => {
  test("AI-yozilgan xabar uchun TO'G'RI hujjat yozadi va 'Ai' hisoblagichini oshiradi", async () => {
    const db = buildMockDb();
    const { recordAiCeoOutcome } = loadModule(db);
    await recordAiCeoOutcome({ sellerId: "s1", type: "winback", clientId: "c1", aiGenerated: true });

    expect(db.__outcomeAddCalls).toHaveLength(1);
    expect(db.__outcomeAddCalls[0]).toMatchObject({ type: "winback", clientId: "c1", aiGenerated: true, status: "pending" });
    expect(typeof db.__outcomeAddCalls[0].sentAtMs).toBe("number");

    expect(db.__summarySetCalls).toHaveLength(1);
    expect(db.__summarySetCalls[0]).toEqual({ winbackAiSent: { __increment: 1 } });
  });

  test("oddiy SHABLON (AI EMAS) xabar uchun 'Template' hisoblagichini oshiradi", async () => {
    const db = buildMockDb();
    const { recordAiCeoOutcome } = loadModule(db);
    await recordAiCeoOutcome({ sellerId: "s1", type: "favorite", clientId: "c1", aiGenerated: false });

    expect(db.__outcomeAddCalls[0].aiGenerated).toBe(false);
    expect(db.__summarySetCalls[0]).toEqual({ favoriteTemplateSent: { __increment: 1 } });
  });

  // YANGI (8-BOSQICH — "avtonom harakatlar doirasini kengaytirish"):
  // `discountIssued` - audit maydoni, `aiCeoAutoDiscount.js` bilan
  // bog'liq.
  test("discountIssued berilmasa - standart holatda 'false' deb yoziladi", async () => {
    const db = buildMockDb();
    const { recordAiCeoOutcome } = loadModule(db);
    await recordAiCeoOutcome({ sellerId: "s1", type: "winback", clientId: "c1", aiGenerated: true });
    expect(db.__outcomeAddCalls[0].discountIssued).toBe(false);
  });

  test("discountIssued=true berilsa - hujjatga TO'G'RI yoziladi", async () => {
    const db = buildMockDb();
    const { recordAiCeoOutcome } = loadModule(db);
    await recordAiCeoOutcome({ sellerId: "s1", type: "winback", clientId: "c1", aiGenerated: true, discountIssued: true });
    expect(db.__outcomeAddCalls[0].discountIssued).toBe(true);
  });

  test("zarur maydon (sellerId/clientId/type) yo'q bo'lsa, HECH NARSA yozmaydi", async () => {
    const db = buildMockDb();
    const { recordAiCeoOutcome } = loadModule(db);
    await recordAiCeoOutcome({ sellerId: null, type: "winback", clientId: "c1", aiGenerated: true });
    expect(db.__outcomeAddCalls).toHaveLength(0);
  });

  test("Firestore xato bersa, XATO TASHLAMAYDI (best-effort, jim log)", async () => {
    const db = { collection: () => { throw new Error("Firestore ishlamayapti"); } };
    const { recordAiCeoOutcome } = loadModule(db);
    await expect(recordAiCeoOutcome({ sellerId: "s1", type: "winback", clientId: "c1", aiGenerated: true })).resolves.not.toThrow();
  });
});

describe("getRecentAiPerformance", () => {
  test("hujjat mavjud bo'lmasa, NULL qaytaradi", async () => {
    const db = buildMockDb({ summaryData: null });
    const { getRecentAiPerformance } = loadModule(db);
    expect(await getRecentAiPerformance("s1", "winback")).toBeNull();
  });

  test("namuna hali YETARLI bo'lmasa (MIN_SAMPLE_SIZE'dan kam), NULL qaytaradi", async () => {
    const db = buildMockDb({ summaryData: { winbackAiSent: 3, winbackAiConverted: 2 } });
    const { getRecentAiPerformance } = loadModule(db);
    expect(await getRecentAiPerformance("s1", "winback")).toBeNull();
  });

  test("namuna YETARLI bo'lsa, TO'G'RI konversiya foizini hisoblab qaytaradi", async () => {
    const db = buildMockDb({ summaryData: { winbackAiSent: 20, winbackAiConverted: 5 } });
    const { getRecentAiPerformance } = loadModule(db);
    expect(await getRecentAiPerformance("s1", "winback")).toEqual({ sentCount: 20, convertedCount: 5, conversionRatePercent: 25 });
  });

  test("Firestore xato bersa, NULL qaytaradi (xato tashlamaydi)", async () => {
    const db = { collection: () => { throw new Error("Firestore ishlamayapti"); } };
    const { getRecentAiPerformance } = loadModule(db);
    await expect(getRecentAiPerformance("s1", "winback")).resolves.toBeNull();
  });
});

describe("buildLearningSummaryForDisplay", () => {
  test("bo'sh/null ma'lumot uchun ikkala turni ham NULL qaytaradi", () => {
    const db = buildMockDb();
    const { buildLearningSummaryForDisplay } = loadModule(db);
    expect(buildLearningSummaryForDisplay(null)).toEqual({ winback: null, favorite: null });
    expect(buildLearningSummaryForDisplay({})).toEqual({ winback: null, favorite: null });
  });

  test("sentCount 0 bo'lgan turni NULL qiladi, HATTO boshqa maydon mavjud bo'lsa ham", () => {
    const db = buildMockDb();
    const { buildLearningSummaryForDisplay } = loadModule(db);
    expect(buildLearningSummaryForDisplay({ winbackAiSent: 0, winbackAiConverted: 0 })).toEqual({ winback: null, favorite: null });
  });

  test("ikkala tur uchun ham TO'G'RI hisoblab qaytaradi", () => {
    const db = buildMockDb();
    const { buildLearningSummaryForDisplay } = loadModule(db);
    const result = buildLearningSummaryForDisplay({
      winbackAiSent: 10, winbackAiConverted: 3,
      favoriteAiSent: 8, favoriteAiConverted: 4,
    });
    expect(result).toEqual({
      winback: { sentCount: 10, convertedCount: 3, conversionRatePercent: 30 },
      favorite: { sentCount: 8, convertedCount: 4, conversionRatePercent: 50 },
    });
  });
});

describe("evaluateSellerOutcomes", () => {
  test("hali baholash VAQTI kelmagan (oyna to'lmagan) hujjatni O'TKAZIB YUBORADI", async () => {
    const db = buildMockDb({
      pendingOutcomes: [{ id: "o1", data: { type: "winback", clientId: "c1", aiGenerated: true, sentAtMs: Date.now() } }],
    });
    const { _testables } = loadModule(db);
    await _testables.evaluateSellerOutcomes("s1");
    expect(db.__outcomeUpdateCalls).toHaveLength(0);
  });

  test("oyna TO'LGAN va mijoz YANGI buyurtma bergan bo'lsa - 'converted' deb belgilaydi va hisoblagichni oshiradi", async () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const db = buildMockDb({
      pendingOutcomes: [{ id: "o1", data: { type: "winback", clientId: "c1", aiGenerated: true, sentAtMs: eightDaysAgo } }],
      newerOrderExists: true,
    });
    const { _testables } = loadModule(db);
    await _testables.evaluateSellerOutcomes("s1");

    expect(db.__outcomeUpdateCalls).toHaveLength(1);
    expect(db.__outcomeUpdateCalls[0].data.status).toBe("converted");
    expect(db.__summarySetCalls).toEqual([{ winbackAiConverted: { __increment: 1 } }]);
  });

  test("oyna TO'LGAN, lekin mijoz YANGI buyurtma BERMAGAN bo'lsa - 'not_converted' deb belgilaydi, hisoblagich OSHMAYDI", async () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const db = buildMockDb({
      pendingOutcomes: [{ id: "o1", data: { type: "favorite", clientId: "c1", aiGenerated: false, sentAtMs: eightDaysAgo } }],
      newerOrderExists: false,
    });
    const { _testables } = loadModule(db);
    await _testables.evaluateSellerOutcomes("s1");

    expect(db.__outcomeUpdateCalls[0].data.status).toBe("not_converted");
    expect(db.__summarySetCalls).toHaveLength(0);
  });

  test("hech qanday 'pending' hujjat bo'lmasa, hech narsa qilmaydi", async () => {
    const db = buildMockDb({ pendingOutcomes: [] });
    const { _testables } = loadModule(db);
    await expect(_testables.evaluateSellerOutcomes("s1")).resolves.not.toThrow();
    expect(db.__outcomeUpdateCalls).toHaveLength(0);
  });
});

describe("evaluateAiCeoOutcomes (rejalashtirilgan handler)", () => {
  test("aiCeoEnabled sotuvchi bo'lmasa, hech narsa qilmaydi", async () => {
    const db = buildMockDb({ eligibleSellerIds: [] });
    const { evaluateAiCeoOutcomes } = loadModule(db);
    await expect(evaluateAiCeoOutcomes()).resolves.not.toThrow();
  });

  test("bir nechta aiCeoEnabled sotuvchi bo'lsa, HAR BIRINI ketma-ket ko'rib chiqadi", async () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const db = buildMockDb({
      eligibleSellerIds: ["s1", "s2"],
      pendingOutcomes: [{ id: "o1", data: { type: "winback", clientId: "c1", aiGenerated: true, sentAtMs: eightDaysAgo } }],
      newerOrderExists: true,
    });
    const { evaluateAiCeoOutcomes } = loadModule(db);
    await evaluateAiCeoOutcomes();
    // Ikkala sotuvchi uchun HAM (bir xil mock hujjat to'plami) - jami 2ta yangilanish.
    expect(db.__outcomeUpdateCalls).toHaveLength(2);
  });
});
