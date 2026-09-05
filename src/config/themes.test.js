import { describe, test, expect } from "vitest";
import {
  THEMES,
  THEME_IDS,
  DEFAULT_THEME_ID,
  getThemeConfig,
  isValidThemeId,
  resolveThemeColors,
  getRecommendedThemeId,
} from "./themes";

describe("THEMES ro'yxati", () => {
  test("kamida 8 ta tema mavjud, har biri to'liq shaklga ega", () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(8);
    THEMES.forEach((theme) => {
      expect(typeof theme.id).toBe("string");
      expect(theme.id.length).toBeGreaterThan(0);
      expect(typeof theme.nameKey).toBe("string");
      expect(theme.colors.light.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(theme.colors.light.foreground).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(theme.colors.light.soft).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(theme.colors.dark.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(theme.colors.dark.foreground).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(theme.colors.dark.soft).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  test("barcha ID'lar noyob (takrorlanmaydi)", () => {
    const ids = THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("DEFAULT_THEME_ID ('ocean') ro'yxatda mavjud", () => {
    expect(THEME_IDS).toContain(DEFAULT_THEME_ID);
  });
});

describe("getThemeConfig — xavfsiz zaxira (fallback)", () => {
  test("haqiqiy ID uchun to'g'ri konfiguratsiyani qaytaradi", () => {
    expect(getThemeConfig("royalPurple").id).toBe("royalPurple");
  });

  test("noma'lum/buzilgan/bo'sh ID uchun standart ('ocean')ga qaytadi, xato tashlamaydi", () => {
    expect(getThemeConfig("shunaqa-tema-yoq").id).toBe(DEFAULT_THEME_ID);
    expect(getThemeConfig(null).id).toBe(DEFAULT_THEME_ID);
    expect(getThemeConfig(undefined).id).toBe(DEFAULT_THEME_ID);
    expect(getThemeConfig("")).toBeTruthy();
    expect(getThemeConfig("")?.id).toBe(DEFAULT_THEME_ID);
  });
});

describe("isValidThemeId", () => {
  test("faqat ro'yxatdagi ID'lar uchun true qaytaradi", () => {
    expect(isValidThemeId("minimal")).toBe(true);
    expect(isValidThemeId("luxury")).toBe(true);
    expect(isValidThemeId("random-hacker-value")).toBe(false);
    expect(isValidThemeId(null)).toBe(false);
  });
});

describe("resolveThemeColors", () => {
  test("light va dark uchun mos rang to'plamini qaytaradi", () => {
    const light = resolveThemeColors("boldRed", false);
    const dark = resolveThemeColors("boldRed", true);
    expect(light).toEqual(getThemeConfig("boldRed").colors.light);
    expect(dark).toEqual(getThemeConfig("boldRed").colors.dark);
    expect(light.primary).not.toBe(dark.primary);
  });

  test("noto'g'ri tema ID'sida ham xavfsiz standart ranglarni qaytaradi", () => {
    expect(resolveThemeColors("mavjud-emas", false)).toEqual(getThemeConfig(DEFAULT_THEME_ID).colors.light);
  });
});

describe("getRecommendedThemeId — 15 soha uchun tavsiya (faqat tavsiya, cheklov emas)", () => {
  test("haqiqiy soha ID'si uchun mos, HAQIQATAN registrda mavjud temani tavsiya qiladi", () => {
    const recommended = getRecommendedThemeId("Kosmetika");
    expect(recommended).not.toBeNull();
    expect(isValidThemeId(recommended)).toBe(true);
  });

  test("noma'lum/bo'sh soha uchun null qaytaradi (majburlamaydi)", () => {
    expect(getRecommendedThemeId("mavjud-bolmagan-soha")).toBeNull();
    expect(getRecommendedThemeId(undefined)).toBeNull();
  });
});
