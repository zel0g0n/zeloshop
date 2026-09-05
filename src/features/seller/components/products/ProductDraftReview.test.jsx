import { describe, test, expect } from "vitest";
import { matchClosestCategory } from "./ProductDraftReview";

const CATEGORIES = [
  { value: "Skincare", label: "Skincare (Krem, Serum)" },
  { value: "Makeup", label: "Makeup (Kosmetika)" },
  { value: "Perfume", label: "Perfume (Atirlar)" },
];

describe("matchClosestCategory", () => {
  test("aniq mos kelgan kategoriyani topadi", () => {
    expect(matchClosestCategory("Skincare", CATEGORIES)).toBe("Skincare");
  });

  test("katta-kichik harfga sezgir emas", () => {
    expect(matchClosestCategory("makeup", CATEGORIES)).toBe("Makeup");
  });

  test("qisman mos kelishini ham topadi (substring)", () => {
    expect(matchClosestCategory("Perfume va atir mahsulotlari", CATEGORIES)).toBe("Perfume");
  });

  test("hech biri mos kelmasa, birinchi kategoriyaga qaytadi (bo'sh qolmaydi)", () => {
    expect(matchClosestCategory("Mutlaqo notanish narsa", CATEGORIES)).toBe("Skincare");
  });

  test("AI kategoriya taklif qilmagan (null) bo'lsa ham, birinchisiga qaytadi", () => {
    expect(matchClosestCategory(null, CATEGORIES)).toBe("Skincare");
  });

  test("kategoriyalar ro'yxati bo'sh bo'lsa, bo'sh satr qaytaradi (xato bermaydi)", () => {
    expect(matchClosestCategory("Skincare", [])).toBe("");
  });
});
