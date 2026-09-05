import { describe, test, expect } from "vitest";
import { computeCac } from "./cac";

describe("computeCac", () => {
  test("davr ichida birinchi xarid qilgan mijozlarni to'g'ri sanaydi va CAC'ni hisoblaydi", () => {
    const customers = [
      { firstOrderAtMs: 1500 }, // davr ichida
      { firstOrderAtMs: 1800 }, // davr ichida
      { firstOrderAtMs: 500 }, // davrdan OLDIN - hisobga olinmaydi
      { firstOrderAtMs: 3000 }, // davrdan KEYIN - hisobga olinmaydi
    ];
    const result = computeCac(customers, 1000, 2000, 200_000);
    expect(result.newCustomersCount).toBe(2);
    expect(result.cac).toBe(100_000); // 200,000 / 2
  });

  test("firstOrderAtMs YO'Q (migratsiyadan oldingi) mijozlarni hisobga olmaydi", () => {
    const customers = [{ firstOrderAtMs: null }, { firstOrderAtMs: undefined }, { firstOrderAtMs: 1500 }];
    const result = computeCac(customers, 1000, 2000, 100_000);
    expect(result.newCustomersCount).toBe(1);
    expect(result.cac).toBe(100_000);
  });

  test("yangi mijoz yo'q bo'lsa - CAC null (nolga bo'lish yo'q)", () => {
    const result = computeCac([], 1000, 2000, 500_000);
    expect(result.newCustomersCount).toBe(0);
    expect(result.cac).toBeNull();
  });

  test("marketing xarajati 0 bo'lsa - CAC 0 (haqiqiy natija, xato emas)", () => {
    const customers = [{ firstOrderAtMs: 1500 }];
    const result = computeCac(customers, 1000, 2000, 0);
    expect(result.cac).toBe(0);
  });

  test("rangeEnd=Infinity (masalan 'Barchasi' filtri) bilan ham ishlaydi", () => {
    const customers = [{ firstOrderAtMs: 999_999 }];
    const result = computeCac(customers, 1000, Infinity, 50_000);
    expect(result.newCustomersCount).toBe(1);
  });

  test("bo'sh/undefined kirish uchun xato bermaydi", () => {
    expect(computeCac(undefined, 0, 100, 1000)).toEqual({ newCustomersCount: 0, cac: null });
  });
});
