/**
 * `productAutomation.js`ning YANGI `maybeGenerateStoryImage` (#116,
 * mahsulot qo'shilganda avtomatik, LEKIN FAQAT SOTUVCHI ATAYLAB
 * YOQQANDA - opt-in - 9:16 "Story" formatidagi reklama surati
 * generatsiyasi) funksiyasi uchun testlar.
 *
 * ALOHIDA FAYLDA (`productAutomationAdImage.test.js`dagi bilan bir
 * xil sabab): `db`/`admin`/tarmoq chaqiruvlarini soxtalashtirish
 * kerak.
 *
 * ASOSIY E'TIBOR: (1) faqat `aiCeoEnabled===true` VA ALOHIDA
 * `aiAutoStoryImageEnabled===true` (standart bo'yicha O'CHIQ, opt-in)
 * bo'lgan sotuvchilar uchun ishlashi - bazaviy reklama rasmidan
 * FARQLI, bu YANA bir qo'shimcha, ATAYLAB yoqilishi kerak bo'lgan
 * sozlama; (2) asosiy rasm yo'q bo'lsa hech narsa qilmasligi; (3)
 * kunlik chegaradan oshsa jim to'xtashi; (4) muvaffaqiyatli holatda
 * `aiStoryImageUrl`ni (qo'lda chaqiriladigan `generateStoryImage`
 * bilan BIR XIL maydon nomi) to'g'ri yozishi; (5) xato bo'lsa ham
 * funksiya xato tashlamasligi.
 */

function buildMockDb({ sellerData = null } = {}) {
  const productUpdateCalls = [];
  return {
    collection: (name) => {
      if (name === "sellers") {
        return { doc: () => ({ get: async () => ({ exists: sellerData !== null, data: () => sellerData || {} }) }) };
      }
      if (name === "products") {
        return { doc: () => ({ update: async (data) => productUpdateCalls.push(data) }) };
      }
      throw new Error(`Kutilmagan kolleksiya: ${name}`);
    },
    __productUpdateCalls: productUpdateCalls,
  };
}

function buildMockBucket() {
  const savedFiles = [];
  return {
    name: "commerce-zelo.appspot.com",
    file: (path) => ({
      save: async (buffer, opts) => savedFiles.push({ path, buffer, opts }),
    }),
    __savedFiles: savedFiles,
  };
}

function loadModule({ db, bucket, checkRateLimitMock, generateProductStoryImageMock, incrementDailyStatMock, fetchMock }) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: {
      storage: () => ({ bucket: () => bucket }),
      firestore: { FieldValue: { serverTimestamp: () => "MOCK_TS" } },
    },
    db,
    BOT_TOKEN: { value: () => "fallback-token" },
    GEMINI_API_KEY: { value: () => "mock-gemini-key" },
  }));
  jest.doMock("../lib/rateLimit", () => ({ checkRateLimit: checkRateLimitMock || jest.fn().mockResolvedValue(undefined) }));
  jest.doMock("../lib/dailyStats", () => ({ incrementDailyStat: incrementDailyStatMock || jest.fn().mockResolvedValue(undefined) }));
  jest.doMock("../lib/aiImage", () => ({
    generateProductAdImage: jest.fn(),
    generateProductStoryImage: generateProductStoryImageMock || jest.fn(),
  }));
  global.fetch = fetchMock || jest.fn();
  const { _testables } = require("../productAutomation");
  return _testables.maybeGenerateStoryImage;
}

const product = { sellerId: "s1", name: "Krem", category: "Yuz parvarishi", image: "https://firebasestorage.googleapis.com/v0/b/commerce-zelo.appspot.com/o/products%2Fimg.jpg?alt=media" };

