import { describe, it, expect } from "vitest";
import { formatDayMonth } from "./dateRange";

const MONTHS = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"];

describe("formatDayMonth", () => {
  it("'YYYY-MM-DD' matnini 'kun Oy' ko'rinishida qaytaradi (locale'siz)", () => {
    expect(formatDayMonth("2026-10-01", MONTHS)).toBe("1 Okt");
    expect(formatDayMonth("2026-12-31", MONTHS)).toBe("31 Dek");
  });

  it("Date va ms qiymatlarini ham qabul qiladi", () => {
    expect(formatDayMonth(new Date(2026, 2, 5), MONTHS)).toBe("5 Mar");
    expect(formatDayMonth(new Date(2026, 8, 9).getTime(), MONTHS)).toBe("9 Sen");
  });

  it("noto'g'ri yoki bo'sh qiymatda bo'sh matn qaytaradi", () => {
    expect(formatDayMonth("", MONTHS)).toBe("");
    expect(formatDayMonth(null, MONTHS)).toBe("");
    expect(formatDayMonth("abc", MONTHS)).toBe("");
  });

  it("oy nomlari berilmasa raqamli oyga qaytadi", () => {
    expect(formatDayMonth("2026-10-01")).toBe("1 10");
  });
});
