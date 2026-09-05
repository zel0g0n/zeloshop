/**
 * `storyImage.js`ning `generateStoryImage` onCall funksiyasi uchun
 * testlar — sotuvchi TALAB BO'YICHA (on-demand) bitta mahsulot uchun
 * 9:16 "Story" formatidagi reklama surati so'raydi.
 *
 * ASOSIY E'TIBOR: (1) autentifikatsiya/egalik/aiCeoEnabled
 * tekshiruvlari, (2) kunlik chegara, (3) muvaffaqiyatli holatda
 * `aiStoryImageUrl`ni HAQIQIY, to'g'ri formatlangan URL bilan
 * saqlashi VA natijani qaytarishi, (4) Gemini xato bersa, ANIQ
 * `HttpsError("internal", ...)` tashlashi (fon jarayoni bo'lgan
 * avtomatik ad-image'dan farqli — bu YERDA sotuvchi tugmani bosib,
 * NATIJA kutmoqda, shuning uchun xato JIM YUTILMAYDI, chaqiruvchiga
 * aniq xabar bilan qaytariladi).
 */

function buildMockDb({ productData = null, sellerData = null } = {}) {
  const productUpdateCalls = [];
  return {
    collection: (name) => {
      if (name === "products") {
        return {
          doc: () => ({
            get: async () => ({ exists: productData !== null, data: () => productData || {} }),
            update: async (data) => productUpdateCalls.push(data),
          }),
        };
      }
      if (name === "sellers") {
        return {
          doc: () => ({ get: async () => ({ exists: sellerData !== null, data: () => sellerData || {} }) }),
        };
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
    GEMINI_API_KEY: { value: () => "mock-gemini-key" },
  }));
  jest.doMock("../lib/rateLimit", () => ({ checkRateLimit: checkRateLimitMock || jest.fn().mockResolvedValue(undefined) }));
  jest.doMock("../lib/dailyStats", () => ({ incrementDailyStat: incrementDailyStatMock || jest.fn().mockResolvedValue(undefined) }));
  jest.doMock("../lib/aiImage", () => ({ generateProductStoryImage: generateProductStoryImageMock || jest.fn() }));
  global.fetch = fetchMock || jest.fn();
  return require("../storyImage");
}

const product = { sellerId: "s1", name: "Krem", category: "Yuz parvarishi", image: "https://firebasestorage.googleapis.com/v0/b/commerce-zelo.appspot.com/o/products%2Fimg.jpg?alt=media" };

