import { describe, test, expect } from "vitest";
import { pickRelatedProducts } from "./productRecommendations";

const CURRENT = { id: "cur", category: "Skincare" };

describe("pickRelatedProducts", () => {
  test("currentProduct yo'q bo'lsa - bo'sh natija, basis 'none'", () => {
    expect(pickRelatedProducts([], null)).toEqual({ items: [], basis: "none" });
  });

  test("hech qanday o'xshash mahsulot topilmasa - basis 'none'", () => {
    const products = [{ id: "1", category: "Boshqa" }];
    expect(pickRelatedProducts(products, CURRENT)).toEqual({ items: [], basis: "none" });
  });

  test("joriy mahsulotning O'ZINI natijaga qo'shmaydi", () => {
    const products = [{ ...CURRENT }, { id: "2", category: "Skincare", isActive: true, stock: 5 }];
    const result = pickRelatedProducts(products, CURRENT);
    expect(result.items.map((p) => p.id)).not.toContain("cur");
  });

  test("bir xil kategoriyadagi mahsulotlarni reyting bo'yicha (yuqoridan pastga) tartiblaydi", () => {
    const products = [
      { id: "low", category: "Skincare", averageRating: 3.5, reviewCount: 10, isActive: true, stock: 5 },
      { id: "high", category: "Skincare", averageRating: 4.9, reviewCount: 20, isActive: true, stock: 5 },
    ];
    const result = pickRelatedProducts(products, CURRENT);
    expect(result.basis).toBe("category");
    expect(result.items.map((p) => p.id)).toEqual(["high", "low"]);
  });

  test("bir xil reytingda - sharh soni ko'prog'i oldinda", () => {
    const products = [
      { id: "fewReviews", category: "Skincare", averageRating: 4.5, reviewCount: 3, isActive: true, stock: 5 },
      { id: "manyReviews", category: "Skincare", averageRating: 4.5, reviewCount: 30, isActive: true, stock: 5 },
    ];
    const result = pickRelatedProducts(products, CURRENT);
    expect(result.items.map((p) => p.id)).toEqual(["manyReviews", "fewReviews"]);
  });

  test("BOSHQA kategoriyadagi mahsulotlarni chetlab o'tadi", () => {
    const products = [{ id: "other", category: "Makeup", isActive: true, stock: 5 }];
    expect(pickRelatedProducts(products, CURRENT).items).toEqual([]);
  });

  test("OMBORDA yo'q (stock=0) yoki NOFAOL mahsulotlarni ko'rsatmaydi", () => {
    const products = [
      { id: "outOfStock", category: "Skincare", stock: 0, isActive: true },
      { id: "inactive", category: "Skincare", stock: 5, isActive: false },
      { id: "ok", category: "Skincare", stock: 5, isActive: true },
    ];
    const result = pickRelatedProducts(products, CURRENT);
    expect(result.items.map((p) => p.id)).toEqual(["ok"]);
  });

  test("HAQIQIY birga-sotib-olingan ma'lumoti (yetarli sondagi) bo'lsa - kategoriya zaxirasi o'rniga O'SHANI ishlatadi", () => {
    const currentWithCooccurrence = { ...CURRENT, frequentlyBoughtWith: [{ productId: "co1", count: 5 }, { productId: "co2", count: 2 }] };
    const products = [
      { id: "co1", category: "Boshqa", isActive: true, stock: 5 }, // kategoriyasi FARQLI bo'lsa ham, real signal ustuvor
      { id: "co2", category: "Boshqa", isActive: true, stock: 5 },
      { id: "sameCategoryButNoSignal", category: "Skincare", averageRating: 5, isActive: true, stock: 5 },
    ];
    const result = pickRelatedProducts(products, currentWithCooccurrence);
    expect(result.basis).toBe("cooccurrence");
    expect(result.items.map((p) => p.id)).toEqual(["co1", "co2"]); // count bo'yicha tartiblangan
  });

  test("birga-sotib-olingan ma'lumoti bor, lekin CHEGARADAN PAST (count=1, tasodifiy bo'lishi mumkin) - e'tiborga OLINMAYDI, kategoriya zaxirasiga o'tadi", () => {
    const currentWithWeakSignal = { ...CURRENT, frequentlyBoughtWith: [{ productId: "co1", count: 1 }] };
    const products = [
      { id: "co1", category: "Boshqa", isActive: true, stock: 5 },
      { id: "sameCategory", category: "Skincare", averageRating: 4, isActive: true, stock: 5 },
    ];
    const result = pickRelatedProducts(products, currentWithWeakSignal);
    expect(result.basis).toBe("category");
    expect(result.items.map((p) => p.id)).toEqual(["sameCategory"]);
  });

  test("maxResults chegarasini hurmat qiladi", () => {
    const products = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, category: "Skincare", averageRating: i, isActive: true, stock: 5 }));
    const result = pickRelatedProducts(products, CURRENT, { maxResults: 3 });
    expect(result.items).toHaveLength(3);
  });

  describe("15-NICHE UNIVERSAL PLATFORMA: 3-daraja - niche 'recommendations' (bog'liq kategoriya) zaxirasi", () => {
    const currentDecorative = { id: "cur", category: "Dekorativ kosmetika" };

    test("bir xil kategoriyada VA birga-sotib-olingan signalida hech narsa yo'q, lekin niche'da BOG'LIQ kategoriya bo'lsa - o'shani ishlatadi", () => {
      const products = [
        { id: "brush1", category: "Asboblar va aksessuarlar", averageRating: 4.2, isActive: true, stock: 5 },
        { id: "other", category: "Soch parvarishi", isActive: true, stock: 5 },
      ];
      const result = pickRelatedProducts(products, currentDecorative, { nicheId: "Kosmetika" });
      expect(result.basis).toBe("relatedCategory");
      expect(result.items.map((p) => p.id)).toEqual(["brush1"]);
    });

    test("bog'liq kategoriyadagi mahsulotlarni ham reyting/sharh bo'yicha tartiblaydi", () => {
      const products = [
        { id: "low", category: "Asboblar va aksessuarlar", averageRating: 3.0, isActive: true, stock: 5 },
        { id: "high", category: "Asboblar va aksessuarlar", averageRating: 4.8, isActive: true, stock: 5 },
      ];
      const result = pickRelatedProducts(products, currentDecorative, { nicheId: "Kosmetika" });
      expect(result.items.map((p) => p.id)).toEqual(["high", "low"]);
    });

    test("nicheId berilmasa (masalan eski/aniqlanmagan do'kon) - xatosiz 'none'ga qaytadi", () => {
      const products = [{ id: "brush1", category: "Asboblar va aksessuarlar", isActive: true, stock: 5 }];
      const result = pickRelatedProducts(products, currentDecorative);
      expect(result).toEqual({ items: [], basis: "none" });
    });

    test("bog'liq kategoriyada ham OMBORDA yo'q/nofaol mahsulotlarni chetlab o'tadi", () => {
      const products = [{ id: "outOfStock", category: "Asboblar va aksessuarlar", stock: 0, isActive: true }];
      const result = pickRelatedProducts(products, currentDecorative, { nicheId: "Kosmetika" });
      expect(result).toEqual({ items: [], basis: "none" });
    });

    test("bir xil kategoriyada mahsulot BOR bo'lsa - bog'liq kategoriya zaxirasiga UMUMAN o'tmaydi (2-daraja ustuvor)", () => {
      const products = [
        { id: "sameCategory", category: "Dekorativ kosmetika", averageRating: 4, isActive: true, stock: 5 },
        { id: "relatedButUnused", category: "Asboblar va aksessuarlar", averageRating: 5, isActive: true, stock: 5 },
      ];
      const result = pickRelatedProducts(products, currentDecorative, { nicheId: "Kosmetika" });
      expect(result.basis).toBe("category");
      expect(result.items.map((p) => p.id)).toEqual(["sameCategory"]);
    });
  });
});
