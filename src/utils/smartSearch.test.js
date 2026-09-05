import { describe, test, expect } from "vitest";
import { normalizeSearchText, levenshteinDistance, computeProductSearchScore, searchProducts, expandQueryWithSynonyms } from "./smartSearch";

describe("normalizeSearchText", () => {
  test("kichik harflarga o'tkazadi, ortiqcha bo'shliqni yig'adi", () => {
    expect(normalizeSearchText("  Yuz   Kremi  ")).toBe("yuz kremi");
  });

  test("turli apostrof belgilarini BIR XIL ' ga keltiradi", () => {
    expect(normalizeSearchText("do‘kon")).toBe("do'kon");
    expect(normalizeSearchText("do’kon")).toBe("do'kon");
    expect(normalizeSearchText("doʼkon")).toBe("do'kon");
  });

  test("null/undefined uchun bo'sh satr qaytaradi, xato tashlamaydi", () => {
    expect(normalizeSearchText(null)).toBe("");
    expect(normalizeSearchText(undefined)).toBe("");
  });
});

describe("levenshteinDistance", () => {
  test("bir xil satrlar uchun 0", () => {
    expect(levenshteinDistance("krem", "krem")).toBe(0);
  });

  test("bitta harf farqi uchun 1", () => {
    expect(levenshteinDistance("krem", "kren")).toBe(1);
  });

  test("bo'sh satrlar uchun ikkinchi satr uzunligini qaytaradi", () => {
    expect(levenshteinDistance("", "abc")).toBe(3);
    expect(levenshteinDistance("abc", "")).toBe(3);
  });

  test("butunlay boshqa so'zlar uchun katta masofa", () => {
    expect(levenshteinDistance("krem", "telefon")).toBeGreaterThan(3);
  });
});

describe("computeProductSearchScore", () => {
  test("bo'sh so'rov uchun har doim musbat (mos) ball qaytaradi", () => {
    expect(computeProductSearchScore({ name: "Krem" }, "")).toBeGreaterThan(0);
  });

  test("TO'LIQ mos kelgan nom - eng yuqori ballardan biri", () => {
    const exact = computeProductSearchScore({ name: "krem" }, "krem");
    const partial = computeProductSearchScore({ name: "yuz uchun krem" }, "krem");
    expect(exact).toBeGreaterThan(partial);
  });

  test("nomdagi moslik kategoriya/tavsifdagi moslikdan YUQORIROQ ball oladi", () => {
    const nameMatch = computeProductSearchScore({ name: "krem", category: "boshqa", description: "boshqa" }, "krem");
    const descriptionMatch = computeProductSearchScore({ name: "boshqa", category: "boshqa", description: "bu krem juda yaxshi" }, "krem");
    expect(nameMatch).toBeGreaterThan(descriptionMatch);
  });

  test("so'rovdagi HAR BIR so'z kamida bitta maydonda topilishi SHART - topilmasa 0", () => {
    const score = computeProductSearchScore({ name: "yuz kremi", category: "kosmetika", description: "" }, "krem telefon");
    expect(score).toBe(0);
  });

  test("kichik yozuv xatosiga (bitta harf) CHIDAMLI - uzun so'zlar uchun", () => {
    // "shampun" -> "shampu" (bitta harf tushib qolgan) - 7 harfli so'z, ruxsat etilgan masofa 1.
    const score = computeProductSearchScore({ name: "shampun" }, "shampu");
    expect(score).toBeGreaterThan(0);
  });

  test("QISQA so'zlarda (<=4 harf) xiralik (fuzzy) matching ISHLAMAYDI - noto'g'ri mos kelishning oldini oladi", () => {
    // "krem" va "kram" ikkalasi ham 4 harf - fuzzy o'chirilgan, faqat aniq moslik.
    const score = computeProductSearchScore({ name: "kram uchun idish" }, "krem");
    expect(score).toBe(0);
  });

  test("apostrof variantlari FARQ QILMAYDI (o'zbekcha so'zlar uchun)", () => {
    const withCurly = computeProductSearchScore({ name: "do’kon mahsuloti" }, "do'kon");
    expect(withCurly).toBeGreaterThan(0);
  });

  test("brend maydonida moslik ham hisobga olinadi", () => {
    const score = computeProductSearchScore({ name: "krem", brand: "Nivea", category: "", description: "" }, "nivea");
    expect(score).toBeGreaterThan(0);
  });

  test("15-NICHE: dinamik `attributes` qiymatlari ham qidiruv maydoniga kiradi", () => {
    const score = computeProductSearchScore({ name: "Krem", attributes: { skinType: "oily" } }, "oily");
    expect(score).toBeGreaterThan(0);
  });

  test("`attributes` yo'q yoki noto'g'ri turdagi bo'lsa, xato bermaydi", () => {
    expect(() => computeProductSearchScore({ name: "Krem" }, "krem")).not.toThrow();
    expect(() => computeProductSearchScore({ name: "Krem", attributes: null }, "krem")).not.toThrow();
  });
});