describe("maybeGenerateStoryImage", () => {
  test("aiCeoEnabled=true bo'lsa HAM, `aiAutoStoryImageEnabled` YOQILMAGAN bo'lsa (standart holat) - HECH NARSA qilmaydi", async () => {
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true } }); // aiAutoStoryImageEnabled ko'rsatilmagan
    const bucket = buildMockBucket();
    const generateProductStoryImageMock = jest.fn();
    const maybeGenerateStoryImage = loadModule({ db, bucket, generateProductStoryImageMock });
    await maybeGenerateStoryImage("s1", "p1", product);
    expect(generateProductStoryImageMock).not.toHaveBeenCalled();
    expect(db.__productUpdateCalls.length).toBe(0);
  });

  test("aiCeoEnabled=false bo'lsa (garchi `aiAutoStoryImageEnabled: true` bo'lsa ham) - HECH NARSA qilmaydi", async () => {
    const db = buildMockDb({ sellerData: { aiCeoEnabled: false, aiAutoStoryImageEnabled: true } });
    const bucket = buildMockBucket();
    const generateProductStoryImageMock = jest.fn();
    const maybeGenerateStoryImage = loadModule({ db, bucket, generateProductStoryImageMock });
    await maybeGenerateStoryImage("s1", "p1", product);
    expect(generateProductStoryImageMock).not.toHaveBeenCalled();
  });

  test("ikkalasi ham YOQILGAN bo'lsa - ishga tushadi", async () => {
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true, aiAutoStoryImageEnabled: true } });
    const bucket = buildMockBucket();
    const fetchMock = jest.fn().mockResolvedValue({
      arrayBuffer: async () => Buffer.from("source-bytes"),
      headers: { get: () => "image/jpeg" },
    });
    const generateProductStoryImageMock = jest.fn().mockResolvedValue({ imageBase64: "ZmFrZQ==", mimeType: "image/png" });
    const incrementDailyStatMock = jest.fn().mockResolvedValue(undefined);
    const maybeGenerateStoryImage = loadModule({ db, bucket, fetchMock, generateProductStoryImageMock, incrementDailyStatMock });

    await maybeGenerateStoryImage("s1", "p1", product);

    expect(generateProductStoryImageMock).toHaveBeenCalledTimes(1);
    expect(bucket.__savedFiles.length).toBe(1);
    expect(bucket.__savedFiles[0].path).toBe("products/s1/ai-story-p1.png");
    expect(db.__productUpdateCalls.length).toBe(1);
    const updateData = db.__productUpdateCalls[0];
    expect(updateData.aiStoryImageUrl).toContain("https://firebasestorage.googleapis.com/v0/b/");
    expect(updateData.aiStoryImageUrl).toContain("products%2Fs1%2Fai-story-p1.png");
    expect(updateData.aiStoryImageUrl).toContain("alt=media&token=");
    expect(incrementDailyStatMock).toHaveBeenCalledWith("s1", "aiCeoAutoStoryImagesGenerated");
  });

  test("asosiy rasm (`product.image`) bo'lmasa, HECH NARSA qilmaydi", async () => {
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true, aiAutoStoryImageEnabled: true } });
    const bucket = buildMockBucket();
    const generateProductStoryImageMock = jest.fn();
    const maybeGenerateStoryImage = loadModule({ db, bucket, generateProductStoryImageMock });
    await maybeGenerateStoryImage("s1", "p1", { ...product, image: null });
    expect(generateProductStoryImageMock).not.toHaveBeenCalled();
  });

  test("kunlik chegaradan oshgan bo'lsa, JIM to'xtaydi (xato tashlamaydi)", async () => {
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true, aiAutoStoryImageEnabled: true } });
    const bucket = buildMockBucket();
    const checkRateLimitMock = jest.fn().mockRejectedValue(new Error("resource-exhausted"));
    const generateProductStoryImageMock = jest.fn();
    const maybeGenerateStoryImage = loadModule({ db, bucket, checkRateLimitMock, generateProductStoryImageMock });
    await expect(maybeGenerateStoryImage("s1", "p1", product)).resolves.not.toThrow();
    expect(generateProductStoryImageMock).not.toHaveBeenCalled();
  });

  test("AI xato bersa (rasm generatsiya qilinmasa), FUNKSIYA XATO TASHLAMAYDI va hech narsa yozmaydi", async () => {
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true, aiAutoStoryImageEnabled: true } });
    const bucket = buildMockBucket();
    const fetchMock = jest.fn().mockResolvedValue({
      arrayBuffer: async () => Buffer.from("source-bytes"),
      headers: { get: () => "image/jpeg" },
    });
    const generateProductStoryImageMock = jest.fn().mockRejectedValue(new Error("Gemini vaqtincha ishlamayapti"));
    const maybeGenerateStoryImage = loadModule({ db, bucket, fetchMock, generateProductStoryImageMock });

    await expect(maybeGenerateStoryImage("s1", "p1", product)).resolves.not.toThrow();
    expect(bucket.__savedFiles.length).toBe(0);
    expect(db.__productUpdateCalls.length).toBe(0);
  });

  test("sotuvchi hujjati umuman topilmasa - HECH NARSA qilmaydi, xato bermaydi", async () => {
    const db = buildMockDb({ sellerData: null });
    const bucket = buildMockBucket();
    const generateProductStoryImageMock = jest.fn();
    const maybeGenerateStoryImage = loadModule({ db, bucket, generateProductStoryImageMock });
    await expect(maybeGenerateStoryImage("s1", "p1", product)).resolves.not.toThrow();
    expect(generateProductStoryImageMock).not.toHaveBeenCalled();
  });
});
