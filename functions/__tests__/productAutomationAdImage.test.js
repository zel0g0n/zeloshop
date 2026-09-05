/**
 * `productAutomation.js`ning YANGI `maybeGenerateAdImage` (mahsulot
 * qo'shilganda avtomatik "Instagram reklama surati" generatsiyasi)
 * funksiyasi uchun testlar.
 *
 * ALOHIDA FAYLDA (mavjud `productAutomation.test.js`dan): o'sha fayl
 * `../productAutomation`ni HECH QANDAY mock'siz, to'g'ridan-to'g'ri
 * talab qiladi (faqat SOF yordamchi funksiyalarni sinaydi) - bu YERDA
 * esa `db`/`admin`/tarmoq chaqiruvlarini SOXTALASHTIRISH kerak,
 * shuning uchun ALOHIDA fayl - ikkalasi bir-biriga xalaqit bermaydi.
 *
 * ASOSIY E'TIBOR: (1) faqat `aiCeoEnabled===true` sotuvchilar uchun
 * ishlashi, (2) asosiy rasm yo'q bo'lsa HECH NARSA qilmasligi, (3)
 * kunlik chegaradan oshsa JIM to'xtashi, (4) muvaffaqiyatli holatda
 * `aiAdImageUrl`ni HAQIQIY, to'g'ri formatlangan URL bilan yozishi,
 * (5) Gemini/Storage xato bersa ham, funksiya XATO TASHLAMASLIGI
 * (chaqiruvchi trigger hech qachon buzilmasligi) kerak.
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

function loadModule({ db, bucket, checkRateLimitMock, generateProductAdImageMock, incrementDailyStatMock, fetchMock }) {
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
  jest.doMock("../lib/aiImage", () => ({ generateProductAdImage: generateProductAdImageMock || jest.fn() }));
  global.fetch = fetchMock || jest.fn();
  const { _testables } = require("../productAutomation");
  return _testables.maybeGenerateAdImage;
}

const product = { sellerId: "s1", name: "Krem", category: "Yuz parvarishi", image: "https://firebasestorage.googleapis.com/v0/b/commerce-zelo.appspot.com/o/products%2Fimg.jpg?alt=media" };

describe("maybeGenerateAdImage", () => {
  test("aiCeoEnabled=false bo'lsa, HECH NARSA qilmaydi (Gemini chaqirilmaydi)", async () => {
    const db = buildMockDb({ sellerData: { aiCeoEnabled: false } });
    const bucket = buildMockBucket();
    const generateProductAdImageMock = jest.fn();
    const maybeGenerateAdImage = loadModule({ db, bucket, generateProductAdImageMock });
    await maybeGenerateAdImage("s1", "p1", product);
    expect(generateProductAdImageMock).not.toHaveBeenCalled();
    expect(db.__productUpdateCalls.length).toBe(0);
  });

  test("asosiy rasm (`product.image`) bo'lmasa, HECH NARSA qilmaydi", async () => {
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true } });
    const bucket = buildMockBucket();
    const generateProductAdImageMock = jest.fn();
    const maybeGenerateAdImage = loadModule({ db, bucket, generateProductAdImageMock });
    await maybeGenerateAdImage("s1", "p1", { ...product, image: null });
    expect(generateProductAdImageMock).not.toHaveBeenCalled();
  });

  test("kunlik chegaradan oshgan bo'lsa, JIM to'xtaydi (xato tashlamaydi)", async () => {
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true } });
    const bucket = buildMockBucket();
    const checkRateLimitMock = jest.fn().mockRejectedValue(new Error("resource-exhausted"));
    const generateProductAdImageMock = jest.fn();
    const maybeGenerateAdImage = loadModule({ db, bucket, checkRateLimitMock, generateProductAdImageMock });
    await expect(maybeGenerateAdImage("s1", "p1", product)).resolves.not.toThrow();
    expect(generateProductAdImageMock).not.toHaveBeenCalled();
  });

  test("muvaffaqiyatli holatda: rasmni Storage'ga yozadi va `aiAdImageUrl`ni to'g'ri formatda saqlaydi", async () => {
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true } });
    const bucket = buildMockBucket();
    const fetchMock = jest.fn().mockResolvedValue({
      arrayBuffer: async () => Buffer.from("source-bytes"),
      headers: { get: () => "image/jpeg" },
    });
    const generateProductAdImageMock = jest.fn().mockResolvedValue({ imageBase64: "ZmFrZQ==", mimeType: "image/png" });
    const incrementDailyStatMock = jest.fn().mockResolvedValue(undefined);
    const maybeGenerateAdImage = loadModule({ db, bucket, fetchMock, generateProductAdImageMock, incrementDailyStatMock });

    await maybeGenerateAdImage("s1", "p1", product);

    expect(bucket.__savedFiles.length).toBe(1);
    expect(bucket.__savedFiles[0].path).toBe("products/s1/ai-ad-p1.png");
    expect(db.__productUpdateCalls.length).toBe(1);
    const updateData = db.__productUpdateCalls[0];
    expect(updateData.aiAdImageUrl).toContain("https://firebasestorage.googleapis.com/v0/b/");
    expect(updateData.aiAdImageUrl).toContain("products%2Fs1%2Fai-ad-p1.png");
    expect(updateData.aiAdImageUrl).toContain("alt=media&token=");
    expect(incrementDailyStatMock).toHaveBeenCalledWith("s1", "aiCeoAutoAdImagesGenerated");
  });

  test("Gemini xato bersa (rasm generatsiya qilinmasa), FUNKSIYA XATO TASHLAMAYDI va hech narsa yozmaydi", async () => {
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true } });
    const bucket = buildMockBucket();
    const fetchMock = jest.fn().mockResolvedValue({
      arrayBuffer: async () => Buffer.from("source-bytes"),
      headers: { get: () => "image/jpeg" },
    });
    const generateProductAdImageMock = jest.fn().mockRejectedValue(new Error("Gemini vaqtincha ishlamayapti"));
    const maybeGenerateAdImage = loadModule({ db, bucket, fetchMock, generateProductAdImageMock });

    await expect(maybeGenerateAdImage("s1", "p1", product)).resolves.not.toThrow();
    expect(bucket.__savedFiles.length).toBe(0);
    expect(db.__productUpdateCalls.length).toBe(0);
  });
});
