/**
 * `lib/dynamicPricing.js`ning SOF narx-tavsiyasi mantig'i uchun
 * testlar. MUHIM E'TIBOR: (1) hech qanday signal bo'lmasa `null`
 * qaytarishi ("har bir mahsulot uchun majburiy tavsiya yo'q"), (2)
 * tannarx-chegarasi hech qachon buzilmasligi (zarar bilan sotishni
 * hech qachon tavsiya qilmasligi), (3) ikkala tur (chegirma/oshirish)
 * to'g'ri signaldan to'g'ri hisoblanishi.
 */
const {
  computePricingSuggestion,
  computeMinAllowedPrice,
  daysSinceCreated,
  roundToNearestHundred,
  buildCategoryPriceIndex,
  getCategoryPriceContext,
  SLOW_MOVER_MIN_AGE_DAYS,
  CATEGORY_MIN_SAMPLE_SIZE,
} = require("../lib/dynamicPricing");

const NOW = new Date("2026-09-02T00:00:00Z").getTime();
const daysAgoIso = (days) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

describe("roundToNearestHundred", () => {
  test("yaqin 100 so'mga yaxlitlaydi", () => {
    expect(roundToNearestHundred(45230)).toBe(45200);
    expect(roundToNearestHundred(45260)).toBe(45300);
  });
  test("manfiy natijani 0ga cheklaydi", () => {
    expect(roundToNearestHundred(-500)).toBe(0);
  });
});

describe("daysSinceCreated", () => {
  test("ISO satrdan to'g'ri kun sonini hisoblaydi", () => {
    expect(daysSinceCreated(daysAgoIso(20), NOW)).toBe(20);
  });
  test("bo'sh/noto'g'ri qiymatda 0 qaytaradi (yangi deb hisoblanadi)", () => {
    expect(daysSinceCreated(null, NOW)).toBe(0);
    expect(daysSinceCreated("noto'g'ri-sana", NOW)).toBe(0);
    expect(daysSinceCreated(undefined, NOW)).toBe(0);
  });
  test("kelajakdagi sanada 0 qaytaradi (soat farqi kabi anomaliyalardan himoya)", () => {
    expect(daysSinceCreated(new Date(NOW + 1000000).toISOString(), NOW)).toBe(0);
  });
});

describe("computeMinAllowedPrice", () => {
  test("costPrice berilmasa/0 bo'lsa, chegara yo'q (`null`)", () => {
    expect(computeMinAllowedPrice(0)).toBeNull();
    expect(computeMinAllowedPrice(null)).toBeNull();
  });
  test("costPrice asosida, MIN_MARGIN_PERCENT (10%) qo'shilgan eng past narxni qaytaradi", () => {
    expect(computeMinAllowedPrice(10000)).toBe(11000);
  });
});

