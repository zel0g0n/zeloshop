/**
 * `lib/aiImage.js`ning "Instagram reklama surati" generatsiyasi uchun
 * testlar. MUHIM E'TIBOR: (1) prompt matni "mahsulotni asl holida
 * saqlash" qoidasini albatta o'z ichiga olishi kerak (bu - loyihaning
 * "AI haqiqiy ma'lumotni o'zgartirmasligi kerak" tamoyilining VIZUAL
 * versiyasi), (2) `generateProductAdImage` Gemini javobidan rasm
 * baytlarini TO'G'RI ajratishi va bo'sh/rasmsiz javobda XATO
 * TASHLASHI kerak (chaqiruvchi `productAutomation.js` buni jim
 * ushlaydi - lekin funksiyaning o'zi ANIQ signal berishi shart).
 */

jest.mock("../lib/admin", () => ({
  GEMINI_API_KEY: { value: () => "mock-gemini-key" },
}));

function loadModule({ generateContentMock } = {}) {
  jest.resetModules();
  jest.doMock("@google/genai", () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: { generateContent: generateContentMock || jest.fn() },
    })),
    Modality: { IMAGE: "IMAGE", TEXT: "TEXT" },
  }));
  return require("../lib/aiImage");
}

describe("buildInstagramAdPrompt", () => {
  test("mahsulotni ASL holida saqlash qoidasini albatta o'z ichiga oladi", () => {
    const { buildInstagramAdPrompt } = loadModule();
    const prompt = buildInstagramAdPrompt({ productName: "Krem", category: "Yuz parvarishi" });
    expect(prompt).toMatch(/do not redraw|reinterpret|alter/i);
    expect(prompt).toContain("Krem");
    expect(prompt).toContain("Yuz parvarishi");
  });

  test("mahsulot nomi/kategoriya berilmasa ham, xato bermaydi", () => {
    const { buildInstagramAdPrompt } = loadModule();
    expect(() => buildInstagramAdPrompt({})).not.toThrow();
    expect(() => buildInstagramAdPrompt()).not.toThrow();
  });

  test("Instagram/kvadrat formatga oid ko'rsatmani o'z ichiga oladi", () => {
    const { buildInstagramAdPrompt } = loadModule();
    const prompt = buildInstagramAdPrompt({ productName: "Krem" });
    expect(prompt).toMatch(/1:1|square/i);
    expect(prompt).toMatch(/Instagram/i);
  });
});

describe("buildStoryAdPrompt", () => {
  test("mahsulotni ASL holida saqlash qoidasini albatta o'z ichiga oladi", () => {
    const { buildStoryAdPrompt } = loadModule();
    const prompt = buildStoryAdPrompt({ productName: "Krem", category: "Yuz parvarishi" });
    expect(prompt).toMatch(/do not redraw|reinterpret|alter/i);
    expect(prompt).toContain("Krem");
    expect(prompt).toContain("Yuz parvarishi");
  });

  test("mahsulot nomi/kategoriya berilmasa ham, xato bermaydi", () => {
    const { buildStoryAdPrompt } = loadModule();
    expect(() => buildStoryAdPrompt({})).not.toThrow();
    expect(() => buildStoryAdPrompt()).not.toThrow();
  });

  test("vertikal 9:16 Story formatiga oid ko'rsatmani va 'xavfsiz zona' talabini o'z ichiga oladi", () => {
    const { buildStoryAdPrompt } = loadModule();
    const prompt = buildStoryAdPrompt({ productName: "Krem" });
    expect(prompt).toMatch(/9:16|vertical/i);
    expect(prompt).toMatch(/Story/i);
    expect(prompt).toMatch(/safe zone/i);
  });

  test("kvadrat (buildInstagramAdPrompt) promptidan FARQLI matn qaytaradi", () => {
    const { buildStoryAdPrompt, buildInstagramAdPrompt } = loadModule();
    expect(buildStoryAdPrompt({ productName: "Krem" })).not.toBe(buildInstagramAdPrompt({ productName: "Krem" }));
  });
});

