/**
 * 15 TA NICHE UCHUN ALOHIDA, REALISTIK MAHSULOT STSENARIYLARI
 * (to'liq end-to-end: AI qoralama prompti -> atribut ekstraksiyasi
 * validatsiyasi -> AI tavsif prompti -> AI ijtimoiy tarmoq posti
 * prompti).
 *
 * FARQI `niches.test.js`dan: o'sha fayl niche KONFIGURATSIYASINING
 * O'ZI to'g'ri tuzilganini (struktura, invariantlar) tekshiradi.
 * BU FAYL esa HAR BIR 15 ta niche uchun BITTA ALOHIDA, REALISTIK
 * mahsulot (masalan "Nam beruvchi yuz kremi, 50ml" - Kosmetika,
 * "Tormoz kolodkasi" - Avto ehtiyot qismlari) orqali, o'sha niche
 * uchun BUTUN AI oqimini (`productDrafts.js` + `products.js`dagi sof
 * funksiyalar) uchdan-uchga sinovdan o'tkazadi - foydalanuvchi aniq
 * so'ragan "har bir niche uchun alohida realistik stsenariy" talabini
 * bajaradi.
 *
 * Har bir stsenariyda ALOHIDA tekshiriladi:
 *   1) `buildDraftPrompt` - o'sha niche'ning HAQIQIY kategoriyalar
 *      ro'yxati va AI konteksti promptga kiritilganini.
 *   2) `validateExtractedAttributes` - AI "topib bergan" REALISTIK
 *      atributlardan faqat `aiExtractable:true` bo'lganlari
 *      saqlanishini, "to'qilishi xavfli" (aiExtractable:false)
 *      atribut esa (garchi o'sha niche'ning ANIQ ro'yxatida bo'lsa
 *      ham) rad etilishini.
 *   3) `buildDescriptionPrompt` - mahsulot nomi/kategoriyasi to'g'ri
 *      kiritilganini.
 *   4) `buildSocialPostPrompt` - o'sha niche'ning AI konteksti
 *      ijtimoiy tarmoq post promptiga kiritilganini.
 */

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

function loadProductsModule() {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    db: { collection: () => ({ doc: () => ({ get: async () => ({ exists: false }) }) }) },
    GEMINI_API_KEY: { value: () => "mock-gemini-key" },
  }));
  jest.doMock("@google/genai", () => ({ GoogleGenAI: jest.fn() }));
  return require("../products");
}

const { getNicheConfig } = require("../lib/niches");

// Har bir niche uchun BITTA REALISTIK mahsulot: haqiqiy kategoriya,
// AI "topishi mumkin bo'lgan" (aiExtractable:true) atribut VA shu
// niche'ning ro'yxatida bor, lekin AI HECH QACHON o'ylab topmasligi
// kerak bo'lgan (aiExtractable:false) "xavfli" atribut.
const NICHE_SCENARIOS = [
  {
    nicheId: "Kosmetika",
    productName: "Nam beruvchi yuz kremi, 50ml",
    category: "Yuz parvarishi",
    validKey: "skinType", validValue: "oily", expectedValid: "oily",
    fabricatedKey: "ingredients", fabricatedValue: "aloe vera, retinol, gialuron kislotasi",
  },
  {
    nicheId: "Kiyim-kechak",
    productName: "Ayollar yozgi ko'ylagi",
    category: "Ko'ylaklar",
    validKey: "size", validValue: "M", expectedValid: "M",
    fabricatedKey: "collection", fabricatedValue: "Yoz 2026 kolleksiyasi",
  },
  {
    nicheId: "Poyabzal",
    productName: "Erkaklar sport krossovkasi",
    category: "Krossovkalar",
    validKey: "color", validValue: "qora", expectedValid: "qora",
    fabricatedKey: "soleType", fabricatedValue: "rezina, kauchuk",
  },
  {
    nicheId: "Uy-ro'zg'or buyumlari",
    productName: "Yog'och oshxona stoli",
    category: "Mebel",
    validKey: "material", validValue: "yog'och", expectedValid: "yog'och",
    fabricatedKey: "dimensions", fabricatedValue: "120x60x75 sm",
  },
  {
    nicheId: "Elektronika",
    productName: "Smartfon Model X Pro, 256GB",
    category: "Smartfonlar",
    validKey: "storage", validValue: "256GB", expectedValid: "256GB",
    fabricatedKey: "compatibility", fabricatedValue: "faqat X markali zaryadlagichlar bilan mos",
  },
  {
    nicheId: "Bolalar tovarlari",
    productName: "Bolalar uchun o'yinchoq mashina",
    category: "O'yinchoqlar",
    validKey: "color", validValue: "qizil", expectedValid: "qizil",
    fabricatedKey: "safetyInfo", fabricatedValue: "3 yoshdan katta bolalar uchun xavfsiz",
  },
  {
    nicheId: "Zargarlik va aksessuarlar",
    productName: "Kumush ayol uzugi",
    category: "Uzuklar",
    validKey: "metal", validValue: "kumush", expectedValid: "kumush",
    fabricatedKey: "collection", fabricatedValue: "Bahor 2026 kolleksiyasi",
  },
  {
    nicheId: "Suvenir mahsulotlar",
    productName: "Tug'ilgan kun sovg'a to'plami",
    category: "Tug'ilgan kun sovg'alari",
    validKey: "occasion", validValue: "tug'ilgan kun", expectedValid: "tug'ilgan kun",
    fabricatedKey: "personalization", fabricatedValue: "yes",
  },
  {
    nicheId: "Uy hayvonlari tovarlari",
    productName: "It uchun charm bo'yinbog'",
    category: "It uchun",
    validKey: "animalType", validValue: "it", expectedValid: "it",
    fabricatedKey: "breed", fabricatedValue: "labrador uchun mos",
  },
  {
    nicheId: "Sport va faollik",
    productName: "Yugurish uchun sport shim",
    category: "Yugurish",
    validKey: "sport", validValue: "yugurish", expectedValid: "yugurish",
    fabricatedKey: "skillLevel", fabricatedValue: "beginner",
  },
  {
    nicheId: "Kitoblar",
    productName: "\"Sarguzasht\" romani",
    category: "Kitoblar",
    validKey: "genre", validValue: "sarguzasht", expectedValid: "sarguzasht",
    fabricatedKey: "isbn", fabricatedValue: "978-3-16-148410-0",
  },
  {
    nicheId: "Avto ehtiyot qismlari",
    productName: "Old tormoz kolodkasi",
    category: "Tormozlar",
    validKey: "brand", validValue: "Bosch", expectedValid: "Bosch",
    fabricatedKey: "compatibility", fabricatedValue: "Chevrolet Nexia, Cobalt uchun mos",
  },
  {
    nicheId: "Asboblar va qurilish",
    productName: "Elektr drel, 800W",
    category: "Elektr asboblar",
    validKey: "power", validValue: "800W", expectedValid: "800W",
    fabricatedKey: "warranty", fabricatedValue: "1 yil rasmiy kafolat",
  },
  {
    nicheId: "Sumka va charm buyumlar",
    productName: "Ayollar charm qo'l sumkasi",
    category: "Qo'l sumkalari",
    validKey: "material", validValue: "charm", expectedValid: "charm",
    fabricatedKey: "compartments", fabricatedValue: 3,
  },
  {
    nicheId: "O'yinchoqlar va xobbi",
    productName: "Lego konstruktor to'plami",
    category: "Konstruktorlar",
    validKey: "brand", validValue: "Lego", expectedValid: "Lego",
    fabricatedKey: "numberOfPieces", fabricatedValue: 500,
  },
];

