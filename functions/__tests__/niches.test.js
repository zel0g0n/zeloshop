/**
 * `lib/niches.js` va `lib/attributeDictionary.js` — 15-NICHE UNIVERSAL
 * PLATFORMANING asosiy konfiguratsiyasi. Bu testlar ULARNING O'ZINI
 * (Gemini yoki Firestore'ga bog'liq bo'lmagan sof ma'lumot) tekshiradi -
 * har qanday kelajakdagi tahrir (yangi niche/atribut qo'shish) ushbu
 * invariantlarni buzmasligini kafolatlaydi.
 */
const { NICHES, NICHE_IDS, OTHER_NICHE, getNicheConfig, getCategoriesForNiche } = require("../lib/niches");
const { getAttributeDefinition, ATTRIBUTE_DICTIONARY } = require("../lib/attributeDictionary");

describe("15 ta niche konfiguratsiyasi", () => {
  test("ANIQ 15 ta niche mavjud", () => {
    expect(NICHES).toHaveLength(15);
    expect(NICHE_IDS).toHaveLength(15);
  });

  test("har bir niche ID takrorlanmaydi (bir xil ID ikki marta yo'q)", () => {
    expect(new Set(NICHE_IDS).size).toBe(NICHE_IDS.length);
  });

  test("har bir niche kamida bitta kategoriyaga ega", () => {
    NICHES.forEach((n) => expect(n.categories.length).toBeGreaterThan(0));
  });

  test("har bir niche kamida bitta atributga ega", () => {
    NICHES.forEach((n) => expect(n.attributeKeys.length).toBeGreaterThan(0));
  });

  test("har bir niche AI konteksti (aiContext) yozilgan bo'lishi shart", () => {
    NICHES.forEach((n) => {
      expect(typeof n.aiContext).toBe("string");
      expect(n.aiContext.length).toBeGreaterThan(10);
    });
  });

  test("MUHIM: har bir niche'ning HAR BIR attributeKey'i haqiqatan ATTRIBUTE_DICTIONARY'da mavjud (aks holda AI ekstraksiya/validatsiya jim ravishda hech narsa qilmay qoladi)", () => {
    const unresolved = [];
    NICHES.forEach((n) => {
      n.attributeKeys.forEach((key) => {
        if (!getAttributeDefinition(key)) unresolved.push(`${n.id}:${key}`);
      });
    });
    expect(unresolved).toEqual([]);
  });

  test("'Kosmetika' (eski, mavjud sotuvchilarning standart sohasi) HALI HAM ro'yxatda va o'zgarmagan asosiy kategoriyalarga ega", () => {
    const kosmetika = getNicheConfig("Kosmetika");
    expect(kosmetika.categories).toContain("Yuz parvarishi");
    expect(kosmetika.categories).toContain("Dekorativ kosmetika");
  });

  test("'Avto ehtiyot qismlari' - compatibilityStrict:true bayrog'iga ega VA 'compatibility' atributi aiExtractable:false", () => {
    const auto = getNicheConfig("Avto ehtiyot qismlari");
    expect(auto.compatibilityStrict).toBe(true);
    expect(auto.attributeKeys).toContain("compatibility");
    expect(getAttributeDefinition("compatibility").aiExtractable).toBe(false);
  });

  test("getNicheConfig - noto'g'ri/mavjud bo'lmagan ID uchun xavfsiz 'Boshqa' zaxirasini qaytaradi (hech qachon xato/undefined bermaydi)", () => {
    expect(getNicheConfig("mavjud-bolmagan-niche")).toEqual(OTHER_NICHE);
    expect(getNicheConfig(undefined)).toEqual(OTHER_NICHE);
    expect(getNicheConfig(null)).toEqual(OTHER_NICHE);
  });

  test("getCategoriesForNiche - to'g'ridan-to'g'ri kategoriyalar massivini qaytaradi", () => {
    expect(getCategoriesForNiche("Elektronika")).toContain("Smartfonlar");
  });
});

describe("ATTRIBUTE_DICTIONARY (aiExtractable xavfsizlik bayrog'i)", () => {
  test("'select' turidagi HAR BIR atribut kamida bitta variantga ega", () => {
    Object.entries(ATTRIBUTE_DICTIONARY).forEach(([_key, def]) => {
      if (def.type === "select") expect(def.options && def.options.length).toBeGreaterThan(0);
    });
  });

  test("MUHIM: xavfli/tekshirib bo'lmaydigan atributlar (tarkib, moslik, kafolat, xavfsizlik, OEM) aiExtractable:false", () => {
    ["ingredients", "compatibility", "warranty", "safetyInfo", "oemNumber", "isbn", "carBrand", "carModel"].forEach((key) => {
      expect(getAttributeDefinition(key).aiExtractable).toBe(false);
    });
  });
});
