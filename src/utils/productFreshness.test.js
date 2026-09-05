import { describe, test, expect } from "vitest";
import { isRecentlyAdded, NEW_BADGE_WINDOW_MS } from "./productFreshness";

const NOW = new Date("2026-09-04T12:00:00.000Z").getTime();

describe("isRecentlyAdded", () => {
  test("1 soat oldin qo'shilgan mahsulot uchun true qaytaradi", () => {
    const createdAt = new Date(NOW - 60 * 60 * 1000).toISOString();
    expect(isRecentlyAdded(createdAt, NOW)).toBe(true);
  });

  test("aynan 48 soat oldin qo'shilgan mahsulot uchun false qaytaradi (chegara qamrab olinmaydi)", () => {
    const createdAt = new Date(NOW - NEW_BADGE_WINDOW_MS).toISOString();
    expect(isRecentlyAdded(createdAt, NOW)).toBe(false);
  });

  test("47 soat 59 daqiqa oldin qo'shilgan mahsulot uchun true qaytaradi", () => {
    const createdAt = new Date(NOW - (NEW_BADGE_WINDOW_MS - 60 * 1000)).toISOString();
    expect(isRecentlyAdded(createdAt, NOW)).toBe(true);
  });

  test("72 soat oldin qo'shilgan (eski) mahsulot uchun false qaytaradi", () => {
    const createdAt = new Date(NOW - 72 * 60 * 60 * 1000).toISOString();
    expect(isRecentlyAdded(createdAt, NOW)).toBe(false);
  });

  test("millisoniya (son) shaklidagi createdAt'ni ham to'g'ri qabul qiladi (`addProduct.js` darhol qaytaradigan mahalliy obyekt)", () => {
    const createdAt = NOW - 60 * 60 * 1000;
    expect(isRecentlyAdded(createdAt, NOW)).toBe(true);
  });

  test("Firestore Timestamp shaklidagi (`toMillis()` metodli) createdAt'ni ham to'g'ri qabul qiladi", () => {
    const createdAt = { toMillis: () => NOW - 60 * 60 * 1000 };
    expect(isRecentlyAdded(createdAt, NOW)).toBe(true);
  });

  test("null/undefined/bo'sh createdAt uchun false qaytaradi", () => {
    expect(isRecentlyAdded(null, NOW)).toBe(false);
    expect(isRecentlyAdded(undefined, NOW)).toBe(false);
    expect(isRecentlyAdded("", NOW)).toBe(false);
  });

  test("noto'g'ri formatdagi satr uchun false qaytaradi", () => {
    expect(isRecentlyAdded("bu sana emas", NOW)).toBe(false);
  });
});
