/**
 * `productAssistant.js` (Firestore/Gemini bilan bog'lovchi qism) uchun
 * testlar. Sof mantiq (kalit so'z tekshiruvi, kontekst yig'ish, prompt
 * qurish) alohida, `productAssistant.test.js`da sinaladi - bu yerda
 * FAQAT auth/validatsiya/Firestore-o'qish/Gemini-chaqiruv oqimi (mock
 * db va mock Gemini orqali) tekshiriladi.
 */

function buildMockDb({ productData = null, sellerData = null, reviews = [] } = {}) {
  return {
    collection: (name) => {
      if (name === "products") {
        return {
          doc: () => ({
            get: async () => (productData ? { exists: true, data: () => productData } : { exists: false }),
            collection: (sub) => {
              if (sub === "reviews") {
                return { limit: () => ({ get: async () => ({ docs: reviews.map((r) => ({ data: () => r })) }) }) };
              }
              return { get: async () => ({ docs: [] }) };
            },
          }),
        };
      }
      if (name === "sellers") {
        return {
          doc: () => ({
            get: async () => (sellerData ? { exists: true, data: () => sellerData } : { exists: false }),
          }),
        };
      }
      return { doc: () => ({ get: async () => ({ exists: false }) }) };
    },
    // Rate-limitni "hali chegaradan o'tmagan" holatda simulyatsiya
    // qiladi - bu fayldagi testlar rate-limit haqida qayg'urmaydi.
    runTransaction: async (callback) => callback({ get: async () => ({ exists: false }), set: () => {} }),
  };
}

function loadModule(db, generateContentMock = jest.fn().mockResolvedValue({ text: "Test javob." }), checkRateLimitMock) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    db,
    GEMINI_API_KEY: { value: () => "mock-gemini-key" },
  }));
  jest.doMock("@google/genai", () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({ models: { generateContent: generateContentMock } })),
  }));
  if (checkRateLimitMock) {
    jest.doMock("../lib/rateLimit", () => ({ checkRateLimit: checkRateLimitMock }));
  }
  return require("../productAssistant");
}

