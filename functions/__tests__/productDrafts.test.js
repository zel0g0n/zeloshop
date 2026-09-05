/**
 * `productDrafts.js`dagi SOF funksiyalar uchun testlar.
 *
 * ASOSIY MAQSAD: `parseDraftResponse` - Gemini matn javobini
 * ishonchli ajratib olishi SHART, chunki bu, mahsulot tavsifi VA
 * kategoriyasi to'g'ri saqlanishining yagona kafolati.
 */

function loadModule() {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: { firestore: { FieldValue: { serverTimestamp: () => "MOCK_TS" } } },
    db: {},
    BOT_TOKEN: { value: () => "mock-bot-token" },
    GEMINI_API_KEY: { value: () => "mock-gemini-key" },
  }));
  jest.doMock("../lib/helpers", () => ({ sendTelegramMessage: jest.fn() }));
  jest.doMock("@google/genai", () => ({ GoogleGenAI: jest.fn() }));
  return require("../productDrafts");
}

describe("parseDraftResponse", () => {
  test("standart formatdagi javobni to'g'ri ajratadi", () => {
    const { _testables } = loadModule();
    const raw = "TAVSIF: Yumshoq va nam beruvchi krem, teringizga g'amxo'rlik qiladi.\nKATEGORIYA: Skincare";
    const result = _testables.parseDraftResponse(raw);
    expect(result.description).toBe("Yumshoq va nam beruvchi krem, teringizga g'amxo'rlik qiladi.");
    expect(result.category).toBe("Skincare");
  });

  test("tavsifda bir necha qator bo'lsa ham to'g'ri ajratadi", () => {
    const { _testables } = loadModule();
    const raw = "TAVSIF: Birinchi qator.\nIkkinchi qator davomi.\nKATEGORIYA: Makeup";
    const result = _testables.parseDraftResponse(raw);
    expect(result.description).toBe("Birinchi qator.\nIkkinchi qator davomi.");
    expect(result.category).toBe("Makeup");
  });

  test("KATEGORIYA qatori umuman bo'lmasa, category null bo'ladi (xato bermaydi)", () => {
    const { _testables } = loadModule();
    const raw = "TAVSIF: Faqat tavsif, kategoriyasiz.";
    const result = _testables.parseDraftResponse(raw);
    expect(result.description).toBe("Faqat tavsif, kategoriyasiz.");
    expect(result.category).toBeNull();
  });

  test("format UMUMAN mos kelmasa (Gemini kutilmagan javob bersa), butun matnni tavsif sifatida qabul qiladi", () => {
    const { _testables } = loadModule();
    const raw = "Bu yerda hech qanday belgilangan format yo'q, oddiy matn.";
    const result = _testables.parseDraftResponse(raw);
    expect(result.description).toBe(raw);
    expect(result.category).toBeNull();
  });

  test("NOM qatorini to'g'ri ajratadi (mahsulot nomi AI tomonidan yaratiladi)", () => {
    const { _testables } = loadModule();
    const raw = "NOM: Qora rangli teri krem, 50ml\nTAVSIF: Yumshoq krem.\nKATEGORIYA: Skincare";
    const result = _testables.parseDraftResponse(raw);
    expect(result.name).toBe("Qora rangli teri krem, 50ml");
    expect(result.description).toBe("Yumshoq krem.");
    expect(result.category).toBe("Skincare");
  });

  test("NOM qatori bo'lmasa, name null bo'ladi (xato bermaydi)", () => {
    const { _testables } = loadModule();
    const raw = "TAVSIF: Faqat tavsif.\nKATEGORIYA: Makeup";
    const result = _testables.parseDraftResponse(raw);
    expect(result.name).toBeNull();
  });
});