describe("computePricingSuggestion", () => {
  test("hech qanday aniq signal bo'lmasa - null qaytaradi (oddiy, 'sog'lom' mahsulot)", () => {
    const result = computePricingSuggestion(
      { price: 50000, costPrice: 30000, stock: 20, sold: 5, createdAt: daysAgoIso(5) },
      NOW
    );
    expect(result).toBeNull();
  });

  test("narx 0/berilmagan bo'lsa - null qaytaradi", () => {
    expect(computePricingSuggestion({ price: 0, stock: 10, sold: 0 }, NOW)).toBeNull();
  });

  describe("sekin sotiladigan mahsulot -> chegirma tavsiyasi", () => {
    test("shartlar to'liq bajarilganda, to'g'ri chegirma tavsiyasini qaytaradi", () => {
      const result = computePricingSuggestion(
        { price: 50000, costPrice: 20000, stock: 15, sold: 1, createdAt: daysAgoIso(SLOW_MOVER_MIN_AGE_DAYS + 1) },
        NOW
      );
      expect(result).not.toBeNull();
      expect(result.type).toBe("slow_mover_discount");
      expect(result.suggestedPrice).toBeLessThan(result.currentPrice);
      expect(result.changePercent).toBeLessThan(0);
    });

    test("hali YETARLICHA UZOQ vaqt o'tmagan bo'lsa (yangi mahsulot) - tavsiya YO'Q", () => {
      const result = computePricingSuggestion(
        { price: 50000, costPrice: 20000, stock: 15, sold: 0, createdAt: daysAgoIso(3) },
        NOW
      );
      expect(result).toBeNull();
    });

    test("zaxira ALLAQACHON kam qolgan bo'lsa (deyarli tugagan) - chegirma tavsiya qilinmaydi", () => {
      const result = computePricingSuggestion(
        { price: 50000, costPrice: 20000, stock: 2, sold: 1, createdAt: daysAgoIso(30) },
        NOW
      );
      expect(result).toBeNull();
    });

    test("tannarx narxga JUDA YAQIN bo'lsa - margin-chegarasi butun chegirmani 'yeb qo'yadi', tavsiya YO'Q", () => {
      // 50000 narx, 12% chegirma -> ~44000, lekin tannarx 46000 bo'lsa,
      // min ruxsat etilgan narx 50600 (46000*1.1) - bu asl narxdan HAM
      // BALAND, ya'ni haqiqiy pasaytirish UMUMAN qolmaydi.
      const result = computePricingSuggestion(
        { price: 50000, costPrice: 46000, stock: 15, sold: 1, createdAt: daysAgoIso(30) },
        NOW
      );
      expect(result).toBeNull();
    });

    test("tannarx narxdan biroz past bo'lsa - margin-chegarasi taklif qilingan chegirmani KICHRAYTIRADI (yo'q qilmaydi)", () => {
      const result = computePricingSuggestion(
        { price: 50000, costPrice: 45000, stock: 15, sold: 1, createdAt: daysAgoIso(30) },
        NOW
      );
      expect(result).not.toBeNull();
      expect(result.suggestedPrice).toBe(49500); // 45000*1.1, kichikroq chegirma
    });

    test("tannarx BERILMAGAN bo'lsa ham (0), oddiy chegirma tavsiya qilinadi", () => {
      const result = computePricingSuggestion(
        { price: 50000, costPrice: 0, stock: 15, sold: 0, createdAt: daysAgoIso(30) },
        NOW
      );
      expect(result).not.toBeNull();
      expect(result.suggestedPrice).toBe(44000);
    });
  });

  describe("yuqori talab / kam zaxira -> narx oshirish tavsiyasi", () => {
    test("shartlar to'liq bajarilganda, to'g'ri narx-oshirish tavsiyasini qaytaradi", () => {
      const result = computePricingSuggestion({ price: 50000, stock: 3, sold: 25, createdAt: daysAgoIso(40) }, NOW);
      expect(result).not.toBeNull();
      expect(result.type).toBe("high_demand_increase");
      expect(result.suggestedPrice).toBeGreaterThan(result.currentPrice);
      expect(result.changePercent).toBeGreaterThan(0);
    });

    test("zaxira tugab qolgan (0) bo'lsa - tavsiya YO'Q (allaqachon sotib bo'lmaydi, narx oshirish mazmunsiz)", () => {
      const result = computePricingSuggestion({ price: 50000, stock: 0, sold: 25, createdAt: daysAgoIso(40) }, NOW);
      expect(result).toBeNull();
    });

    test("kam zaxira, lekin sotilgan soni YETARLI EMAS (haqiqiy talab isboti yo'q) - tavsiya YO'Q", () => {
      const result = computePricingSuggestion({ price: 50000, stock: 3, sold: 4, createdAt: daysAgoIso(40) }, NOW);
      expect(result).toBeNull();
    });

    test("narx oshishi hech qachon MAX_PRICE_CHANGE_PERCENT (20%)dan oshmaydi", () => {
      const result = computePricingSuggestion({ price: 10000, stock: 1, sold: 500, createdAt: daysAgoIso(100) }, NOW);
      expect(result.suggestedPrice).toBeLessThanOrEqual(12000);
    });
  });

  describe("kategoriya bo'yicha solishtiruv -> narxni moslashtirish tavsiyasi (#115)", () => {
    const HEALTHY = { price: 50000, costPrice: 0, stock: 20, sold: 5, createdAt: daysAgoIso(5) }; // na sekin-sotiladi, na yuqori-talab

    test("narx kategoriya o'rtachasidan SEZILARLI YUQORI bo'lsa - pasaytirish tavsiya qilinadi", () => {
      const result = computePricingSuggestion(
        { ...HEALTHY, price: 80000 },
        NOW,
        { avgPrice: 50000, sampleSize: 5 } // 80000 - 50000dan 60% yuqori (>= 25% chegara)
      );
      expect(result).not.toBeNull();
      expect(result.type).toBe("category_price_high");
      expect(result.suggestedPrice).toBeLessThan(80000);
      expect(result.categoryAvgPrice).toBe(50000);
      expect(result.categorySampleSize).toBe(5);
    });

    test("narx kategoriya o'rtachasidan SEZILARLI PAST bo'lsa - oshirish tavsiya qilinadi", () => {
      const result = computePricingSuggestion(
        { ...HEALTHY, price: 30000 },
        NOW,
        { avgPrice: 50000, sampleSize: 5 } // 30000 - 50000dan 40% past
      );
      expect(result).not.toBeNull();
      expect(result.type).toBe("category_price_low");
      expect(result.suggestedPrice).toBeGreaterThan(30000);
    });

    test("farq CHEGARADAN (25%) kam bo'lsa - tavsiya YO'Q (oddiy tafovut, asos emas)", () => {
      const result = computePricingSuggestion(
        { ...HEALTHY, price: 55000 }, // 50000dan atigi 10% yuqori
        NOW,
        { avgPrice: 50000, sampleSize: 5 }
      );
      expect(result).toBeNull();
    });

    test("namuna hajmi CATEGORY_MIN_SAMPLE_SIZEdan kam bo'lsa - tavsiya YO'Q (statistik ishonchsiz)", () => {
      const result = computePricingSuggestion(
        { ...HEALTHY, price: 80000 },
        NOW,
        { avgPrice: 50000, sampleSize: CATEGORY_MIN_SAMPLE_SIZE - 1 }
      );
      expect(result).toBeNull();
    });

    test("categoryContext berilmagan (null) bo'lsa - tavsiya YO'Q, xato bermaydi", () => {
      const result = computePricingSuggestion({ ...HEALTHY, price: 80000 }, NOW, null);
      expect(result).toBeNull();
    });

    test("zaxira TUGAGAN (stock: 0) bo'lsa - kategoriya tavsiyasi ham berilmaydi (narx o'zgarishi mazmunsiz)", () => {
      const result = computePricingSuggestion(
        { ...HEALTHY, price: 80000, stock: 0 },
        NOW,
        { avgPrice: 50000, sampleSize: 5 }
      );
      expect(result).toBeNull();
    });

    test("SLOW_MOVER yoki HIGH_DEMAND signali BOR bo'lsa - ular USTUVOR, kategoriya tavsiyasi e'tiborga olinmaydi", () => {
      // Bir vaqtning o'zida ham "sekin sotiladi", ham narxi kategoriya
      // o'rtachasidan yuqori - kuchliroq, xatti-harakatga asoslangan
      // signal (sotilgan/zaxira) g'alaba qiladi.
      const result = computePricingSuggestion(
        { price: 80000, costPrice: 0, stock: 15, sold: 1, createdAt: daysAgoIso(SLOW_MOVER_MIN_AGE_DAYS + 1) },
        NOW,
        { avgPrice: 50000, sampleSize: 5 }
      );
      expect(result.type).toBe("slow_mover_discount");
    });

    test("tannarx-chegarasi kategoriya-asoslangan pasaytirishni ham HECH QACHON buzmaydi", () => {
      const result = computePricingSuggestion(
        { ...HEALTHY, price: 80000, costPrice: 76000 }, // min ruxsat etilgan narx: 76000*1.1=83600 > 80000 - PASAYTIRISH UMUMAN mumkin emas
        NOW,
        { avgPrice: 50000, sampleSize: 5 }
      );
      expect(result).toBeNull();
    });
  });
});

