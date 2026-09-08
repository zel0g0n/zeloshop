/**
 * `heroImage.js`ning `generateProductHeroImage` onCall funksiyasi
 * uchun testlar — sotuvchi TALAB BO'YICHA (on-demand) bitta mahsulot
 * uchun AI "asosiy rasm" (hero image, kvadrat 1:1) yaratadi va uni
 * DARHOL mahsulotning asosiy rasmi sifatida saqlaydi.
 *
 * Bu fayl ESKI `storyImage.test.js`ning o'rniga keldi (2026-09,
 * foydalanuvchi so'rovi: 9:16 vertikal "Story" rasm o'rniga, mahsulot
 * kartochkasiga (kvadratga yaqin) mos, ikkita uslub tanlovi bilan
 * "asosiy rasm" generatori).
 *
 * ASOSIY E'TIBOR: (1) autentifikatsiya/egalik/aiCeoEnabled
 * tekshiruvlari, (2) kunlik chegara, (3) muvaffaqiyatli holatda
 * `images`/`image` maydonlarini YANGI rasm BIRINCHI bo'lgan holda
 * to'g'ri yangilashi, (4) ikkala uslub (`adCreative`/`premiumShowcase`)
 * to'g'ri Gemini generatorini chaqirishi, (5) noma'lum uslub
 * "adCreative"ga xavfsiz tushishi, (6) Gemini xato bersa, ANIQ
 * `HttpsError("internal", ...)` tashlashi.
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

function loadModule({ db, bucket, checkRateLimitMock, generateProductAdImageMock, generateProductShowcaseImageMock, incrementDailyStatMock, fetchMock }) {
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
  jest.doMock("../lib/aiImage", () => ({
    generateProductAdImage: generateProductAdImageMock || jest.fn(),
    generateProductShowcaseImage: generateProductShowcaseImageMock || jest.fn(),
    // Haqiqiy modulning o'zidan olinadi (soddaligicha, "429" tekshiruvi)
    // - shu orqali quyidagi 429-testi HAQIQIY aniqlash mantig'ini
    // sinaydi, faqat qayta yozilgan/soxta versiyasini emas.
    isGeminiRateLimitError: (err) => err?.status === 429,
  }));
  global.fetch = fetchMock || jest.fn();
  return require("../heroImage");
}

const product = {
  sellerId: "s1",
  name: "Krem",
  category: "Yuz parvarishi",
  image: "https://firebasestorage.googleapis.com/v0/b/commerce-zelo.appspot.com/o/products%2Fimg.jpg?alt=media",
  images: ["https://firebasestorage.googleapis.com/v0/b/commerce-zelo.appspot.com/o/products%2Fimg.jpg?alt=media"],
};

const successFetchMock = () =>
  jest.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: async () => Buffer.from("source-bytes"),
    headers: { get: () => "image/jpeg" },
  });

describe("handleGenerateProductHeroImage", () => {
  test("autentifikatsiyasiz chaqiruvni rad etadi", async () => {
    const { _testables } = loadModule({ db: buildMockDb({}), bucket: buildMockBucket() });
    await expect(
      _testables.handleGenerateProductHeroImage({ auth: null, data: { productId: "p1" } })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("productId berilmasa rad etadi", async () => {
    const { _testables } = loadModule({ db: buildMockDb({}), bucket: buildMockBucket() });
    await expect(
      _testables.handleGenerateProductHeroImage({ auth: { uid: "s1" }, data: {} })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("mavjud bo'lmagan mahsulot - 'not-found' beradi", async () => {
    const { _testables } = loadModule({ db: buildMockDb({ productData: null }), bucket: buildMockBucket() });
    await expect(
      _testables.handleGenerateProductHeroImage({ auth: { uid: "s1" }, data: { productId: "p1" } })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  test("boshqa sotuvchining mahsulotiga urinish - 'permission-denied' beradi", async () => {
    const db = buildMockDb({ productData: { ...product, sellerId: "boshqa-sotuvchi" } });
    const { _testables } = loadModule({ db, bucket: buildMockBucket() });
    await expect(
      _testables.handleGenerateProductHeroImage({ auth: { uid: "s1" }, data: { productId: "p1" } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("aiCeoEnabled=false sotuvchi uchun - 'failed-precondition' beradi", async () => {
    const db = buildMockDb({ productData: product, sellerData: { aiCeoEnabled: false } });
    const { _testables } = loadModule({ db, bucket: buildMockBucket() });
    await expect(
      _testables.handleGenerateProductHeroImage({ auth: { uid: "s1" }, data: { productId: "p1" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("mahsulotda asosiy rasm bo'lmasa - 'failed-precondition' beradi", async () => {
    const db = buildMockDb({ productData: { ...product, image: null }, sellerData: { aiCeoEnabled: true } });
    const { _testables } = loadModule({ db, bucket: buildMockBucket() });
    await expect(
      _testables.handleGenerateProductHeroImage({ auth: { uid: "s1" }, data: { productId: "p1" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("kunlik chegaradan oshgan bo'lsa - xatoni tashlaydi (bu YERDA jim yutilmaydi)", async () => {
    const db = buildMockDb({ productData: product, sellerData: { aiCeoEnabled: true } });
    const checkRateLimitMock = jest.fn().mockRejectedValue(Object.assign(new Error("chegaradan oshdi"), { code: "resource-exhausted" }));
    const { _testables } = loadModule({ db, bucket: buildMockBucket(), checkRateLimitMock });
    await expect(
      _testables.handleGenerateProductHeroImage({ auth: { uid: "s1" }, data: { productId: "p1" } })
    ).rejects.toMatchObject({ code: "resource-exhausted" });
  });

  test("mahsulot rasmi Firebase Storage'dan BOSHQA manzilga ishora qilsa (SSRF) — rad etadi va fetch chaqirmaydi", async () => {
    const db = buildMockDb({
      productData: { ...product, image: "http://169.254.169.254/latest/meta-data/" },
      sellerData: { aiCeoEnabled: true },
    });
    const fetchMock = jest.fn();
    const { _testables } = loadModule({ db, bucket: buildMockBucket(), fetchMock });

    await expect(
      _testables.handleGenerateProductHeroImage({ auth: { uid: "s1" }, data: { productId: "p1" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("style='adCreative': mos generatorni chaqiradi, rasmni Storage'ga yozadi va YANGI rasmni RO'YXAT BOSHIGA qo'yadi", async () => {
    const db = buildMockDb({ productData: product, sellerData: { aiCeoEnabled: true } });
    const bucket = buildMockBucket();
    const generateProductAdImageMock = jest.fn().mockResolvedValue({ imageBase64: "YWQtaW1hZ2U=", mimeType: "image/png" });
    const generateProductShowcaseImageMock = jest.fn();
    const incrementDailyStatMock = jest.fn().mockResolvedValue(undefined);
    const { _testables } = loadModule({
      db, bucket, fetchMock: successFetchMock(), generateProductAdImageMock, generateProductShowcaseImageMock, incrementDailyStatMock,
    });

    const result = await _testables.handleGenerateProductHeroImage({
      auth: { uid: "s1" },
      data: { productId: "p1", style: "adCreative" },
    });

    expect(generateProductAdImageMock).toHaveBeenCalledTimes(1);
    expect(generateProductShowcaseImageMock).not.toHaveBeenCalled();
    expect(bucket.__savedFiles.length).toBe(1);
    expect(bucket.__savedFiles[0].path).toBe("products/s1/ai-hero-p1.png");

    const update = db.__productUpdateCalls[0];
    expect(update.aiHeroImageStyle).toBe("adCreative");
    expect(update.images[0]).toContain("ai-hero-p1.png");
    expect(update.image).toBe(update.images[0]);
    // Mavjud (haqiqiy) rasm GALEREYADA saqlanib qoladi, faqat endi ikkinchi o'rinda.
    expect(update.images).toContain(product.image);
    expect(update.images.length).toBe(2);
    expect(result.imageUrl).toBe(update.images[0]);
  });

  test("style='premiumShowcase': mos generatorni chaqiradi", async () => {
    const db = buildMockDb({ productData: product, sellerData: { aiCeoEnabled: true } });
    const bucket = buildMockBucket();
    const generateProductAdImageMock = jest.fn();
    const generateProductShowcaseImageMock = jest.fn().mockResolvedValue({ imageBase64: "c2hvd2Nhc2U=", mimeType: "image/jpeg" });
    const { _testables } = loadModule({
      db, bucket, fetchMock: successFetchMock(), generateProductAdImageMock, generateProductShowcaseImageMock,
    });

    const result = await _testables.handleGenerateProductHeroImage({
      auth: { uid: "s1" },
      data: { productId: "p1", style: "premiumShowcase" },
    });

    expect(generateProductShowcaseImageMock).toHaveBeenCalledTimes(1);
    expect(generateProductAdImageMock).not.toHaveBeenCalled();
    expect(db.__productUpdateCalls[0].aiHeroImageStyle).toBe("premiumShowcase");
    expect(result.imageUrl).toContain("ai-hero-p1.jpeg");
  });

  test("noma'lum/berilmagan uslub 'adCreative'ga xavfsiz tushadi", async () => {
    const db = buildMockDb({ productData: product, sellerData: { aiCeoEnabled: true } });
    const generateProductAdImageMock = jest.fn().mockResolvedValue({ imageBase64: "YWQ=", mimeType: "image/png" });
    const generateProductShowcaseImageMock = jest.fn();
    const { _testables } = loadModule({
      db, bucket: buildMockBucket(), fetchMock: successFetchMock(), generateProductAdImageMock, generateProductShowcaseImageMock,
    });

    await _testables.handleGenerateProductHeroImage({ auth: { uid: "s1" }, data: { productId: "p1", style: "notARealStyle" } });

    expect(generateProductAdImageMock).toHaveBeenCalledTimes(1);
    expect(generateProductShowcaseImageMock).not.toHaveBeenCalled();
  });

  test("4 ta rasm allaqachon bo'lsa, yangisi qo'shilgach eng oxirgisi chiqarib tashlanadi (4 tadan oshmaydi)", async () => {
    const storageUrl = (name) => `https://firebasestorage.googleapis.com/v0/b/commerce-zelo.appspot.com/o/products%2F${name}?alt=media`;
    const fourImages = [storageUrl("img1.jpg"), storageUrl("img2.jpg"), storageUrl("img3.jpg"), storageUrl("img4.jpg")];
    const db = buildMockDb({
      productData: { ...product, image: fourImages[0], images: fourImages },
      sellerData: { aiCeoEnabled: true },
    });
    const generateProductAdImageMock = jest.fn().mockResolvedValue({ imageBase64: "YWQ=", mimeType: "image/png" });
    const { _testables } = loadModule({ db, bucket: buildMockBucket(), fetchMock: successFetchMock(), generateProductAdImageMock });

    await _testables.handleGenerateProductHeroImage({ auth: { uid: "s1" }, data: { productId: "p1" } });

    const update = db.__productUpdateCalls[0];
    expect(update.images.length).toBe(4);
    expect(update.images).not.toContain(fourImages[3]);
    expect(update.images.slice(1)).toEqual([fourImages[0], fourImages[1], fourImages[2]]);
  });

  test("Gemini xato bersa - ANIQ 'internal' xatosini tashlaydi va hech narsa yozmaydi", async () => {
    const db = buildMockDb({ productData: product, sellerData: { aiCeoEnabled: true } });
    const bucket = buildMockBucket();
    const generateProductAdImageMock = jest.fn().mockRejectedValue(new Error("Gemini vaqtincha ishlamayapti"));
    const { _testables } = loadModule({ db, bucket, fetchMock: successFetchMock(), generateProductAdImageMock });

    await expect(
      _testables.handleGenerateProductHeroImage({ auth: { uid: "s1" }, data: { productId: "p1" } })
    ).rejects.toMatchObject({ code: "internal" });
    expect(bucket.__savedFiles.length).toBe(0);
    expect(db.__productUpdateCalls.length).toBe(0);
  });

  // 2026-09, Sentry orqali production'da ANIQLANGAN haqiqiy holat: Gemini
  // 429 (kvota/so'rovlar limiti) bilan javob berdi. Bu ODDIY "internal"
  // xatosidan FARQLI, ANIQ "resource-exhausted" kodi va vaqtinchalik
  // ekanini bildiruvchi xabar bilan qaytishi shart.
  test("Gemini 429 (kvota/limit) bilan xato bersa - ANIQ 'resource-exhausted' xatosini tashlaydi", async () => {
    const db = buildMockDb({ productData: product, sellerData: { aiCeoEnabled: true } });
    const bucket = buildMockBucket();
    const rateLimitErr = Object.assign(new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'), { status: 429 });
    const generateProductAdImageMock = jest.fn().mockRejectedValue(rateLimitErr);
    const { _testables } = loadModule({ db, bucket, fetchMock: successFetchMock(), generateProductAdImageMock });

    await expect(
      _testables.handleGenerateProductHeroImage({ auth: { uid: "s1" }, data: { productId: "p1" } })
    ).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(bucket.__savedFiles.length).toBe(0);
    expect(db.__productUpdateCalls.length).toBe(0);
  });
});
