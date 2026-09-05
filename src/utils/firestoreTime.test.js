import { describe, test, expect } from "vitest";
import { toMillis } from "./firestoreTime";

describe("toMillis", () => {
  test("`toMillis()` metodiga ega Firestore Timestamp obyektini to'g'ri o'giradi", () => {
    const fakeTimestamp = { toMillis: () => 1735689600000 };
    expect(toMillis(fakeTimestamp)).toBe(1735689600000);
  });

  test("xom `{seconds}` shaklini (masalan tezkor boshlang'ich o'qishdan) to'g'ri o'giradi", () => {
    expect(toMillis({ seconds: 1735689600 })).toBe(1735689600000);
  });

  test("oddiy Date obyektini qabul qiladi", () => {
    const date = new Date(2026, 0, 1);
    expect(toMillis(date)).toBe(date.getTime());
  });

  test("allaqachon son (millisoniya) bo'lsa, o'zgarishsiz qaytaradi", () => {
    expect(toMillis(1735689600000)).toBe(1735689600000);
  });

  test("null/undefined/bo'sh qiymatlar uchun null qaytaradi", () => {
    expect(toMillis(null)).toBeNull();
    expect(toMillis(undefined)).toBeNull();
    expect(toMillis(0)).toBeNull();
  });

  test("noma'lum/kutilmagan shakl uchun null qaytaradi", () => {
    expect(toMillis({ foo: "bar" })).toBeNull();
    expect(toMillis("2026-01-01")).toBeNull();
  });
});