describe("generateProductStoryImage", () => {
  test("manba rasm berilmasa, xato tashlaydi (Gemini'ga umuman murojaat qilinmaydi)", async () => {
    const generateContentMock = jest.fn();
    const { generateProductStoryImage } = loadModule({ generateContentMock });
    await expect(generateProductStoryImage({ imageBase64: null, imageMimeType: null })).rejects.toThrow();
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  test("Gemini rasm qaytarsa, base64 va mimeType'ni to'g'ri ajratadi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ inlineData: { data: "c3RvcnktaW1hZ2U=", mimeType: "image/png" } }],
          },
        },
      ],
    });
    const { generateProductStoryImage } = loadModule({ generateContentMock });
    const result = await generateProductStoryImage({
      imageBase64: "c291cmNlLWJ5dGVz",
      imageMimeType: "image/jpeg",
      productName: "Krem",
      category: "Yuz parvarishi",
    });
    expect(result).toEqual({ imageBase64: "c3RvcnktaW1hZ2U=", mimeType: "image/png" });
    expect(generateContentMock).toHaveBeenCalledTimes(1);
    const call = generateContentMock.mock.calls[0][0];
    expect(call.contents[0].parts[0].text).toMatch(/9:16|vertical/i);
  });

  test("Gemini javobida rasm qismi bo'lmasa, xato tashlaydi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "Kechirasiz, rasm yarata olmadim." }] } }],
    });
    const { generateProductStoryImage } = loadModule({ generateContentMock });
    await expect(
      generateProductStoryImage({ imageBase64: "c291cmNl", imageMimeType: "image/jpeg", productName: "Krem" })
    ).rejects.toThrow("AI rasm qaytarmadi.");
  });
});

describe("buildPremiumShowcasePrompt", () => {
  test("mahsulotni ASL holida saqlash qoidasini albatta o'z ichiga oladi", () => {
    const { buildPremiumShowcasePrompt } = loadModule();
    const prompt = buildPremiumShowcasePrompt({ productName: "Krem", category: "Yuz parvarishi" });
    expect(prompt).toMatch(/do not redraw|reinterpret|alter/i);
    expect(prompt).toContain("Krem");
    expect(prompt).toContain("Yuz parvarishi");
  });

  test("mahsulot nomi/kategoriya berilmasa ham, xato bermaydi", () => {
    const { buildPremiumShowcasePrompt } = loadModule();
    expect(() => buildPremiumShowcasePrompt({})).not.toThrow();
    expect(() => buildPremiumShowcasePrompt()).not.toThrow();
  });

  test("kvadrat 1:1 formatga oid ko'rsatmani va 'premium/luxury' uslubini o'z ichiga oladi", () => {
    const { buildPremiumShowcasePrompt } = loadModule();
    const prompt = buildPremiumShowcasePrompt({ productName: "Krem" });
    expect(prompt).toMatch(/1:1|square/i);
    expect(prompt).toMatch(/premium|luxury/i);
  });

  test("boshqa ikkala promptdan (Ad Creative, Story) FARQLI matn qaytaradi", () => {
    const { buildPremiumShowcasePrompt, buildInstagramAdPrompt, buildStoryAdPrompt } = loadModule();
    const showcase = buildPremiumShowcasePrompt({ productName: "Krem" });
    expect(showcase).not.toBe(buildInstagramAdPrompt({ productName: "Krem" }));
    expect(showcase).not.toBe(buildStoryAdPrompt({ productName: "Krem" }));
  });
});

describe("generateProductShowcaseImage", () => {
  test("manba rasm berilmasa, xato tashlaydi (Gemini'ga umuman murojaat qilinmaydi)", async () => {
    const generateContentMock = jest.fn();
    const { generateProductShowcaseImage } = loadModule({ generateContentMock });
    await expect(generateProductShowcaseImage({ imageBase64: null, imageMimeType: null })).rejects.toThrow();
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  test("Gemini rasm qaytarsa, base64 va mimeType'ni to'g'ri ajratadi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({
      candidates: [{ content: { parts: [{ inlineData: { data: "c2hvd2Nhc2U=", mimeType: "image/png" } }] } }],
    });
    const { generateProductShowcaseImage } = loadModule({ generateContentMock });
    const result = await generateProductShowcaseImage({
      imageBase64: "c291cmNlLWJ5dGVz",
      imageMimeType: "image/jpeg",
      productName: "Krem",
      category: "Yuz parvarishi",
    });
    expect(result).toEqual({ imageBase64: "c2hvd2Nhc2U=", mimeType: "image/png" });
    const call = generateContentMock.mock.calls[0][0];
    expect(call.contents[0].parts[0].text).toMatch(/premium|luxury/i);
  });

  test("Gemini javobida rasm qismi bo'lmasa, xato tashlaydi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "Kechirasiz, rasm yarata olmadim." }] } }],
    });
    const { generateProductShowcaseImage } = loadModule({ generateContentMock });
    await expect(
      generateProductShowcaseImage({ imageBase64: "c291cmNl", imageMimeType: "image/jpeg", productName: "Krem" })
    ).rejects.toThrow("AI rasm qaytarmadi.");
  });
});

