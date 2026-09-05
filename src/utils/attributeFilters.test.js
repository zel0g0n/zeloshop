import { describe, test, expect } from "vitest";
import { buildAttributeFilterDefs } from "./attributeFilters";

describe("buildAttributeFilterDefs (15-NICHE UNIVERSAL PLATFORMA - dinamik filtrlar)", () => {
  test("Elektronika niche uchun, katalogda haqiqatan mavjud atributlarni topadi", () => {
    const products = [
      { id: "1", attributes: { brand: "Samsung", storage: "128GB" } },
      { id: "2", attributes: { brand: "Apple", storage: "256GB" } },
    ];
    const defs = buildAttributeFilterDefs("Elektronika", products);
    const keys = defs.map((d) => d.key);
    expect(keys).toContain("brand");
    expect(keys).toContain("storage");
  });

  test("faqat BITTA (yagona) qiymatga ega atributni filtr sifatida ko'rsatmaydi", () => {
    const products = [
      { id: "1", attributes: { brand: "Samsung" } },
      { id: "2", attributes: { brand: "Samsung" } },
    ];
    const defs = buildAttributeFilterDefs("Elektronika", products);
    expect(defs.find((d) => d.key === "brand")).toBeUndefined();
  });

  test("hech qanday mahsulotda qiymati yo'q atributni UMUMAN qo'shmaydi", () => {
    const products = [{ id: "1", attributes: {} }, { id: "2" }];
    const defs = buildAttributeFilterDefs("Elektronika", products);
    expect(defs).toEqual([]);
  });

  test("'select' turidagi atribut uchun FAQAT lug'atdagi haqiqiy variantlarni qaytaradi (o'ylab topilgan qiymat yo'q)", () => {
    const products = [
      { id: "1", attributes: { skinType: "oily" } },
      { id: "2", attributes: { skinType: "dry" } },
      { id: "3", attributes: { skinType: "notoгri-qiymat" } }, // lug'atda yo'q qiymat
    ];
    const defs = buildAttributeFilterDefs("Kosmetika", products);
    const skinTypeDef = defs.find((d) => d.key === "skinType");
    expect(skinTypeDef.options.map((o) => o.value).sort()).toEqual(["dry", "oily"]);
  });

  test("'text' turidagi atribut uchun katalogdagi HAQIQIY qiymatlarni alifbo tartibida qaytaradi", () => {
    const products = [
      { id: "1", attributes: { brand: "Nivea" } },
      { id: "2", attributes: { brand: "Nike" } },
    ];
    const defs = buildAttributeFilterDefs("Kosmetika", products);
    const brandDef = defs.find((d) => d.key === "brand");
    expect(brandDef.options.map((o) => o.value)).toEqual(["Nike", "Nivea"]);
  });

  test("mahsulotlar ro'yxati bo'sh yoki noto'g'ri turdagi bo'lsa, xato bermay bo'sh ro'yxat qaytaradi", () => {
    expect(buildAttributeFilterDefs("Kosmetika", [])).toEqual([]);
    expect(buildAttributeFilterDefs("Kosmetika", undefined)).toEqual([]);
  });

  test("mavjud bo'lmagan niche uchun ('Boshqa' zaxirasiga tushadi) xato bermaydi", () => {
    expect(() => buildAttributeFilterDefs("notanish-niche", [{ attributes: { brand: "X" } }])).not.toThrow();
  });
});