describe("buildCategoryPriceIndex", () => {
  test("kategoriya bo'yicha narxlar yig'indisi/sonini to'g'ri hisoblaydi", () => {
    const index = buildCategoryPriceIndex([
      { category: "Kiyim", price: 10000 },
      { category: "Kiyim", price: 20000 },
      { category: "Oyoq kiyim", price: 50000 },
    ]);
    expect(index.get("Kiyim")).toEqual({ sum: 30000, count: 2 });
    expect(index.get("Oyoq kiyim")).toEqual({ sum: 50000, count: 1 });
  });

  test("kategoriyasi yo'q yoki narxi 0/manfiy mahsulotlarni chiqarib tashlaydi", () => {
    const index = buildCategoryPriceIndex([
      { category: null, price: 10000 },
      { category: "Kiyim", price: 0 },
      { category: "Kiyim", price: -100 },
    ]);
    expect(index.size).toBe(0);
  });

  test("bo'sh yoki noto'g'ri kirishda bo'sh Map qaytaradi", () => {
    expect(buildCategoryPriceIndex([]).size).toBe(0);
    expect(buildCategoryPriceIndex(null).size).toBe(0);
    expect(buildCategoryPriceIndex(undefined).size).toBe(0);
  });
});

describe("getCategoryPriceContext", () => {
  test("shu mahsulotning O'ZINI hisobga olmasdan, BOSHQALARning o'rtacha narxini qaytaradi", () => {
    const index = buildCategoryPriceIndex([
      { category: "Kiyim", price: 100000 }, // shu mahsulotning o'zi
      { category: "Kiyim", price: 20000 },
      { category: "Kiyim", price: 20000 },
      { category: "Kiyim", price: 20000 },
    ]);
    const context = getCategoryPriceContext({ category: "Kiyim", price: 100000 }, index);
    expect(context).toEqual({ avgPrice: 20000, sampleSize: 3 });
  });

  test("namuna hajmi CATEGORY_MIN_SAMPLE_SIZEdan kam bo'lsa - null qaytaradi", () => {
    const index = buildCategoryPriceIndex([
      { category: "Kiyim", price: 100000 },
      { category: "Kiyim", price: 20000 },
    ]);
    const context = getCategoryPriceContext({ category: "Kiyim", price: 100000 }, index);
    expect(context).toBeNull();
  });

  test("mahsulotning kategoriyasi umuman yo'q/indeksda topilmasa - null qaytaradi", () => {
    const index = buildCategoryPriceIndex([{ category: "Kiyim", price: 20000 }]);
    expect(getCategoryPriceContext({ category: null, price: 10000 }, index)).toBeNull();
    expect(getCategoryPriceContext({ category: "Boshqa", price: 10000 }, index)).toBeNull();
  });
});
