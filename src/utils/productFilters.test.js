import { describe, test, expect } from "vitest";
import { filterAndSortProducts, computeStatusCounts, computeInventoryValue } from "./productFilters";

const makeProduct = (overrides = {}) => ({
  id: "p1",
  title: "Krem",
  category: "Yuz parvarishi",
  isActive: true,
  price: 50_000,
  stock: 10,
  ...overrides,
});

describe("filterAndSortProducts", () => {
  test("bo'sh qidiruv/filtrlar bilan barcha mahsulotlarni qaytaradi", () => {
    const products = [makeProduct({ id: "a" }), makeProduct({ id: "b" })];
    expect(filterAndSortProducts(products, {})).toHaveLength(2);
  });

  test("nom bo'yicha qidiradi (katta-kichik harfga sezgir emas)", () => {
    const products = [
      makeProduct({ id: "a", title: "Vitamin C Serum" }),
      makeProduct({ id: "b", title: "Nam beruvchi krem" }),
    ];
    const result = filterAndSortProducts(products, { searchQuery: "SERUM" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a");
  });

  test("'Faol' filtri faqat isActive=true (yoki ko'rsatilmagan) mahsulotlarni qoldiradi", () => {
    const products = [
      makeProduct({ id: "a", isActive: true }),
      makeProduct({ id: "b", isActive: false }),
      makeProduct({ id: "c" }), // isActive ko'rsatilmagan — standart FAOL
    ];
    const result = filterAndSortProducts(products, { statusFilter: "Faol" });
    expect(result.map((p) => p.id).sort()).toEqual(["a", "c"]);
  });

  test("'Nofaol' filtri faqat isActive=false mahsulotlarni qoldiradi", () => {
    const products = [
      makeProduct({ id: "a", isActive: true }),
      makeProduct({ id: "b", isActive: false }),
    ];
    const result = filterAndSortProducts(products, { statusFilter: "Nofaol" });
    expect(result.map((p) => p.id)).toEqual(["b"]);
  });

  test("'KamQolgan' filtri stock<=3 bo'lgan mahsulotlarni qoldiradi", () => {
    const products = [
      makeProduct({ id: "a", stock: 2 }),
      makeProduct({ id: "b", stock: 10 }),
    ];
    const result = filterAndSortProducts(products, { statusFilter: "KamQolgan" });
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });

  test("kategoriya bo'yicha filtrlaydi", () => {
    const products = [
      makeProduct({ id: "a", category: "Yuz parvarishi" }),
      makeProduct({ id: "b", category: "Soch parvarishi" }),
    ];
    const result = filterAndSortProducts(products, { categoryFilter: "Soch parvarishi" });
    expect(result.map((p) => p.id)).toEqual(["b"]);
  });

  test("narx bo'yicha kamayish tartibida saralaydi", () => {
    const products = [
      makeProduct({ id: "cheap", price: 10_000 }),
      makeProduct({ id: "expensive", price: 100_000 }),
    ];
    const result = filterAndSortProducts(products, { sortBy: "price-desc" });
    expect(result.map((p) => p.id)).toEqual(["expensive", "cheap"]);
  });

  test("bir nechta filtr birgalikda (AND mantig'i bilan) ishlaydi", () => {
    const products = [
      makeProduct({ id: "match", title: "Nam beruvchi krem", category: "Yuz parvarishi", isActive: true }),
      makeProduct({ id: "wrong-category", title: "Nam beruvchi shampun", category: "Soch parvarishi", isActive: true }),
      makeProduct({ id: "wrong-status", title: "Nam beruvchi tonik", category: "Yuz parvarishi", isActive: false }),
    ];
    const result = filterAndSortProducts(products, {
      searchQuery: "nam",
      categoryFilter: "Yuz parvarishi",
      statusFilter: "Faol",
    });
    expect(result.map((p) => p.id)).toEqual(["match"]);
  });
});

describe("computeStatusCounts", () => {
  test("har bir toifadagi mahsulotlar sonini to'g'ri hisoblaydi", () => {
    const products = [
      makeProduct({ id: "a", isActive: true, stock: 10 }),
      makeProduct({ id: "b", isActive: false, stock: 2 }),
      makeProduct({ id: "c", isActive: true, stock: 1 }),
    ];
    const counts = computeStatusCounts(products);
    expect(counts).toEqual({ allCount: 3, activeCount: 2, inactiveCount: 1, lowStockCount: 2 });
  });
});

describe("computeInventoryValue", () => {
  test("narx x qoldiq yig'indisini to'g'ri hisoblaydi", () => {
    const products = [
      makeProduct({ price: 10_000, stock: 5 }), // 50,000
      makeProduct({ price: 20_000, stock: 2 }), // 40,000
    ];
    expect(computeInventoryValue(products)).toBe(90_000);
  });

  test("bo'sh ro'yxat uchun 0 qaytaradi", () => {
    expect(computeInventoryValue([])).toBe(0);
  });
});
