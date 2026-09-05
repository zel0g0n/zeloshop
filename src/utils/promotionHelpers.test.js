import { describe, test, expect } from "vitest";
import { calculateDiscountFromPercent, isValidDiscountPrice, computeDiscountExpiresAt } from "./promotionHelpers";

describe("calculateDiscountFromPercent", () => {
  test("20% chegirmani to'g'ri hisoblaydi", () => {
    expect(calculateDiscountFromPercent(100_000, 20)).toBe(80_000);
  });

  test("10% chegirmani to'g'ri hisoblaydi (yaxlitlash bilan)", () => {
    expect(calculateDiscountFromPercent(99_999, 10)).toBe(89_999);
  });

  test("0 yoki noto'g'ri narx uchun 0 qaytaradi", () => {
    expect(calculateDiscountFromPercent(0, 20)).toBe(0);
    expect(calculateDiscountFromPercent(null, 20)).toBe(0);
  });
});

describe("isValidDiscountPrice", () => {
  test("asl narxdan kichik, musbat qiymatni HAQIQIY deb tasdiqlaydi", () => {
    expect(isValidDiscountPrice(80_000, 100_000)).toBe(true);
  });

  test("asl narxga TENG yoki undan KATTA qiymatni rad etadi", () => {
    expect(isValidDiscountPrice(100_000, 100_000)).toBe(false);
    expect(isValidDiscountPrice(120_000, 100_000)).toBe(false);
  });

  test("0, manfiy yoki bo'sh qiymatlarni rad etadi", () => {
    expect(isValidDiscountPrice(0, 100_000)).toBe(false);
    expect(isValidDiscountPrice(-5000, 100_000)).toBe(false);
    expect(isValidDiscountPrice("", 100_000)).toBe(false);
    expect(isValidDiscountPrice(null, 100_000)).toBe(false);
  });

  test("raqam bo'lmagan qiymatni rad etadi", () => {
    expect(isValidDiscountPrice("abc", 100_000)).toBe(false);
  });
});

describe("computeDiscountExpiresAt", () => {
  test("hours=null (muddatsiz) - null qaytaradi", () => {
    expect(computeDiscountExpiresAt(null)).toBeNull();
    expect(computeDiscountExpiresAt(0)).toBeNull();
  });

  test("berilgan soatni HOZIRGI vaqtga qo'shib, ISO satr sifatida qaytaradi", () => {
    const nowMs = 1_000_000_000;
    const result = computeDiscountExpiresAt(24, nowMs);
    expect(result).toBe(new Date(nowMs + 24 * 60 * 60 * 1000).toISOString());
  });
});
