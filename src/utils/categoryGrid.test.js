import { describe, test, expect } from "vitest";
import { buildCategoryCards } from "./categoryGrid";

const CATEGORIES = [
  { value: "Skincare", label: "Skincare (Krem, Serum)" },
  { value: "Makeup", label: "Makeup (Kosmetika)" },
  { value: "Perfume", label: "Perfume (Atirlar)" },
];

const makeProduct = (overrides = {}) => ({ id: "p1", category: "Skincare", image: "https://x.com/a.jpg", ...overrides });

describe("buildCategoryCards", () => {
  test("har bir kategoriya uchun to'g'ri sonni hisoblaydi", () => {
    const products = [
      makeProduct({ id: "a", category: "Skincare" }),
      makeProduct({ id: "b", category: "Skincare" }),
      makeProduct({ id: "c", category: "Makeup" }),
    ];
    const result = buildCategoryCards(products, CATEGORIES);
    expect(result.find((c) => c.value === "Skincare").count).toBe(2);
    expect(result.find((c) => c.value === "Makeup").count).toBe(1);
  });

  test("bo'sh kategoriyalarni natijaga KIRITMAYDI", () => {
    const products = [makeProduct({ category: "Skincare" })];
    const result = buildCategoryCards(products, CATEGORIES);
    expect(result.find((c) => c.value === "Perfume")).toBeUndefined();
    expect(result).toHaveLength(1);
  });

  test("kategoriyadagi BIRINCHI rasmli mahsulotning suratini oladi", () => {
    const products = [
      makeProduct({ id: "a", category: "Skincare", image: null, images: [] }),
      makeProduct({ id: "b", category: "Skincare", image: "https://x.com/b.jpg" }),
    ];
    const result = buildCategoryCards(products, CATEGORIES);
    expect(result.find((c) => c.value === "Skincare").coverImage).toBe("https://x.com/b.jpg");
  });

  test("hech qanday rasmli mahsulot bo'lmasa coverImage null bo'ladi", () => {
    const products = [makeProduct({ category: "Skincare", image: null, images: [] })];
    const result = buildCategoryCards(products, CATEGORIES);
    expect(result.find((c) => c.value === "Skincare").coverImage).toBeNull();
  });

  test("`images` massividagi birinchi rasmni ham qabul qiladi (image maydoni bo'lmasa)", () => {
    const products = [makeProduct({ category: "Skincare", image: null, images: ["https://x.com/c.jpg"] })];
    const result = buildCategoryCards(products, CATEGORIES);
    expect(result.find((c) => c.value === "Skincare").coverImage).toBe("https://x.com/c.jpg");
  });

  test("ko'p mahsulotli kategoriya birinchi (kamayish tartibida saralanadi)", () => {
    const products = [
      makeProduct({ id: "a", category: "Makeup" }),
      makeProduct({ id: "b", category: "Skincare" }),
      makeProduct({ id: "c", category: "Skincare" }),
      makeProduct({ id: "d", category: "Skincare" }),
    ];
    const result = buildCategoryCards(products, CATEGORIES);
    expect(result[0].value).toBe("Skincare");
  });

  test("kategoriyalar ro'yxati bo'sh bo'lsa bo'sh massiv qaytaradi", () => {
    expect(buildCategoryCards([makeProduct()], [])).toEqual([]);
  });
});
