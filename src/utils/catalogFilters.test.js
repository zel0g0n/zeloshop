import { describe, test, expect } from "vitest";
import { applyAdvancedFilters, countActiveAdvancedFilters, applyAttributeFilters } from "./catalogFilters";

const makeProduct = (overrides = {}) => ({
  id: "p1",
  price: 100_000,
  stock: 5,
  averageRating: 4.5,
  ...overrides,
});

describe("applyAdvancedFilters", () => {
  test("hech qanday mezon berilmasa hammasini qaytaradi", () => {
    const products = [makeProduct({ id: "a" }), makeProduct({ id: "b" })];
    expect(applyAdvancedFilters(products, {})).toHaveLength(2);
  });

  test("narx oralig'ini to'g'ri qo'llaydi", () => {
    const products = [
      makeProduct({ id: "a", price: 10_000 }),
      makeProduct({ id: "b", price: 50_000 }),
      makeProduct({ id: "c", price: 100_000 }),
    ];
    const result = applyAdvancedFilters(products, { priceMin: 20_000, priceMax: 80_000 });
    expect(result.map((p) => p.id)).toEqual(["b"]);
  });

  test("faqat minimal narx berilsa (maximumsiz)", () => {
    const products = [makeProduct({ id: "a", price: 10_000 }), makeProduct({ id: "b", price: 90_000 })];
    const result = applyAdvancedFilters(products, { priceMin: 50_000 });
    expect(result.map((p) => p.id)).toEqual(["b"]);
  });

  test("reyting bo'yicha filtrlaydi", () => {
    const products = [
      makeProduct({ id: "a", averageRating: 3.2 }),
      makeProduct({ id: "b", averageRating: 4.7 }),
    ];
    const result = applyAdvancedFilters(products, { minRating: 4 });
    expect(result.map((p) => p.id)).toEqual(["b"]);
  });

  test("minRating=0 bo'lsa reyting filtri UMUMAN qo'llanmaydi (reytingsiz mahsulotlar ham qoladi)", () => {
    const products = [makeProduct({ id: "a", averageRating: 0 })];
    expect(applyAdvancedFilters(products, { minRating: 0 })).toHaveLength(1);
  });

  test("faqat ombordagilarni ko'rsatadi", () => {
    const products = [makeProduct({ id: "a", stock: 0 }), makeProduct({ id: "b", stock: 3 })];
    const result = applyAdvancedFilters(products, { inStockOnly: true });
    expect(result.map((p) => p.id)).toEqual(["b"]);
  });

  test("narx bo'yicha o'sish tartibida saralaydi", () => {
    const products = [makeProduct({ id: "a", price: 300 }), makeProduct({ id: "b", price: 100 }), makeProduct({ id: "c", price: 200 })];
    const result = applyAdvancedFilters(products, { priceSort: "price-asc" });
    expect(result.map((p) => p.id)).toEqual(["b", "c", "a"]);
  });

  test("narx bo'yicha kamayish tartibida saralaydi", () => {
    const products = [makeProduct({ id: "a", price: 300 }), makeProduct({ id: "b", price: 100 })];
    const result = applyAdvancedFilters(products, { priceSort: "price-desc" });
    expect(result.map((p) => p.id)).toEqual(["a", "b"]);
  });

  test("bir nechta mezon BIRGALIKDA (AND) qo'llanadi", () => {
    const products = [
      makeProduct({ id: "a", price: 50_000, stock: 0, averageRating: 4.8 }), // ombor yo'q -> chetlanadi
      makeProduct({ id: "b", price: 50_000, stock: 2, averageRating: 4.8 }), // hammasiga mos
      makeProduct({ id: "c", price: 999_000, stock: 2, averageRating: 4.8 }), // narx oshib ketgan -> chetlanadi
    ];
    const result = applyAdvancedFilters(products, { priceMax: 100_000, minRating: 4, inStockOnly: true });
    expect(result.map((p) => p.id)).toEqual(["b"]);
  });

  test("15-NICHE: `attributes` mezoni ham (AND) qo'llanadi", () => {
    const products = [
      makeProduct({ id: "a", attributes: { skinType: "oily" } }),
      makeProduct({ id: "b", attributes: { skinType: "dry" } }),
    ];
    const result = applyAdvancedFilters(products, { attributes: { skinType: "oily" } });
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });
});

describe("applyAttributeFilters (15-NICHE UNIVERSAL PLATFORMA - dinamik atribut filtrlari)", () => {
  test("filtr berilmasa yoki bo'sh bo'lsa, hammasini qaytaradi", () => {
    const products = [makeProduct({ id: "a" }), makeProduct({ id: "b" })];
    expect(applyAttributeFilters(products, {})).toHaveLength(2);
    expect(applyAttributeFilters(products, undefined)).toHaveLength(2);
  });

  test("bitta atribut bo'yicha aniq (exact) moslikni filtrlaydi", () => {
    const products = [
      makeProduct({ id: "a", attributes: { brand: "Nivea" } }),
      makeProduct({ id: "b", attributes: { brand: "Nike" } }),
    ];
    const result = applyAttributeFilters(products, { brand: "Nivea" });
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });

  test("bir nechta atribut BIRGALIKDA (AND) qo'llanadi", () => {
    const products = [
      makeProduct({ id: "a", attributes: { gender: "men", color: "black" } }),
      makeProduct({ id: "b", attributes: { gender: "men", color: "white" } }),
    ];
    const result = applyAttributeFilters(products, { gender: "men", color: "black" });
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });

  test("`attributes` maydoni umuman yo'q mahsulotni ham xato bermay chetlab o'tadi", () => {
    const products = [makeProduct({ id: "a" }), makeProduct({ id: "b", attributes: { brand: "Nivea" } })];
    const result = applyAttributeFilters(products, { brand: "Nivea" });
    expect(result.map((p) => p.id)).toEqual(["b"]);
  });

  test("bo'sh qiymatli filtrlar (masalan '') e'tiborsiz qoldiriladi", () => {
    const products = [makeProduct({ id: "a", attributes: { brand: "Nivea" } })];
    expect(applyAttributeFilters(products, { brand: "", color: null })).toHaveLength(1);
  });
});

describe("countActiveAdvancedFilters", () => {
  test("hech narsa faol bo'lmasa 0 qaytaradi", () => {
    expect(countActiveAdvancedFilters({ priceMin: null, priceMax: null, minRating: 0, inStockOnly: false, priceSort: "none" })).toBe(0);
  });

  test("har bir faol mezonni alohida sanaydi", () => {
    expect(
      countActiveAdvancedFilters({ priceMin: 1000, priceMax: null, minRating: 4, inStockOnly: true, priceSort: "price-asc" })
    ).toBe(4);
  });

  test("narx oralig'i (min VA max ikkalasi) bitta filtr sifatida sanaladi", () => {
    expect(
      countActiveAdvancedFilters({ priceMin: 1000, priceMax: 5000, minRating: 0, inStockOnly: false, priceSort: "none" })
    ).toBe(1);
  });
});