describe("handleGenerateStoryImage", () => {
  test("autentifikatsiyasiz chaqiruvni rad etadi", async () => {
    const { _testables } = loadModule({ db: buildMockDb({}), bucket: buildMockBucket() });
    await expect(
      _testables.handleGenerateStoryImage({ auth: null, data: { productId: "p1" } })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("productId berilmasa rad etadi", async () => {
    const { _testables } = loadModule({ db: buildMockDb({}), bucket: buildMockBucket() });
    await expect(
      _testables.handleGenerateStoryImage({ auth: { uid: "s1" }, data: {} })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("mavjud bo'lmagan mahsulot - 'not-found' beradi", async () => {
    const { _testables } = loadModule({ db: buildMockDb({ productData: null }), bucket: buildMockBucket() });
    await expect(
      _testables.handleGenerateStoryImage({ auth: { uid: "s1" }, data: { productId: "p1" } })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  test("boshqa sotuvchining mahsulotiga urinish - 'permission-denied' beradi", async () => {
    const db = buildMockDb({ productData: { ...product, sellerId: "boshqa-sotuvchi" } });
    const { _testables } = loadModule({ db, bucket: buildMockBucket() });
    await expect(
      _testables.handleGenerateStoryImage({ auth: { uid: "s1" }, data: { productId: "p1" } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("aiCeoEnabled=false sotuvchi uchun - 'failed-precondition' beradi", async () => {
    const db = buildMockDb({ productData: product, sellerData: { aiCeoEnabled: false } });
    const { _testables } = loadModule({ db, bucket: buildMockBucket() });
    await expect(
      _testables.handleGenerateStoryImage({ auth: { uid: "s1" }, data: { productId: "p1" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("mahsulotda asosiy rasm bo'lmasa - 'failed-precondition' beradi", async () => {
    const db = buildMockDb({ productData: { ...product, image: null }, sellerData: { aiCeoEnabled: true } });
    const { _testables } = loadModule({ db, bucket: buildMockBucket() });
    await expect(
      _testables.handleGenerateStoryImage({ auth: { uid: "s1" }, data: { productId: "p1" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("kunlik chegaradan oshgan bo'lsa - xatoni tashlaydi (bu YERDA jim yutilmaydi)", async () => {
    const db = buildMockDb({ productData: product, sellerData: { aiCeoEnabled: true } });
    const checkRateLimitMock = jest.fn().mockRejectedValue(Object.assign(new Error("chegaradan oshdi"), { code: "resource-exhausted" }));
    const { _testables } = loadModule({ db, bucket: buildMockBucket(), checkRateLimitMock });
    await expect(
      _testables.handleGenerateStoryImage({ auth: { uid: "s1" }, data: { productId: "p1" } })
    ).rejects.toMatchObject({ code: "resource-exhausted" });
  });

  test("muvaffaqiyatli holatda: rasmni Storage'ga yozadi, `aiStoryImageUrl`ni saqlaydi va natijani qaytaradi", async () => {
    const db = buildMockDb({ productData: product, sellerData: { aiCeoEnabled: true } });
    const bucket = buildMockBucket();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from("source-bytes"),
      headers: { get: () => "image/jpeg" },
    });
    const generateProductStoryImageMock = jest.fn().mockResolvedValue({ imageBase64: "c3Rvcnk=", mimeType: "image/png" });
    const incrementDailyStatMock = jest.fn().mockResolvedValue(undefined);
    const { _testables } = loadModule({ db, bucket, fetchMock, generateProductStoryImageMock, incrementDailyStatMock });

    const result = await _testables.handleGenerateStoryImage({ auth: { uid: "s1" }, data: { productId: "p1" } });

    expect(bucket.__savedFiles.length).toBe(1);
    expect(bucket.__savedFiles[0].path).toBe("products/s1/ai-story-p1.png");
    expect(db.__productUpdateCalls.length).toBe(1);
    expect(db.__productUpdateCalls[0].aiStoryImageUrl).toContain("products%2Fs1%2Fai-story-p1.png");
    expect(result.imageUrl).toBe(db.__productUpdateCalls[0].aiStoryImageUrl);
    expect(incrementDailyStatMock).toHaveBeenCalledWith("s1", "aiStoryImagesGenerated");
  });

  // XAVFSIZLIK (P1 fix, 2026-09 audit — SSRF): agar `product.image`
  // Firebase Storage'dan BOSHQA (masalan ichki tarmoq/metadata server)
  // manzilga ishora qilsa, funksiya tarmoqqa HECH QANDAY so'rov
  // yubormasdan rad etishi kerak.
  test("mahsulot rasmi Firebase Storage'dan BOSHQA manzilga ishora qilsa (SSRF) — rad etadi va fetch chaqirmaydi", async () => {
    const db = buildMockDb({
      productData: { ...product, image: "http://169.254.169.254/latest/meta-data/" },
      sellerData: { aiCeoEnabled: true },
    });
    const fetchMock = jest.fn();
    const { _testables } = loadModule({ db, bucket: buildMockBucket(), fetchMock });

    await expect(
      _testables.handleGenerateStoryImage({ auth: { uid: "s1" }, data: { productId: "p1" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("Gemini xato bersa - ANIQ 'internal' xatosini tashlaydi va hech narsa yozmaydi", async () => {
    const db = buildMockDb({ productData: product, sellerData: { aiCeoEnabled: true } });
    const bucket = buildMockBucket();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from("source-bytes"),
      headers: { get: () => "image/jpeg" },
    });
    const generateProductStoryImageMock = jest.fn().mockRejectedValue(new Error("Gemini vaqtincha ishlamayapti"));
    const { _testables } = loadModule({ db, bucket, fetchMock, generateProductStoryImageMock });

    await expect(
      _testables.handleGenerateStoryImage({ auth: { uid: "s1" }, data: { productId: "p1" } })
    ).rejects.toMatchObject({ code: "internal" });
    expect(bucket.__savedFiles.length).toBe(0);
    expect(db.__productUpdateCalls.length).toBe(0);
  });
});
