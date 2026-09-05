const { _testables } = require("../productAutomation");
const { buildProductChannelPost, buildCouponChannelPost, categoryToHashtag } = _testables;

describe("categoryToHashtag", () => {
  test("oddiy bir so'zli kategoriyani to'g'ri hashtag'ga aylantiradi", () => {
    expect(categoryToHashtag("Skincare")).toBe("#Skincare");
  });

  test("bo'sh joyli kategoriyadan bo'sh joyni olib tashlaydi", () => {
    expect(categoryToHashtag("Erkaklar kiyimi")).toBe("#Erkaklarkiyimi");
  });

  test("bo'sh/null kategoriya uchun bo'sh qator qaytaradi", () => {
    expect(categoryToHashtag(null)).toBe("");
    expect(categoryToHashtag("")).toBe("");
  });

  test("juda uzun kategoriya nomini qisqartiradi", () => {
    const long = "a".repeat(50);
    const result = categoryToHashtag(long);
    expect(result.length).toBeLessThanOrEqual(31); // "#" + 30 belgi
  });
});

describe("buildProductChannelPost", () => {
  test("chegirmasiz mahsulot uchun to'g'ri post quradi", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000, category: "Skincare" });
    expect(post).toContain("Krem");
    expect(post).toContain("100,000 so'm");
    expect(post).toContain("#Skincare");
    expect(post).not.toContain("avvalgi narx");
  });

  test("chegirmali mahsulot uchun ESKI va YANGI narxni ko'rsatadi", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000, discountPrice: 70_000, category: "Skincare" });
    expect(post).toContain("70,000 so'm");
    expect(post).toContain("100,000 so'm");
    expect(post).toContain("avvalgi narx");
  });

  test("tavsif uzun bo'lsa, qisqartiradi", () => {
    const longDesc = "a".repeat(300);
    const post = buildProductChannelPost({ name: "Krem", price: 100_000, description: longDesc });
    expect(post).toContain("...");
  });

  test("kategoriya bo'lmasa, hashtag qo'shmaydi (xato bermaydi)", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000 });
    expect(post).toBeTruthy();
    expect(post).not.toContain("#");
  });

  // YANGI (foydalanuvchi so'ragan): zaxira soni ("nechta dona bor").
  test("`stock` berilgan bo'lsa, zaxira sonini qatorga qo'shadi", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000, stock: 12 });
    expect(post).toContain("Zaxirada: 12 dona");
  });

  test("`stock` 0 bo'lsa HAM ko'rsatadi (0 - HAQIQIY qiymat, 'falsy' deb o'tkazib yubormaslik kerak)", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000, stock: 0 });
    expect(post).toContain("Zaxirada: 0 dona");
  });

  test("`stock` berilmagan/noto'g'ri bo'lsa, zaxira qatorini QO'SHMAYDI", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000 });
    expect(post).not.toContain("Zaxirada");
    const post2 = buildProductChannelPost({ name: "Krem", price: 100_000, stock: "noto'g'ri" });
    expect(post2).not.toContain("Zaxirada");
  });
});

describe("buildCouponChannelPost", () => {
  test("foizli kuponni to'g'ri formatlaydi", () => {
    const post = buildCouponChannelPost({ code: "SALE20", discountType: "percent", discountValue: 20 });
    expect(post).toContain("SALE20");
    expect(post).toContain("20%");
  });

  test("belgilangan summali kuponni to'g'ri formatlaydi", () => {
    const post = buildCouponChannelPost({ code: "SAVE50K", discountType: "fixed", discountValue: 50_000 });
    expect(post).toContain("50,000 so'm chegirma");
  });

  test("muddat berilmasa, muddat qatorini qo'shmaydi", () => {
    const post = buildCouponChannelPost({ code: "SALE20", discountType: "percent", discountValue: 20 });
    expect(post).not.toContain("muddati");
  });
});