describe("handleAskProductQuestion", () => {
  test("auth bo'lmasa - unauthenticated xatosi", async () => {
    const { _testables } = loadModule(buildMockDb());
    await expect(_testables.handleAskProductQuestion({ auth: null, data: {} })).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  test("productId bo'lmasa - invalid-argument", async () => {
    const { _testables } = loadModule(buildMockDb());
    await expect(
      _testables.handleAskProductQuestion({ auth: { uid: "client-1" }, data: { question: "salom" } })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("savol bo'sh yoki 300 belgidan uzun bo'lsa - invalid-argument", async () => {
    const db = buildMockDb({ productData: { name: "X" } });
    const { _testables } = loadModule(db);
    await expect(
      _testables.handleAskProductQuestion({ auth: { uid: "c1" }, data: { productId: "p1", question: "  " } })
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(
      _testables.handleAskProductQuestion({ auth: { uid: "c1" }, data: { productId: "p1", question: "a".repeat(301) } })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("mahsulot topilmasa - not-found", async () => {
    const { _testables } = loadModule(buildMockDb({ productData: null }));
    await expect(
      _testables.handleAskProductQuestion({ auth: { uid: "c1" }, data: { productId: "missing", question: "narxi qancha?" } })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  test("TIBBIY savol bo'lsa - Gemini UMUMAN CHAQIRILMAYDI, refused:true qaytadi", async () => {
    const generateContentMock = jest.fn();
    const db = buildMockDb({ productData: { name: "Krem", sellerId: "s1" }, sellerData: { storeName: "Do'kon" } });
    const { _testables } = loadModule(db, generateContentMock);

    const result = await _testables.handleAskProductQuestion({
      auth: { uid: "c1" },
      data: { productId: "p1", question: "Bu kremda allergiyam bor, ishlatsam bo'ladimi?" },
    });

    expect(result).toEqual({ answer: null, refused: true, refusalReason: "medical" });
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  test("oddiy savolga Gemini chaqiriladi va javob qaytariladi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({ text: "Bu mahsulot yog'li teriga mos keladi." });
    const db = buildMockDb({
      productData: { name: "Krem", sellerId: "s1", stock: 5, price: 30000 },
      sellerData: { storeName: "GlowShop" },
      reviews: [{ text: "Zo'r mahsulot!", rating: 5 }],
    });
    const { _testables } = loadModule(db, generateContentMock);

    const result = await _testables.handleAskProductQuestion({
      auth: { uid: "c1" },
      data: { productId: "p1", question: "Bu yog'li teriga mos keladimi?", language: "uz" },
    });

    expect(result).toEqual({ answer: "Bu mahsulot yog'li teriga mos keladi.", refused: false });
    expect(generateContentMock).toHaveBeenCalledTimes(1);
    const callArg = generateContentMock.mock.calls[0][0];
    expect(callArg.config.systemInstruction).toContain("GlowShop");
    expect(callArg.config.systemInstruction).toContain("Zo'r mahsulot!");
  });

  test("Gemini bo'sh javob qaytarsa yoki xato tashlasa - internal xato", async () => {
    const db = buildMockDb({ productData: { name: "Krem" } });
    const { _testables } = loadModule(db, jest.fn().mockResolvedValue({ text: "" }));
    await expect(
      _testables.handleAskProductQuestion({ auth: { uid: "c1" }, data: { productId: "p1", question: "Narxi qancha?" } })
    ).rejects.toMatchObject({ code: "internal" });
  });

  // XAVFSIZLIK (P2 fix, 2026-09 audit): oldin FAQAT mijoz+mahsulot
  // juftligi bo'yicha chegara bor edi — mijoz KO'P TURLI mahsulotga
  // tarqatib so'rasa (masalan skript orqali), UMUMIY xarajat CHEKSIZ
  // o'sishi mumkin edi. Endi mijozning O'ZI bo'yicha (mahsulotdan
  // qat'i nazar) UMUMIY chegara HAM tekshirilishi kerak.
  test("mijoz+mahsulot VA mijozning UMUMIY chegarasi ikkalasi HAM tekshiriladi", async () => {
    const checkRateLimitMock = jest.fn().mockResolvedValue(undefined);
    const db = buildMockDb({ productData: { name: "Krem", sellerId: "s1" }, sellerData: { storeName: "Do'kon" } });
    const { _testables } = loadModule(db, jest.fn().mockResolvedValue({ text: "Javob." }), checkRateLimitMock);

    await _testables.handleAskProductQuestion({ auth: { uid: "c1" }, data: { productId: "p1", question: "Narxi qancha?" } });

    expect(checkRateLimitMock).toHaveBeenCalledWith("askProductQuestion:c1:p1", expect.any(Number), expect.any(Number));
    expect(checkRateLimitMock).toHaveBeenCalledWith("askProductQuestionTotal:c1", expect.any(Number), expect.any(Number));
  });

  test("mijozning UMUMIY (barcha mahsulotlar bo'yicha) chegarasi oshib ketsa — Gemini chaqirilmasdan rad etiladi (bitta mahsulotning o'z chegarasi hali to'lmagan bo'lsa ham)", async () => {
    const checkRateLimitMock = jest.fn()
      .mockResolvedValueOnce(undefined) // mijoz+mahsulot — hali o'tadi
      .mockRejectedValueOnce(Object.assign(new Error("umumiy chegaradan oshdi"), { code: "resource-exhausted" })); // umumiy — oshgan
    const generateContentMock = jest.fn();
    const db = buildMockDb({ productData: { name: "Krem", sellerId: "s1" }, sellerData: { storeName: "Do'kon" } });
    const { _testables } = loadModule(db, generateContentMock, checkRateLimitMock);

    await expect(
      _testables.handleAskProductQuestion({ auth: { uid: "c1" }, data: { productId: "p1", question: "Narxi qancha?" } })
    ).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(generateContentMock).not.toHaveBeenCalled();
  });
});
