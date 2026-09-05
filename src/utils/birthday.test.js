import { describe, it, expect } from "vitest";
import { deriveBirthdayMonthDay } from "./birthday";

describe("deriveBirthdayMonthDay", () => {
  it("to'g'ri 'YYYY-MM-DD' sanadan 'MM-DD' qismini ajratib oladi", () => {
    expect(deriveBirthdayMonthDay("1995-05-20")).toBe("05-20");
    expect(deriveBirthdayMonthDay("2000-12-31")).toBe("12-31");
  });

  it("bo'sh yoki noto'g'ri qiymatlar uchun null qaytaradi", () => {
    expect(deriveBirthdayMonthDay("")).toBeNull();
    expect(deriveBirthdayMonthDay(null)).toBeNull();
    expect(deriveBirthdayMonthDay(undefined)).toBeNull();
    expect(deriveBirthdayMonthDay("noto'g'ri")).toBeNull();
    expect(deriveBirthdayMonthDay("2000/12/31")).toBeNull();
    expect(deriveBirthdayMonthDay(20000101)).toBeNull();
  });
});
