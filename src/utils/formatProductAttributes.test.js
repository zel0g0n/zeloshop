import { describe, test, expect } from "vitest";
import { formatProductAttributesForDisplay } from "./formatProductAttributes";

describe("formatProductAttributesForDisplay (15-NICHE UNIVERSAL PLATFORMA)", () => {
  test("attributes yo'q yoki noto'g'ri turdagi bo'lsa, bo'sh ro'yxat qaytaradi", () => {
    expect(formatProductAttributesForDisplay(undefined)).toEqual([]);
    expect(formatProductAttributesForDisplay(null)).toEqual([]);
    expect(formatProductAttributesForDisplay("noto'g'ri")).toEqual([]);
  });

  test("bo'sh/null qiymatlarni chiqarib tashlaydi", () => {
    const result = formatProductAttributesForDisplay({ brand: "Nivea", color: "", material: null });
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("brand");
  });

  test("'select' turidagi atribut uchun QIYMAT tarjima kalitini (valueKey) beradi", () => {
    const result = formatProductAttributesForDisplay({ skinType: "oily" });
    expect(result[0]).toEqual({
      key: "skinType",
      labelKey: "productAttributes.skinType.label",
      value: "oily",
      valueKey: "productAttributes.skinType.options.oily",
    });
  });

  test("'text'/'number' turidagi atribut uchun valueKey null - xom qiymat ko'rsatiladi", () => {
    const result = formatProductAttributesForDisplay({ volume: "50ml" });
    expect(result[0]).toEqual({
      key: "volume",
      labelKey: "productAttributes.volume.label",
      value: "50ml",
      valueKey: null,
    });
  });

  test("lug'atda mavjud bo'lmagan (noma'lum) kalit uchun ham xato bermaydi", () => {
    const result = formatProductAttributesForDisplay({ notanishKalit: "qiymat" });
    expect(result[0].valueKey).toBeNull();
  });
});