describe("buildDraftPrompt", () => {
  test("sotuvchi izohini promptga to'g'ri kiritadi", () => {
    const { _testables } = loadModule();
    const prompt = _testables.buildDraftPrompt("qora rangli krem, 50ml", true);
    expect(prompt).toContain("qora rangli krem, 50ml");
    expect(prompt).toContain("TAVSIF:");
    expect(prompt).toContain("KATEGORIYA:");
    expect(prompt).toContain("NOM:");
  });

  test("izoh BO'SH bo'lsa ham (faqat rasm), xato bermaydi va rasmga tayanishni SO'RAYDI", () => {
    const { _testables } = loadModule();
    const prompt = _testables.buildDraftPrompt("", true);
    expect(prompt).toContain("FAQAT rasmga qarab");
  });

  test("narx haqida HECH QANDAY so'rov YO'Q (AI narx taklif qilmasligi kerak)", () => {
    const { _testables } = loadModule();
    const prompt = _testables.buildDraftPrompt("test mahsulot", false);
    expect(prompt.toLowerCase()).not.toContain("narx");
  });

  test("standart (Kosmetika) niche uchun kosmetika kategoriyalari ko'rsatiladi", () => {
    const { _testables } = loadModule();
    const prompt = _testables.buildDraftPrompt("test", false);
    expect(prompt).toContain("Yuz parvarishi");
  });

  test("15-NICHE: boshqa niche berilsa, o'sha niche'ning HAQIQIY kategoriyalari ishlatiladi (Kosmetika emas)", () => {
    const { getNicheConfig } = require("../lib/niches");
    const { _testables } = loadModule();
    const prompt = _testables.buildDraftPrompt("iPhone 15 Pro, 256GB", true, getNicheConfig("Elektronika"));
    expect(prompt).toContain("Smartfonlar");
    expect(prompt).not.toContain("Yuz parvarishi");
  });

  test("niche'ning aiExtractable atributlari uchun ATRIBUTLAR bo'limi qo'shiladi", () => {
    const { getNicheConfig } = require("../lib/niches");
    const { _testables } = loadModule();
    const prompt = _testables.buildDraftPrompt("iPhone 15 Pro, 256GB", true, getNicheConfig("Elektronika"));
    expect(prompt).toContain("ATRIBUTLAR:");
    expect(prompt).toContain('"storage"');
    expect(prompt).toContain('"brand"');
  });

  test("aiExtractable:false atributlar (masalan warranty, compatibility) PROMPTGA UMUMAN qo'shilmaydi", () => {
    const { getNicheConfig } = require("../lib/niches");
    const { _testables } = loadModule();
    const prompt = _testables.buildDraftPrompt("iPhone 15 Pro, 256GB", true, getNicheConfig("Elektronika"));
    expect(prompt).not.toContain('"warranty"');
    expect(prompt).not.toContain('"connectivity"');
  });

  test("MUHIM QOIDA (Avto ehtiyot qismlari - compatibilityStrict): 'compatibility' atributi AI'dan HECH QACHON so'ralmaydi", () => {
    const { getNicheConfig } = require("../lib/niches");
    const { _testables } = loadModule();
    const prompt = _testables.buildDraftPrompt("tormoz kolodkasi", false, getNicheConfig("Avto ehtiyot qismlari"));
    expect(prompt).not.toContain('"compatibility"');
    expect(prompt).not.toContain('"carBrand"');
    expect(prompt).not.toContain('"oemNumber"');
  });

  test("bironta ham aiExtractable atributi yo'q holatda (masalan hech narsa mos kelmasa) ATRIBUTLAR bo'limi umuman qo'shilmaydi", () => {
    const { _testables } = loadModule();
    // "Boshqa" (fallback) niche - brand/color/material barchasi aiExtractable:true,
    // shuning uchun buning o'rniga qo'lda, faqat aiExtractable:false atributlardan
    // iborat sun'iy niche obyekti bilan tekshiramiz.
    const prompt = _testables.buildDraftPrompt("test", false, {
      id: "Test",
      categories: ["Boshqa"],
      attributeKeys: ["warranty", "ingredients"],
      aiContext: "Test do'kon.",
    });
    expect(prompt).not.toContain("ATRIBUTLAR:");
  });
});

describe("parseDraftResponse - ATRIBUTLAR (15-NICHE atribut ekstraksiyasi)", () => {
  test("to'g'ri JSON formatidagi ATRIBUTLARni ajratadi", () => {
    const { _testables } = loadModule();
    const raw = 'TAVSIF: Yaxshi telefon.\nKATEGORIYA: Smartfonlar\nATRIBUTLAR: {"brand": "Apple", "storage": "256GB"}';
    const result = _testables.parseDraftResponse(raw);
    expect(result.category).toBe("Smartfonlar");
    expect(result.rawAttributes).toEqual({ brand: "Apple", storage: "256GB" });
  });

  test("ATRIBUTLAR qatori umuman bo'lmasa, rawAttributes bo'sh obyekt bo'ladi (xato bermaydi)", () => {
    const { _testables } = loadModule();
    const raw = "TAVSIF: Faqat tavsif.\nKATEGORIYA: Smartfonlar";
    const result = _testables.parseDraftResponse(raw);
    expect(result.rawAttributes).toEqual({});
  });

  test("ATRIBUTLAR JSON BUZILGAN bo'lsa (Gemini noto'g'ri format qaytarsa), xato bermaydi - bo'sh obyekt", () => {
    const { _testables } = loadModule();
    const raw = "TAVSIF: Test.\nKATEGORIYA: Smartfonlar\nATRIBUTLAR: {bu JSON emas}";
    const result = _testables.parseDraftResponse(raw);
    expect(result.rawAttributes).toEqual({});
    // qolgan maydonlar baribir to'g'ri ajratilishi kerak:
    expect(result.category).toBe("Smartfonlar");
  });

  test("ATRIBUTLAR bo'sh obyekt {} bo'lsa ham to'g'ri o'qiladi", () => {
    const { _testables } = loadModule();
    const raw = "TAVSIF: Test.\nKATEGORIYA: Smartfonlar\nATRIBUTLAR: {}";
    const result = _testables.parseDraftResponse(raw);
    expect(result.rawAttributes).toEqual({});
  });
});

