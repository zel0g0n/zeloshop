const { formatAttributeEntry, formatAttributesLine } = require("../lib/attributeLabels");

describe("formatAttributeEntry", () => {
  test("oddiy matn turidagi atribut uchun 'Yorliq: Qiymat' qaytaradi", () => {
    expect(formatAttributeEntry("brand", "Xolio Cosmetics")).toBe("Brend: Xolio Cosmetics");
  });

  test("'select' turidagi atribut uchun QIYMATNI HAM o'zbekchaga tarjima qiladi", () => {
    expect(formatAttributeEntry("gender", "women")).toBe("Jins: Ayol");
    expect(formatAttributeEntry("skinType", "all")).toBe("Teri turi: Barcha turlar");
  });

  test("lug'atda yo'q kalit uchun ham xato bermaydi (xavfsiz standart)", () => {
    expect(formatAttributeEntry("someFutureKey", "qiymat")).toBe("SomeFutureKey: qiymat");
  });

  test("'select' turida lug'atda yo'q qiymat uchun XOM qiymatni ko'rsatadi", () => {
    expect(formatAttributeEntry("gender", "robot")).toBe("Jins: robot");
  });
});

describe("formatAttributesLine", () => {
  test("bir nechta atributni ' · ' bilan ajratib, BITTA qatorga jamlaydi", () => {
    const line = formatAttributesLine({ brand: "Xolio Cosmetics", gender: "women", volume: "120gr" });
    expect(line).toBe("Brend: Xolio Cosmetics · Jins: Ayol · Hajm: 120gr");
  });

  test("bo'sh/undefined qiymatlarni o'tkazib yuboradi", () => {
    const line = formatAttributesLine({ brand: "Krem", fragrance: "", spf: null });
    expect(line).toBe("Brend: Krem");
  });

  test("attributes umuman bo'lmasa - bo'sh qator qaytaradi", () => {
    expect(formatAttributesLine(undefined)).toBe("");
    expect(formatAttributesLine(null)).toBe("");
    expect(formatAttributesLine({})).toBe("");
  });

  test("attributes obyekt bo'lmasa (masalan massiv) - xato bermaydi, bo'sh qaytaradi", () => {
    expect(formatAttributesLine("noto'g'ri")).toBe("");
  });
});
