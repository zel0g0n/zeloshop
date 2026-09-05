/**
 * `lib/categoryCustomization.js` - sotuvchi yashirgan/qo'shgan
 * kategoriyalarning AI qoralama promptiga ta'siri (band #20 - custom
 * kategoriya boshqaruvi, AI xabardorligi qismi).
 */
const { getEffectiveCategoryNamesForSeller } = require("../lib/categoryCustomization");

const BASE = ["Yuz parvarishi", "Dekorativ kosmetika", "Parfyumeriya"];

describe("getEffectiveCategoryNamesForSeller", () => {
  test("customization berilmasa - bazaviy ro'yxat o'zgarishsiz qaytadi", () => {
    expect(getEffectiveCategoryNamesForSeller(BASE, null)).toEqual(BASE);
    expect(getEffectiveCategoryNamesForSeller(BASE, undefined)).toEqual(BASE);
    expect(getEffectiveCategoryNamesForSeller(BASE, {})).toEqual(BASE);
  });

  test("bazaviy ro'yxat massiv bo'lmasa - xato bermaydi, bo'sh ro'yxat qaytaradi", () => {
    expect(getEffectiveCategoryNamesForSeller(null, {})).toEqual([]);
    expect(getEffectiveCategoryNamesForSeller(undefined, {})).toEqual([]);
  });

  test("MUHIM: sotuvchi YASHIRGAN kategoriya AI ro'yxatidan chetlatiladi", () => {
    const result = getEffectiveCategoryNamesForSeller(BASE, { hiddenValues: ["Parfyumeriya"] });
    expect(result).not.toContain("Parfyumeriya");
    expect(result).toEqual(["Yuz parvarishi", "Dekorativ kosmetika"]);
  });

  test("MUHIM: sotuvchi QO'SHGAN custom kategoriya ({value,label} shaklida) AI ro'yxatiga QO'SHILADI", () => {
    const result = getEffectiveCategoryNamesForSeller(BASE, { customCategories: [{ value: "Luxury Skincare", label: "Luxury Skincare" }] });
    expect(result).toContain("Luxury Skincare");
    expect(result).toEqual([...BASE, "Luxury Skincare"]);
  });

  test("custom kategoriya oddiy satr (string) shaklida ham qo'llab-quvvatlanadi", () => {
    const result = getEffectiveCategoryNamesForSeller(BASE, { customCategories: ["Organik kosmetika"] });
    expect(result).toContain("Organik kosmetika");
  });

  test("bazaviy ro'yxatda ALLAQACHON mavjud nomni custom sifatida qo'shsa - TAKRORLANMAYDI", () => {
    const result = getEffectiveCategoryNamesForSeller(BASE, { customCategories: [{ value: "Yuz parvarishi", label: "Yuz parvarishi" }] });
    expect(result.filter((n) => n === "Yuz parvarishi")).toHaveLength(1);
  });

  test("yashirish VA custom qo'shish BIR VAQTDA to'g'ri ishlaydi", () => {
    const result = getEffectiveCategoryNamesForSeller(BASE, {
      hiddenValues: ["Dekorativ kosmetika"],
      customCategories: [{ value: "Luxury Skincare" }],
    });
    expect(result).toEqual(["Yuz parvarishi", "Parfyumeriya", "Luxury Skincare"]);
  });
});

describe("15-NICHE: processDraft AI PROMPTI custom/yashirilgan kategoriyalardan XABARDOR (uchdan-uchga)", () => {
  function loadProductDraftsModule() {
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

  test("sotuvchi QO'SHGAN custom kategoriya ('Luxury Skincare') buildDraftPrompt orqali AI promptida ko'rinadi", () => {
    const { _testables } = loadProductDraftsModule();
    const { getNicheConfig } = require("../lib/niches");
    const { getEffectiveCategoryNamesForSeller } = require("../lib/categoryCustomization");

    const baseNicheConfig = getNicheConfig("Kosmetika");
    const effectiveCategories = getEffectiveCategoryNamesForSeller(baseNicheConfig.categories, {
      customCategories: [{ value: "Luxury Skincare", label: "Luxury Skincare" }],
    });
    const prompt = _testables.buildDraftPrompt("qimmatbaho krem", false, { ...baseNicheConfig, categories: effectiveCategories });

    expect(prompt).toContain("Luxury Skincare");
  });

  test("sotuvchi YASHIRGAN kategoriya buildDraftPrompt orqali AI promptida UMUMAN ko'rinmaydi", () => {
    const { _testables } = loadProductDraftsModule();
    const { getNicheConfig } = require("../lib/niches");
    const { getEffectiveCategoryNamesForSeller } = require("../lib/categoryCustomization");

    const baseNicheConfig = getNicheConfig("Kosmetika");
    const effectiveCategories = getEffectiveCategoryNamesForSeller(baseNicheConfig.categories, {
      hiddenValues: ["Parfyumeriya"],
    });
    const prompt = _testables.buildDraftPrompt("qimmatbaho krem", false, { ...baseNicheConfig, categories: effectiveCategories });

    expect(prompt).not.toContain("- Parfyumeriya");
  });
});
