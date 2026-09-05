import { describe, test, expect } from "vitest";
import { computeProfitMetrics, isDiscountActive, getDiscountRemainingMs, formatCountdown } from "./productPricing";

describe("computeProfitMetrics", () => {
  test("narx yoki tannarx kiritilmagan bo'lsa, hasValues=false qaytaradi", () => {
    expect(computeProfitMetrics("", "", "")).toEqual({ profit: 0, marginPercentage: 0, hasValues: false, effectivePrice: 0 });
    expect(computeProfitMetrics(100, "", "")).toEqual({ profit: 0, marginPercentage: 0, hasValues: false, effectivePrice: 0 });
  });

  test("tannarx \"0\" bo'lsa ham (bo'sh qator emas), to'g'ri hisoblaydi — falsy xatosi yo'q", () => {
    const result = computeProfitMetrics(50000, 0, "");
    expect(result.hasValues).toBe(true);
    expect(result.profit).toBe(50000);
  });

  test("chegirma bo'lmasa, oddiy narxdan foyda hisoblaydi", () => {
    const result = computeProfitMetrics(50000, 30000, "");
    expect(result.profit).toBe(20000);
    expect(result.marginPercentage).toBe(40); // 20000/50000 * 100
    expect(result.effectivePrice).toBe(50000);
  });

  test("chegirma kiritilgan bo'lsa, foyda CHEGIRMALI narxdan hisoblanadi (haqiqiy to'lov)", () => {
    const result = computeProfitMetrics(50000, 30000, 35000);
    expect(result.profit).toBe(5000); // 35000 - 30000
    expect(result.effectivePrice).toBe(35000);
  });

  test("chegirma narxi 0 yoki bo'sh bo'lsa, e'tiborga olinmaydi", () => {
    const result = computeProfitMetrics(50000, 30000, 0);
    expect(result.effectivePrice).toBe(50000);
  });

  test("manfiy foyda (zarar) to'g'ri hisoblanadi va belgilanadi", () => {
    const result = computeProfitMetrics(20000, 30000, "");
    expect(result.profit).toBe(-10000);
    expect(result.marginPercentage).toBe(-50);
  });
});

describe("isDiscountActive", () => {
  test("discountPrice yo'q yoki 0 bo'lsa - false", () => {
    expect(isDiscountActive({ price: 1000, discountPrice: 0 })).toBe(false);
    expect(isDiscountActive({ price: 1000 })).toBe(false);
  });

  test("discountPrice asl narxdan katta/teng bo'lsa - false", () => {
    expect(isDiscountActive({ price: 1000, discountPrice: 1000 })).toBe(false);
    expect(isDiscountActive({ price: 1000, discountPrice: 1500 })).toBe(false);
  });

  test("muddat belgilanmagan (discountExpiresAt yo'q) - HAQIQIY chegirma bo'lsa har doim true", () => {
    expect(isDiscountActive({ price: 1000, discountPrice: 800 })).toBe(true);
  });

  test("muddat hali kelmagan bo'lsa - true", () => {
    const nowMs = 1_000_000;
    const product = { price: 1000, discountPrice: 800, discountExpiresAt: new Date(nowMs + 60_000).toISOString() };
    expect(isDiscountActive(product, nowMs)).toBe(true);
  });

  test("muddat O'TGAN bo'lsa - false (chegirma endi ko'rsatilmaydi)", () => {
    const nowMs = 1_000_000;
    const product = { price: 1000, discountPrice: 800, discountExpiresAt: new Date(nowMs - 60_000).toISOString() };
    expect(isDiscountActive(product, nowMs)).toBe(false);
  });

  test("noto'g'ri formatdagi discountExpiresAt - xavfsiz standart sifatida 'muddatsiz/faol' deb hisoblanadi", () => {
    const product = { price: 1000, discountPrice: 800, discountExpiresAt: "not-a-date" };
    expect(isDiscountActive(product)).toBe(true);
  });
});

describe("getDiscountRemainingMs", () => {
  test("discountExpiresAt yo'q bo'lsa - null", () => {
    expect(getDiscountRemainingMs({ price: 1000, discountPrice: 800 })).toBeNull();
  });

  test("muddat hali kelmagan bo'lsa - qolgan millisekundni qaytaradi", () => {
    const nowMs = 1_000_000;
    const product = { discountExpiresAt: new Date(nowMs + 5000).toISOString() };
    expect(getDiscountRemainingMs(product, nowMs)).toBe(5000);
  });

  test("muddat allaqachon o'tgan bo'lsa - 0 (manfiy emas)", () => {
    const nowMs = 1_000_000;
    const product = { discountExpiresAt: new Date(nowMs - 5000).toISOString() };
    expect(getDiscountRemainingMs(product, nowMs)).toBe(0);
  });
});

describe("formatCountdown", () => {
  test("null/0/manfiy bo'lsa - null", () => {
    expect(formatCountdown(null)).toBeNull();
    expect(formatCountdown(0)).toBeNull();
    expect(formatCountdown(-100)).toBeNull();
  });

  test("1 kundan kam qolgan bo'lsa - SS:DD:SS formatida (kunsiz)", () => {
    const ms = 2 * 60 * 60 * 1000 + 5 * 60 * 1000 + 3 * 1000; // 2s 5d 3sek
    expect(formatCountdown(ms)).toBe("02:05:03");
  });

  test("1 kundan ko'p qolgan bo'lsa - 'Nk SS:DD:SS' formatida", () => {
    const ms = 3 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000 + 2 * 60 * 1000 + 3 * 1000;
    expect(formatCountdown(ms)).toBe("3k 01:02:03");
  });
});