describe("validateExtractedAttributes (AI hech qachon mavjud bo'lmagan xususiyatni o'ylab topmasin - YAKUNIY DARVOZA)", () => {
  test("niche sxemasida BOR va aiExtractable:true bo'lgan qiymatlarni saqlaydi", () => {
    const { _testables } = loadModule();
    const result = _testables.validateExtractedAttributes({ brand: "Apple", storage: "256GB" }, "Elektronika");
    expect(result).toEqual({ brand: "Apple", storage: "256GB" });
  });

  test("niche'ning attributeKeys ro'yxatida UMUMAN YO'Q kalitni rad etadi (boshqa sohadan sizib kirgan/o'ylab topilgan)", () => {
    const { _testables } = loadModule();
    // "ingredients" Elektronika'ning attributeKeys ro'yxatida yo'q (Kosmetika'niki):
    const result = _testables.validateExtractedAttributes({ brand: "Apple", ingredients: "aloe vera" }, "Elektronika");
    expect(result).toEqual({ brand: "Apple" });
    expect(result.ingredients).toBeUndefined();
  });

  test("MUHIM: aiExtractable:false bo'lgan kalitni AI 'topib bergan' bo'lsa ham, baribir rad etadi", () => {
    const { _testables } = loadModule();
    // "compatibility" Avto ehtiyot qismlari attributeKeys ro'yxatida BOR,
    // lekin aiExtractable:false - promptda so'ralmagan, lekin AI baribir
    // o'zidan qo'shib yuborgan taqdirda ham rad etilishi SHART:
    const result = _testables.validateExtractedAttributes(
      { brand: "Bosch", compatibility: "Chevrolet Nexia 2015-2020", oemNumber: "12345" },
      "Avto ehtiyot qismlari"
    );
    expect(result).toEqual({ brand: "Bosch" });
    expect(result.compatibility).toBeUndefined();
    expect(result.oemNumber).toBeUndefined();
  });

  test("'select' turi uchun ro'yxatda YO'Q qiymatni rad etadi (AI o'zidan yangi variant o'ylab topolmaydi)", () => {
    const { _testables } = loadModule();
    const result = _testables.validateExtractedAttributes({ skinType: "gibrid" }, "Kosmetika");
    expect(result.skinType).toBeUndefined();
  });

  test("'select' turi uchun ro'yxatda BOR qiymatni saqlaydi", () => {
    const { _testables } = loadModule();
    const result = _testables.validateExtractedAttributes({ skinType: "oily" }, "Kosmetika");
    expect(result.skinType).toBe("oily");
  });

  test("'number' turi uchun haqiqiy songa aylantiradi, son bo'lmasa rad etadi", () => {
    const { _testables } = loadModule();
    const valid = _testables.validateExtractedAttributes({ spf: "50" }, "Kosmetika");
    expect(valid.spf).toBe(50);
    const invalid = _testables.validateExtractedAttributes({ spf: "juda yuqori" }, "Kosmetika");
    expect(invalid.spf).toBeUndefined();
  });

  test("bo'sh yoki null qiymatlarni tashlab ketadi", () => {
    const { _testables } = loadModule();
    const result = _testables.validateExtractedAttributes({ brand: "", color: null, material: "paxta" }, "Kiyim-kechak");
    expect(result).toEqual({ material: "paxta" });
  });

  test("rawAttributes UMUMAN obyekt bo'lmasa (masalan undefined), bo'sh obyekt qaytaradi", () => {
    const { _testables } = loadModule();
    expect(_testables.validateExtractedAttributes(undefined, "Kosmetika")).toEqual({});
    expect(_testables.validateExtractedAttributes(null, "Kosmetika")).toEqual({});
  });
});
