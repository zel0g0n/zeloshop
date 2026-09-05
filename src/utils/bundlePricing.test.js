import { describe, it, expect } from "vitest";
import { isBundleStillValid, computeBundleIndividualTotal, computeBundleSavings } from "./bundlePricing";

describe("isBundleStillValid", () => {
  it("combo'ning BARCHA mahsulotlari savatda bo'lsa - true", () => {
    const carts = [{ id: "p1", quantity: 1 }, { id: "p2", quantity: 2 }, { id: "p3", quantity: 1 }];
    expect(isBundleStillValid(carts, { productIds: ["p1", "p2"] })).toBe(true);
  });

  it("combo mahsulotlaridan BIRI savatdan olib tashlangan bo'lsa - false", () => {
    const carts = [{ id: "p1", quantity: 1 }];
    expect(isBundleStillValid(carts, { productIds: ["p1", "p2"] })).toBe(false);
  });

  it("mahsulot savatda bo'lsa-da, quantity 0 bo'lsa - mavjud emas deb hisoblanadi", () => {
    const carts = [{ id: "p1", quantity: 0 }, { id: "p2", quantity: 1 }];
    expect(isBundleStillValid(carts, { productIds: ["p1", "p2"] })).toBe(false);
  });

  it("bundle yo'q yoki productIds bo'sh bo'lsa - false", () => {
    expect(isBundleStillValid([{ id: "p1", quantity: 1 }], null)).toBe(false);
    expect(isBundleStillValid([{ id: "p1", quantity: 1 }], { productIds: [] })).toBe(false);
  });

  it("bo'sh savat uchun - false", () => {
    expect(isBundleStillValid([], { productIds: ["p1"] })).toBe(false);
    expect(isBundleStillValid(undefined, { productIds: ["p1"] })).toBe(false);
  });
});

describe("computeBundleIndividualTotal", () => {
  it("chegirmasiz mahsulotlar narxini to'g'ri qo'shadi", () => {
    expect(computeBundleIndividualTotal([{ price: 10000 }, { price: 20000 }])).toBe(30000);
  });

  it("chegirma narxi (discountPrice) bo'lsa - o'shani ishlatadi", () => {
    expect(computeBundleIndividualTotal([{ price: 10000, discountPrice: 8000 }])).toBe(8000);
  });

  it("noto'g'ri discountPrice (asl narxdan katta) e'tiborga olinmaydi", () => {
    expect(computeBundleIndividualTotal([{ price: 10000, discountPrice: 15000 }])).toBe(10000);
  });

  it("bo'sh/undefined ro'yxat uchun 0 qaytaradi", () => {
    expect(computeBundleIndividualTotal([])).toBe(0);
    expect(computeBundleIndividualTotal(undefined)).toBe(0);
  });
});

describe("computeBundleSavings", () => {
  it("combo narxi past bo'lsa - tejashni to'g'ri hisoblaydi", () => {
    expect(computeBundleSavings(100000, 80000)).toEqual({ savings: 20000, savingsPercent: 20 });
  });

  it("combo narxi individual jamidan YUQORI/teng bo'lsa - hech qachon manfiy tejash ko'rsatmaydi", () => {
    expect(computeBundleSavings(100000, 120000)).toEqual({ savings: 0, savingsPercent: 0 });
    expect(computeBundleSavings(100000, 100000)).toEqual({ savings: 0, savingsPercent: 0 });
  });

  it("individualTotal 0 bo'lsa - foizni hisoblashda xato bermaydi (0 qaytaradi)", () => {
    expect(computeBundleSavings(0, 0)).toEqual({ savings: 0, savingsPercent: 0 });
  });
});
