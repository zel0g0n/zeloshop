import { describe, test, expect } from "vitest";
import { formatTimeSaved } from "./formatTimeSaved";

// Haqiqiy `t()` (LanguageContext) o'rniga - qaysi KALIT va PARAMETR
// bilan chaqirilganini tekshirish uchun yetarli, real tarjima
// matnining o'zi bu yerda ahamiyatsiz.
const fakeT = (key, params) => `${key}:${JSON.stringify(params || {})}`;

/**
 * "SELLERGA VAQT SOTAMIZ" - `computeTimeSavedMinutes` (backend,
 * `functions/aiCeo.js`) qaytargan xom daqiqa sonini o'qish uchun
 * qulay matnga o'giradi.
 */
describe("formatTimeSaved", () => {
  test("60 daqiqadan kam bo'lsa, timeSavedMinutes kalitini ishlatadi", () => {
    expect(formatTimeSaved(45, fakeT)).toBe('aiCeo.timeSavedMinutes:{"count":45}');
  });

  test("kasr qiymatni yaqin butun songa yaxlitlaydi", () => {
    expect(formatTimeSaved(44.6, fakeT)).toBe('aiCeo.timeSavedMinutes:{"count":45}');
  });

  test("aniq soatlar (qoldiqsiz) uchun timeSavedHours kalitini ishlatadi", () => {
    expect(formatTimeSaved(120, fakeT)).toBe('aiCeo.timeSavedHours:{"count":2}');
  });

  test("soat+daqiqa aralash bo'lsa, timeSavedHoursMinutes kalitini ishlatadi", () => {
    expect(formatTimeSaved(125, fakeT)).toBe('aiCeo.timeSavedHoursMinutes:{"hours":2,"minutes":5}');
  });

  test("manfiy yoki noto'g'ri qiymatlar uchun xato tashlamasdan 0 daqiqaga tushadi", () => {
    expect(formatTimeSaved(-10, fakeT)).toBe('aiCeo.timeSavedMinutes:{"count":0}');
    expect(formatTimeSaved(NaN, fakeT)).toBe('aiCeo.timeSavedMinutes:{"count":0}');
    expect(formatTimeSaved(undefined, fakeT)).toBe('aiCeo.timeSavedMinutes:{"count":0}');
  });
});