describe("generateProductAdImage", () => {
  test("manba rasm berilmasa, xato tashlaydi (Gemini'ga umuman murojaat qilinmaydi)", async () => {
    const generateContentMock = jest.fn();
    const { generateProductAdImage } = loadModule({ generateContentMock });
    await expect(generateProductAdImage({ imageBase64: null, imageMimeType: null })).rejects.toThrow();
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  test("Gemini rasm qaytarsa, base64 va mimeType'ni to'g'ri ajratadi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ inlineData: { data: "ZmFrZS1pbWFnZS1ieXRlcw==", mimeType: "image/png" } }],
          },
        },
      ],
    });
    const { generateProductAdImage } = loadModule({ generateContentMock });
    const result = await generateProductAdImage({
      imageBase64: "c291cmNlLWJ5dGVz",
      imageMimeType: "image/jpeg",
      productName: "Krem",
      category: "Yuz parvarishi",
    });
    expect(result).toEqual({ imageBase64: "ZmFrZS1pbWFnZS1ieXRlcw==", mimeType: "image/png" });
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  test("Gemini javobida rasm qismi bo'lmasa, xato tashlaydi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "Kechirasiz, rasm yarata olmadim." }] } }],
    });
    const { generateProductAdImage } = loadModule({ generateContentMock });
    await expect(
      generateProductAdImage({ imageBase64: "c291cmNl", imageMimeType: "image/jpeg", productName: "Krem" })
    ).rejects.toThrow("AI rasm qaytarmadi.");
  });

  test("Gemini chaqiruvi mumkin bo'lgan formatda (model, config.responseModalities) chaqiriladi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({
      candidates: [{ content: { parts: [{ inlineData: { data: "YWJj", mimeType: "image/png" } }] } }],
    });
    const { generateProductAdImage, AD_IMAGE_MODEL } = loadModule({ generateContentMock });
    await generateProductAdImage({ imageBase64: "c291cmNl", imageMimeType: "image/jpeg" });
    const call = generateContentMock.mock.calls[0][0];
    expect(call.model).toBe(AD_IMAGE_MODEL);
    expect(call.config.responseModalities).toEqual(["IMAGE"]);
  });
});

describe("isGeminiRateLimitError", () => {
  // 2026-09, Sentry orqali production'da ANIQLANGAN haqiqiy holat:
  // Gemini API'ning `ApiError` klassi (`@google/genai` SDK) HTTP
  // status kodini `.status` maydonida saqlaydi.
  test("`.status === 429` bo'lsa - true qaytaradi", () => {
    const { isGeminiRateLimitError } = loadModule();
    const err = Object.assign(new Error('{"error":{"code":429}}'), { status: 429 });
    expect(isGeminiRateLimitError(err)).toBe(true);
  });

  test("boshqa status kodlari (masalan 500) uchun - false qaytaradi", () => {
    const { isGeminiRateLimitError } = loadModule();
    const err = Object.assign(new Error("server error"), { status: 500 });
    expect(isGeminiRateLimitError(err)).toBe(false);
  });

  test("`.status` umuman bo'lmagan oddiy xato uchun - false qaytaradi (xato tashlamaydi)", () => {
    const { isGeminiRateLimitError } = loadModule();
    expect(isGeminiRateLimitError(new Error("AI rasm qaytarmadi."))).toBe(false);
    expect(isGeminiRateLimitError(null)).toBe(false);
    expect(isGeminiRateLimitError(undefined)).toBe(false);
  });
});
