import { describe, test, expect } from "vitest";
import { pickCheckoutCrossSell } from "./checkoutCrossSell";

describe("pickCheckoutCrossSell", () => {
  test("savat bo'sh bo'lsa - bo'sh natija, basis 'none'", () => {
    expect(pickCheckoutCrossSell([{ id: "1" }], [])).toEqual({ items: [], basis: "none" });
  });

  test("allProducts massiv bo'lmasa - bo'sh natija", () => {
    expect(pickCheckoutCrossSell(null, [{ id: "cart1" }])).toEqual({ items: [], basis: "none" });
  });

  test("savatdagi mahsulotni O'ZINI natijaga qo'shmaydi", () => {
    const cart = [{ id: "cart1", category: "Skincare" }];
    const allProducts = [
      { id: "cart1", category: "Skincare" },
      { id: "other", category: "Skincare", isActive: true, stock: 5 },
    ];
    const result = pickCheckoutCrossSell(allProducts, cart);
    expect(result.items.map((p) => p.id)).not.toContain("cart1");
  });

  test("HAQIQIY birga-sotib-olingan ma'lumoti (yetarli sondagi) bo'lsa - shuni ishlatadi", () => {
    const cart = [{ id: "cart1", category: "Skincare" }];
    const allProducts = [
      { id: "cart1", category: "Skincare", frequentlyBoughtWith: [{ productId: "co1", count: 5 }, { productId: "co2", count: 2 }] },
      { id: "co1", category: "Boshqa", isActive: true, stock: 5 },
      { id: "co2", category: "Boshqa", isActive: true, stock: 5 },
      { id: "sameCategoryNoSignal", category: "Skincare", averageRating: 5, isActive: true, stock: 5 },
    ];
    const result = pickCheckoutCrossSell(allProducts, cart);
    expect(result.basis).toBe("cooccurrence");
    expect(result.items.map((p) => p.id)).toEqual(["co1", "co2"]);
  });

  test("SAVATDAGI BIRDAN ORTIQ mahsulotning cooccurrence signali YIG'ILADI (bitta mahsulotda kam bo'lsa ham, ikkalasi birga yetarli bo'lishi mumkin)", () => {
    const cart = [
      { id: "cart1", category: "Skincare", frequentlyBoughtWith: [{ productId: "co1", count: 1 }] },
      { id: "cart2", category: "Skincare", frequentlyBoughtWith: [{ productId: "co1", count: 1 }] },
    ];
    const allProducts = [
      ...cart,
      { id: "co1", category: "Boshqa", isActive: true, stock: 5 },
    ];
    const result = pickCheckoutCrossSell(allProducts, cart);
    expect(result.basis).toBe("cooccurrence");
    expect(result.items.map((p) => p.id)).toEqual(["co1"]);
  });

  test("cooccurrence natijasida savatda ALLAQACHON bor mahsulot chetlab o'tiladi", () => {
    const cart = [
      { id: "cart1", category: "Skincare", frequentlyBoughtWith: [{ productId: "cart2", count: 5 }] },
      { id: "cart2", category: "Skincare" },
    ];
    const allProducts = [...cart];
    const result = pickCheckoutCrossSell(allProducts, cart);
    expect(result.items).toEqual([]);
  });

  test("cooccurrence signali CHEGARADAN PAST bo'lsa - kategoriya zaxirasiga o'tadi", () => {
    const cart = [{ id: "cart1", category: "Skincare", frequentlyBoughtWith: [{ productId: "co1", count: 1 }] }];
    const allProducts = [
      ...cart,
      { id: "co1", category: "Boshqa", isActive: true, stock: 5 },
      { id: "sameCategory", category: "Skincare", averageRating: 4, isActive: true, stock: 5 },
    ];
    const result = pickCheckoutCrossSell(allProducts, cart);
    expect(result.basis).toBe("category");
    expect(result.items.map((p) => p.id)).toEqual(["sameCategory"]);
  });

  test("kategoriya zaxirasi - reyting bo'yicha tartiblanadi", () => {
    const cart = [{ id: "cart1", category: "Skincare" }];
    const allProducts = [
      ...cart,
      { id: "low", category: "Skincare", averageRating: 3.5, isActive: true, stock: 5 },
      { id: "high", category: "Skincare", averageRating: 4.9, isActive: true, stock: 5 },
    ];
    const result = pickCheckoutCrossSell(allProducts, cart);
    expect(result.basis).toBe("category");
    expect(result.items.map((p) => p.id)).toEqual(["high", "low"]);
  });

  test("bir nechta kategoriyadagi mahsulotlar savatda bo'lsa - IKKALASI HAM hisobga olinadi", () => {
    const cart = [
      { id: "cart1", category: "Skincare" },
      { id: "cart2", category: "Makeup" },
    ];
    const allProducts = [
      ...cart,
      { id: "sk", category: "Skincare", isActive: true, stock: 5 },
      { id: "mk", category: "Makeup", isActive: true, stock: 5 },
      { id: "other", category: "Boshqa", isActive: true, stock: 5 },
    ];
    const result = pickCheckoutCrossSell(allProducts, cart);
    expect(result.items.map((p) => p.id).sort()).toEqual(["mk", "sk"]);
  });

  test("OMBORDA yo'q (stock=0) yoki NOFAOL mahsulotlarni ko'rsatmaydi", () => {
    const cart = [{ id: "cart1", category: "Skincare" }];
    const allProducts = [
      ...cart,
      { id: "outOfStock", category: "Skincare", stock: 0, isActive: true },
      { id: "inactive", category: "Skincare", stock: 5, isActive: false },
      { id: "ok", category: "Skincare", stock: 5, isActive: true },
    ];
    const result = pickCheckoutCrossSell(allProducts, cart);
    expect(result.items.map((p) => p.id)).toEqual(["ok"]);
  });

  test("hech qanday o'xshash/hamroh mahsulot topilmasa - basis 'none'", () => {
    const cart = [{ id: "cart1", category: "Skincare" }];
    const allProducts = [...cart, { id: "other", category: "Boshqa", isActive: true, stock: 5 }];
    expect(pickCheckoutCrossSell(allProducts, cart)).toEqual({ items: [], basis: "none" });
  });

  test("maxResults chegarasini hurmat qiladi", () => {
    const cart = [{ id: "cart1", category: "Skincare" }];
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, category: "Skincare", averageRating: i, isActive: true, stock: 5 }));
    const allProducts = [...cart, ...many];
    const result = pickCheckoutCrossSell(allProducts, cart, { maxResults: 3 });
    expect(result.items).toHaveLength(3);
  });

  test("savat elementi jonli ro'yxatda topilmasa (masalan mahsulot o'chirilgan) - savatning O'ZI saqlagan (eskirgan) ma'lumotidan foydalanadi", () => {
    const cart = [{ id: "deleted", category: "Skincare", frequentlyBoughtWith: [{ productId: "co1", count: 5 }] }];
    // "deleted" endi allProducts'da YO'Q (mahsulot o'chirilgan)
    const allProducts = [{ id: "co1", category: "Boshqa", isActive: true, stock: 5 }];
    const result = pickCheckoutCrossSell(allProducts, cart);
    expect(result.basis).toBe("cooccurrence");
    expect(result.items.map((p) => p.id)).toEqual(["co1"]);
  });

  describe("15-NICHE UNIVERSAL PLATFORMA: 3-daraja - niche 'recommendations' (bog'liq kategoriya) zaxirasi", () => {
    const cartDecorative = [{ id: "cart1", category: "Dekorativ kosmetika" }];

    test("cooccurrence VA bir xil kategoriya signali bo'lmasa, lekin niche'da BOG'LIQ kategoriya bo'lsa - o'shani ishlatadi", () => {
      const allProducts = [
        ...cartDecorative,
        { id: "brush1", category: "Asboblar va aksessuarlar", averageRating: 4.2, isActive: true, stock: 5 },
      ];
      const result = pickCheckoutCrossSell(allProducts, cartDecorative, { nicheId: "Kosmetika" });
      expect(result.basis).toBe("relatedCategory");
      expect(result.items.map((p) => p.id)).toEqual(["brush1"]);
    });

    test("savatdagi BIRDAN ORTIQ kategoriyaning bog'liqlari BIRLASHTIRILADI", () => {
      const cart = [
        { id: "cart1", category: "Dekorativ kosmetika" },
        { id: "cart2", category: "Soch parvarishi" },
      ];
      const allProducts = [
        ...cart,
        { id: "brush1", category: "Asboblar va aksessuarlar", isActive: true, stock: 5 },
        { id: "bodyLotion", category: "Tana parvarishi", isActive: true, stock: 5 },
      ];
      const result = pickCheckoutCrossSell(allProducts, cart, { nicheId: "Kosmetika" });
      expect(result.basis).toBe("relatedCategory");
      expect(result.items.map((p) => p.id).sort()).toEqual(["bodyLotion", "brush1"]);
    });

    test("nicheId berilmasa - xatosiz 'none'ga qaytadi", () => {
      const allProducts = [...cartDecorative, { id: "brush1", category: "Asboblar va aksessuarlar", isActive: true, stock: 5 }];
      expect(pickCheckoutCrossSell(allProducts, cartDecorative)).toEqual({ items: [], basis: "none" });
    });

    test("bir xil kategoriyada mahsulot BOR bo'lsa - bog'liq kategoriya zaxirasiga UMUMAN o'tmaydi (2-daraja ustuvor)", () => {
      const allProducts = [
        ...cartDecorative,
        { id: "sameCategory", category: "Dekorativ kosmetika", averageRating: 4, isActive: true, stock: 5 },
        { id: "relatedButUnused", category: "Asboblar va aksessuarlar", averageRating: 5, isActive: true, stock: 5 },
      ];
      const result = pickCheckoutCrossSell(allProducts, cartDecorative, { nicheId: "Kosmetika" });
      expect(result.basis).toBe("category");
      expect(result.items.map((p) => p.id)).toEqual(["sameCategory"]);
    });
  });
});
