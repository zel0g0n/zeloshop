const { hasWeakDescription, hasNoImage, computeContentQualityIssues, MIN_DESCRIPTION_LENGTH } = require("../lib/contentQuality");

describe("hasWeakDescription", () => {
  test("tavsif umuman yo'q bo'lsa - true", () => {
    expect(hasWeakDescription({})).toBe(true);
    expect(hasWeakDescription({ description: null })).toBe(true);
    expect(hasWeakDescription({ description: "" })).toBe(true);
  });
  test("tavsif chegaradan QISQA bo'lsa - true", () => {
    expect(hasWeakDescription({ description: "a".repeat(MIN_DESCRIPTION_LENGTH - 1) })).toBe(true);
  });
  test("tavsif YETARLICHA uzun bo'lsa - false", () => {
    expect(hasWeakDescription({ description: "a".repeat(MIN_DESCRIPTION_LENGTH) })).toBe(false);
  });
  test("faqat bo'sh joylardan iborat tavsifni HAM 'qisqa' deb hisoblaydi (trim qilingandan keyin)", () => {
    expect(hasWeakDescription({ description: "   " })).toBe(true);
  });
});

describe("hasNoImage", () => {
  test("rasm yo'q bo'lsa - true", () => {
    expect(hasNoImage({})).toBe(true);
    expect(hasNoImage({ image: null })).toBe(true);
    expect(hasNoImage({ image: "" })).toBe(true);
  });
  test("rasm bor bo'lsa - false", () => {
    expect(hasNoImage({ image: "https://example.com/img.jpg" })).toBe(false);
  });
});

describe("computeContentQualityIssues", () => {
  const goodProduct = (id) => ({ id, name: `Yaxshi ${id}`, description: "a".repeat(50), image: "https://example.com/img.jpg" });

  test("hech qanday muammo bo'lmasa - hammasi 0/bo'sh", () => {
    const result = computeContentQualityIssues([goodProduct("p1"), goodProduct("p2")]);
    expect(result).toEqual({
      weakDescriptionCount: 0,
      noImageCount: 0,
      weakDescriptionProducts: [],
      noImageProducts: [],
    });
  });

  test("tavsifi qisqa/yo'q mahsulotlarni to'g'ri topadi va sanaydi", () => {
    const result = computeContentQualityIssues([
      goodProduct("p1"),
      { id: "p2", name: "Qisqa tavsifli", description: "juda qisqa", image: "https://x.com/1.jpg" },
      { id: "p3", name: "Tavsifsiz", image: "https://x.com/2.jpg" },
    ]);
    expect(result.weakDescriptionCount).toBe(2);
    expect(result.weakDescriptionProducts.map((p) => p.id)).toEqual(["p2", "p3"]);
  });

  test("rasmi yo'q mahsulotlarni to'g'ri topadi va sanaydi", () => {
    const result = computeContentQualityIssues([
      goodProduct("p1"),
      { id: "p2", name: "Rasmsiz", description: "a".repeat(50) },
    ]);
    expect(result.noImageCount).toBe(1);
    expect(result.noImageProducts).toEqual([{ id: "p2", name: "Rasmsiz" }]);
  });

  test("NOFAOL (isActive:false) mahsulotlar UMUMAN hisobga olinmaydi", () => {
    const result = computeContentQualityIssues([
      { id: "p1", name: "Nofaol", isActive: false }, // tavsifsiz, rasmsiz - lekin nofaol
    ]);
    expect(result.weakDescriptionCount).toBe(0);
    expect(result.noImageCount).toBe(0);
  });

  test("ro'yxatga chiqariladigan mahsulotlar soni MAX_LISTED_PRODUCTS bilan chegaralanadi, lekin SON to'g'ri, TO'LIQ hisoblanadi", () => {
    const manyBadProducts = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, name: `X${i}` }));
    const result = computeContentQualityIssues(manyBadProducts);
    expect(result.weakDescriptionCount).toBe(8);
    expect(result.weakDescriptionProducts.length).toBe(5);
    expect(result.noImageCount).toBe(8);
    expect(result.noImageProducts.length).toBe(5);
  });

  test("nom (name) berilmagan mahsulot uchun zaxira nom ishlatadi", () => {
    const result = computeContentQualityIssues([{ id: "p1" }]);
    expect(result.weakDescriptionProducts[0].name).toBe("Nomsiz mahsulot");
  });

  test("bo'sh yoki noto'g'ri kirishda xato bermaydi", () => {
    expect(computeContentQualityIssues([])).toEqual({
      weakDescriptionCount: 0, noImageCount: 0, weakDescriptionProducts: [], noImageProducts: [],
    });
    expect(computeContentQualityIssues(null)).toEqual({
      weakDescriptionCount: 0, noImageCount: 0, weakDescriptionProducts: [], noImageProducts: [],
    });
  });
});