describe("15-NICHE UNIVERSAL PLATFORMA: har bir niche uchun REALISTIK mahsulot stsenariysi (to'liq AI oqimi)", () => {
  test("MUHIM: bu ro'yxat ANIQ 15 ta niche'ni qamrab oladi (hech biri tashlab ketilmagan)", () => {
    expect(NICHE_SCENARIOS).toHaveLength(15);
    expect(new Set(NICHE_SCENARIOS.map((s) => s.nicheId)).size).toBe(15);
  });

  describe.each(NICHE_SCENARIOS)(
    "$nicheId: \"$productName\"",
    ({ nicheId, productName, category, validKey, validValue, expectedValid, fabricatedKey, fabricatedValue }) => {
      test("1) AI QORALAMA PROMPTI: niche'ning HAQIQIY kategoriyasi va AI konteksti promptga kiritiladi", () => {
        const { _testables } = loadProductDraftsModule();
        const nicheConfig = getNicheConfig(nicheId);
        const prompt = _testables.buildDraftPrompt(productName, false, nicheConfig);
        expect(prompt).toContain(category);
        expect(prompt).toContain(nicheConfig.aiContext);
      });

      test("2) ATRIBUT VALIDATSIYASI: haqiqiy (aiExtractable:true) atribut SAQLANADI, 'xavfli' (aiExtractable:false) atribut - o'sha niche ro'yxatida bo'lsa ham - RAD ETILADI", () => {
        const { _testables } = loadProductDraftsModule();
        const rawAttributes = { [validKey]: validValue, [fabricatedKey]: fabricatedValue };
        const result = _testables.validateExtractedAttributes(rawAttributes, nicheId);

        expect(result[validKey]).toBe(expectedValid);
        expect(result[fabricatedKey]).toBeUndefined();
      });

      test("3) AI TAVSIF PROMPTI: mahsulot nomi va kategoriyasi to'g'ri kiritiladi", () => {
        const { _testables } = loadProductsModule();
        const prompt = _testables.buildDescriptionPrompt(productName, category, false);
        expect(prompt).toContain(productName);
        expect(prompt).toContain(category);
      });

      test("4) AI IJTIMOIY TARMOQ POSTI PROMPTI: niche'ga mos SMM konteksti kiritiladi (umumiy 'kichik onlayn do'kon' EMAS)", () => {
        const { _testables } = loadProductsModule();
        const nicheConfig = getNicheConfig(nicheId);
        const prompt = _testables.buildSocialPostPrompt(productName, null, null, "Instagram uchun", nicheId);
        expect(prompt).toContain(nicheConfig.aiContext);
        expect(prompt).toContain(productName);
      });
    }
  );
});
