import { describe, test, expect } from "vitest";
import { applyCategoryCustomization, getEffectiveCategoriesForStore } from "./categoryCustomization";

const BASE = [
  { value: "Yuz parvarishi", label: "Yuz parvarishi (Skincare)" },
  { value: "Dekorativ kosmetika", label: "Dekorativ kosmetika (Makeup)" },
  { value: "Parfyumeriya", label: "Parfyumeriya (Perfume)" },
];

describe("applyCategoryCustomization (sotuvchi darajasidagi kategoriya moslashtirish)", () => {
  test("moslashtirish umuman berilmasa - bazaviy ro'yxat o'zgarishsiz qaytadi", () => {
    expect(applyCategoryCustomization(BASE, undefined)).toEqual(BASE);
    expect(applyCategoryCustomization(BASE, null)).toEqual(BASE);
    expect(applyCategoryCustomization(BASE, {})).toEqual(BASE);
  });

  test("bazaviy ro'yxat massiv bo'lmasa/yo'q bo'lsa - xato bermaydi, bo'sh ro'yxat qaytaradi", () => {
    expect(applyCategoryCustomization(undefined, {})).toEqual([]);
    expect(applyCategoryCustomization(null, {})).toEqual([]);
  });

  test("YASHIRISH: hiddenValues'dagi kategoriya natijaga UMUMAN kiritilmaydi", () => {
    const result = applyCategoryCustomization(BASE, { hiddenValues: ["Parfyumeriya"] });
    expect(result.map((c) => c.value)).not.toContain("Parfyumeriya");
    expect(result).toHaveLength(2);
  });

  test("NOM O'ZGARTIRISH: FAQAT label o'zgaradi, value (mavjud mahsulotlar bog'langan qiymat) O'ZGARMAYDI", () => {
    const result = applyCategoryCustomization(BASE, { renamedLabels: { "Yuz parvarishi": "Premium teri parvarishi" } });
    const renamed = result.find((c) => c.value === "Yuz parvarishi");
    expect(renamed.label).toBe("Premium teri parvarishi");
    expect(renamed.value).toBe("Yuz parvarishi"); // MUHIM: value o'zgarmagan
  });

  test("CUSTOM KATEGORIYA: niche ro'yxatida yo'q, sotuvchi qo'shgan kategoriya ro'yxatga QO'SHILADI", () => {
    const result = applyCategoryCustomization(BASE, { customCategories: [{ value: "Luxury Skincare", label: "Luxury Skincare" }] });
    expect(result.map((c) => c.value)).toContain("Luxury Skincare");
    expect(result).toHaveLength(4);
  });

  test("CUSTOM KATEGORIYA: agar bazaviy ro'yxatda ALLAQACHON shu value mavjud bo'lsa - TAKROR qo'shilmaydi (bazaviy versiya saqlanadi)", () => {
    const result = applyCategoryCustomization(BASE, { customCategories: [{ value: "Parfyumeriya", label: "Boshqacha nom" }] });
    expect(result).toHaveLength(3); // takror qo'shilmadi
    expect(result.find((c) => c.value === "Parfyumeriya").label).toBe("Parfyumeriya (Perfume)"); // bazaviy label saqlangan
  });

  test("TARTIB: sotuvchi tanlagan tartibda qaytaradi", () => {
    const result = applyCategoryCustomization(BASE, { order: ["Parfyumeriya", "Yuz parvarishi", "Dekorativ kosmetika"] });
    expect(result.map((c) => c.value)).toEqual(["Parfyumeriya", "Yuz parvarishi", "Dekorativ kosmetika"]);
  });

  test("TARTIB: `order`da YO'Q (masalan yangi qo'shilgan) kategoriya - ro'yxat OXIRIGA, asl tartibda qo'shiladi", () => {
    const result = applyCategoryCustomization(BASE, { order: ["Dekorativ kosmetika"] });
    expect(result.map((c) => c.value)).toEqual(["Dekorativ kosmetika", "Yuz parvarishi", "Parfyumeriya"]);
  });

  test("HAMMASI BIRGA: yashirish + nom o'zgartirish + custom qo'shish + tartiblash BIR VAQTDA to'g'ri ishlaydi", () => {
    const result = applyCategoryCustomization(BASE, {
      hiddenValues: ["Dekorativ kosmetika"],
      renamedLabels: { "Yuz parvarishi": "Premium teri parvarishi" },
      customCategories: [{ value: "Luxury Skincare", label: "Luxury Skincare" }],
      order: ["Luxury Skincare", "Parfyumeriya", "Yuz parvarishi"],
    });
    expect(result).toEqual([
      { value: "Luxury Skincare", label: "Luxury Skincare" },
      { value: "Parfyumeriya", label: "Parfyumeriya (Perfume)" },
      { value: "Yuz parvarishi", label: "Premium teri parvarishi" },
    ]);
  });

  test("yashirilgan kategoriyaga oid MAVJUD mahsulot ma'lumoti buzilmaydi (bu funksiya faqat KO'RSATISH ro'yxatini boshqaradi, product.category'ga tegmaydi)", () => {
    // Bu test ataylab hujjatli: funksiya faqat {value,label}[] qaytaradi,
    // Firestore'dagi mahsulot hujjatlariga HECH QANDAY yozuv qilmaydi.
    const result = applyCategoryCustomization(BASE, { hiddenValues: ["Yuz parvarishi"] });
    expect(result.some((c) => c.value === "Yuz parvarishi")).toBe(false);
    // "Yuz parvarishi" qiymati o'zi esa hech qayerda o'zgartirilmadi/o'chirilmadi - faqat shu ro'yxatdan chetlatildi.
  });
});

describe("getEffectiveCategoriesForStore", () => {
  test("`store` yo'q/bo'sh bo'lsa ham xato bermaydi ('Boshqa' zaxirasiga tushadi)", () => {
    expect(() => getEffectiveCategoriesForStore(null)).not.toThrow();
    expect(getEffectiveCategoriesForStore(null).length).toBeGreaterThan(0);
  });

  test("store.category bo'yicha TO'G'RI niche'ning kategoriyalarini oladi va moslashtirishni qo'llaydi", () => {
    const store = {
      category: "Kosmetika",
      categoryCustomization: { hiddenValues: ["Parfyumeriya"], customCategories: [{ value: "Luxury Skincare", label: "Luxury Skincare" }] },
    };
    const result = getEffectiveCategoriesForStore(store);
    expect(result.map((c) => c.value)).toContain("Yuz parvarishi"); // Kosmetika'ning bazaviy kategoriyasi
    expect(result.map((c) => c.value)).not.toContain("Parfyumeriya"); // yashirilgan
    expect(result.map((c) => c.value)).toContain("Luxury Skincare"); // custom qo'shilgan
  });

  test("categoryCustomization umuman yo'q sotuvchi uchun - oddiy niche kategoriyalari (orqaga moslik, mavjud sotuvchilar UCHUN xatti-harakat o'zgarmaydi)", () => {
    const result = getEffectiveCategoriesForStore({ category: "Kosmetika" });
    expect(result).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: "Yuz parvarishi" })])
    );
  });
});