describe("expandQueryWithSynonyms (15-NICHE: uch tildagi sinonimlarni tushunish)", () => {
  const synonymGroups = [
    ["telefon", "телефон", "phone", "smartfon"],
    ["noutbuk", "ноутбук", "laptop"],
  ];

  test("so'rov sinonim guruhidagi bironta so'zga mos kelmasa, faqat asl so'rovni qaytaradi", () => {
    expect(expandQueryWithSynonyms("krem", synonymGroups)).toEqual(["krem"]);
  });

  test("ruscha sinonim kiritilsa, guruhning BOSHQA barcha (o'zbek/ingliz) variantlari ham qo'shiladi", () => {
    const result = expandQueryWithSynonyms("телефон", synonymGroups);
    expect(result).toContain("телефон");
    expect(result).toContain("telefon");
    expect(result).toContain("phone");
    expect(result).toContain("smartfon");
  });

  test("bir nechta so'zli so'rov ichidagi frazani to'g'ri almashtiradi", () => {
    const result = expandQueryWithSynonyms("qora телефон chexol", synonymGroups);
    expect(result).toContain("qora telefon chexol");
    expect(result).toContain("qora phone chexol");
  });

  test("bo'sh so'rov yoki guruhlar uchun xato bermaydi", () => {
    expect(expandQueryWithSynonyms("", synonymGroups)).toEqual([""]);
    expect(expandQueryWithSynonyms("krem", [])).toEqual(["krem"]);
    expect(expandQueryWithSynonyms("krem", undefined)).toEqual(["krem"]);
  });
});

describe("searchProducts - sinonim guruhlari bilan (15-NICHE UNIVERSAL PLATFORMA)", () => {
  const products = [
    { id: "1", name: "Samsung telefon" },
    { id: "2", name: "Apple noutbuk" },
  ];
  const synonymGroups = [["telefon", "телефон", "phone"]];

  test("sinonim guruhlari BERILMASA, oldingi (o'zgarishsiz) xatti-harakat saqlanadi", () => {
    const result = searchProducts(products, "телефон");
    expect(result).toEqual([]); // guruh berilmagani uchun ruscha so'z topilmaydi
  });

  test("mos sinonim guruhi berilsa, boshqa tildagi so'rov orqali ham mahsulot topiladi", () => {
    const result = searchProducts(products, "телефон", synonymGroups);
    expect(result.map((p) => p.id)).toEqual(["1"]);
  });
});

describe("searchProducts", () => {
  const products = [
    { id: "1", name: "Yuz uchun krem" },
    { id: "2", name: "Krem" },
    { id: "3", name: "Sochlar uchun shampun" },
    { id: "4", name: "Telefon g'ilofi" },
  ];

  test("bo'sh so'rov - asl tartibda, o'zgarishsiz qaytaradi", () => {
    expect(searchProducts(products, "")).toBe(products);
  });

  test("mos kelmagan mahsulotlarni chiqarib tashlaydi", () => {
    const result = searchProducts(products, "krem");
    expect(result.map((p) => p.id)).toEqual(["2", "1"]); // to'liq moslik ("Krem") oldinda
  });

  test("relevantlik bo'yicha TO'G'RI tartiblanadi - to'liq mos kelgan nom birinchi", () => {
    const result = searchProducts(products, "krem");
    expect(result[0].id).toBe("2");
  });

  test("hech narsa mos kelmasa - bo'sh massiv", () => {
    expect(searchProducts(products, "noutbuk")).toEqual([]);
  });

  test("bir xil ball bo'lsa - ASL tartib saqlanadi (barqaror tartiblash)", () => {
    const sameScoreProducts = [
      { id: "a", name: "Sovun A" },
      { id: "b", name: "Sovun B" },
    ];
    const result = searchProducts(sameScoreProducts, "sovun");
    expect(result.map((p) => p.id)).toEqual(["a", "b"]);
  });
});
