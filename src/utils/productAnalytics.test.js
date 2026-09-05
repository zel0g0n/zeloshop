import { describe, test, expect } from "vitest";
import {
  computeLastSoldMap,
  buildProductPeriodStats,
  getTopProducts,
  getCategoryBreakdown,
  getDeadStock,
  getLowStockAlerts,
  computeSummaryInsights,
} from "./productAnalytics";

const day = (n) => new Date(2026, 0, n).getTime(); // 2026-01-0n

const makeProduct = (overrides = {}) => ({
  id: "p1",
  name: "Test mahsulot",
  category: "Parfyum",
  price: 100_000,
  costPrice: 60_000,
  stock: 10,
  averageRating: 4.5,
  reviewCount: 3,
  ...overrides,
});

const makeOrder = (overrides = {}) => ({
  id: "o1",
  status: "delivered",
  createdAt: day(15),
  orders: [{ id: "p1", price: 100_000, quantity: 1 }],
  ...overrides,
});

describe("computeLastSoldMap", () => {
  test("faqat 'delivered' buyurtmalarni hisobga oladi", () => {
    const orders = [
      makeOrder({ id: "a", status: "delivered", createdAt: day(10) }),
      makeOrder({ id: "b", status: "pending", createdAt: day(20) }),
    ];
    const map = computeLastSoldMap(orders);
    expect(map.get("p1")).toBe(day(10));
  });

  test("bir nechta buyurtma bo'lsa ENG OXIRGISINI oladi", () => {
    const orders = [
      makeOrder({ id: "a", createdAt: day(5) }),
      makeOrder({ id: "b", createdAt: day(20) }),
      makeOrder({ id: "c", createdAt: day(10) }),
    ];
    const map = computeLastSoldMap(orders);
    expect(map.get("p1")).toBe(day(20));
  });

  test("sotilmagan mahsulot uchun yozuv yaratmaydi", () => {
    const map = computeLastSoldMap([]);
    expect(map.has("p1")).toBe(false);
  });
});

describe("buildProductPeriodStats", () => {
  test("davr ichidagi sotuvlarni to'g'ri jamlaydi", () => {
    const products = [makeProduct()];
    const orders = [
      makeOrder({ createdAt: day(10), orders: [{ id: "p1", price: 100_000, quantity: 2 }] }),
    ];
    const stats = buildProductPeriodStats(products, orders, day(1), day(31));
    expect(stats).toHaveLength(1);
    expect(stats[0].unitsSold).toBe(2);
    expect(stats[0].revenue).toBe(200_000);
    expect(stats[0].profit).toBe(80_000); // (100000-60000)*2
  });

  test("davrdan TASHQARIDAGI sotuvni hisobga OLMAYDI", () => {
    const products = [makeProduct()];
    const orders = [makeOrder({ createdAt: day(1) })]; // range boshlanishidan oldin
    const stats = buildProductPeriodStats(products, orders, day(10), day(31));
    expect(stats[0].unitsSold).toBe(0);
    expect(stats[0].revenue).toBe(0);
  });

  test("HECH QACHON sotilmagan mahsulot ham natijaga KIRADI (0 qiymat bilan)", () => {
    const products = [makeProduct({ id: "p2" })];
    const stats = buildProductPeriodStats(products, [], day(1), day(31));
    expect(stats).toHaveLength(1);
    expect(stats[0].unitsSold).toBe(0);
    expect(stats[0].daysSinceLastSale).toBeNull();
  });

  test("daysSinceLastSale — davrdan MUSTAQIL, butun tarixdan hisoblanadi", () => {
    const products = [makeProduct()];
    // Sotuv davrdan TASHQARIDA (day 1), lekin `now` day(31) sifatida beriladi.
    const orders = [makeOrder({ createdAt: day(1) })];
    const stats = buildProductPeriodStats(products, orders, day(25), day(31), day(31));
    expect(stats[0].unitsSold).toBe(0); // davr ichida sotilmagan
    expect(stats[0].daysSinceLastSale).toBe(30); // lekin "oxirgi sotilgan" baribir bor
  });

  test("unitMarginPercent narx/tannarxdan, sotuvdan mustaqil hisoblanadi", () => {
    const products = [makeProduct({ price: 100_000, costPrice: 40_000 })];
    const stats = buildProductPeriodStats(products, [], day(1), day(31));
    expect(stats[0].unitMarginPercent).toBe(60);
  });
});

describe("getTopProducts", () => {
  test("metric bo'yicha kamayish tartibida saralaydi va nollarni chiqarib tashlaydi", () => {
    const stats = [
      { id: "a", revenue: 500 },
      { id: "b", revenue: 0 },
      { id: "c", revenue: 1000 },
    ];
    const top = getTopProducts(stats, "revenue", 5);
    expect(top.map((p) => p.id)).toEqual(["c", "a"]);
  });

  test("limit'ni to'g'ri qo'llaydi", () => {
    const stats = [{ id: "a", revenue: 1 }, { id: "b", revenue: 2 }, { id: "c", revenue: 3 }];
    expect(getTopProducts(stats, "revenue", 2)).toHaveLength(2);
  });
});

describe("getCategoryBreakdown", () => {
  test("kategoriya bo'yicha jamlaydi va foizni to'g'ri hisoblaydi", () => {
    const stats = [
      { category: "A", revenue: 300, unitsSold: 3 },
      { category: "A", revenue: 200, unitsSold: 2 },
      { category: "B", revenue: 500, unitsSold: 5 },
    ];
    const result = getCategoryBreakdown(stats);
    expect(result[0]).toMatchObject({ category: "A", revenue: 500, percentOfRevenue: 50 });
  });
});

describe("getDeadStock", () => {
  test("ombori bor lekin uzoq sotilmagan mahsulotni topadi", () => {
    const stats = [
      { id: "a", stock: 5, daysSinceLastSale: 45 },
      { id: "b", stock: 5, daysSinceLastSale: 5 },
      { id: "c", stock: 0, daysSinceLastSale: 90 }, // ombor yo'q - o'lik emas
      { id: "d", stock: 3, daysSinceLastSale: null }, // hech qachon sotilmagan
    ];
    const dead = getDeadStock(stats, 30);
    expect(dead.map((p) => p.id)).toEqual(["d", "a"]); // null (hech qachon) birinchi
  });
});

describe("getLowStockAlerts", () => {
  test("joriy tezlik bilan tez tugaydigan mahsulotni ogohlantiradi", () => {
    // 10 kunda 10 dona sotilgan = kuniga 1 dona; ombor 3 dona qoldi -> 3 kunda tugaydi
    const stats = [{ id: "a", unitsSold: 10, stock: 3 }];
    const alerts = getLowStockAlerts(stats, 10, 7);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].daysUntilStockout).toBe(3);
  });

  test("chegaradan uzoqroq muddat qolgan bo'lsa ogohlantirmaydi", () => {
    // kuniga 1 dona, ombor 100 dona -> 100 kun (chegara 7 kundan yuqori)
    const stats = [{ id: "a", unitsSold: 10, stock: 100 }];
    const alerts = getLowStockAlerts(stats, 10, 7);
    expect(alerts).toHaveLength(0);
  });

  test("sotilmagan mahsulotlarni umuman hisobga olmaydi", () => {
    const stats = [{ id: "a", unitsSold: 0, stock: 1 }];
    expect(getLowStockAlerts(stats, 10, 7)).toHaveLength(0);
  });
});

describe("computeSummaryInsights", () => {
  test("umumiy ko'rsatkichlarni to'g'ri hisoblaydi", () => {
    const stats = [
      { category: "A", revenue: 300, unitsSold: 3 },
      { category: "B", revenue: 100, unitsSold: 1 },
    ];
    const deadStock = [{ id: "x" }];
    const insights = computeSummaryInsights(stats, deadStock);
    expect(insights.totalProducts).toBe(2);
    expect(insights.totalUnitsSold).toBe(4);
    expect(insights.totalRevenue).toBe(400);
    expect(insights.deadStockCount).toBe(1);
    expect(insights.topCategory).toBe("A");
  });

  test("hech narsa sotilmagan bo'lsa topCategory null bo'ladi", () => {
    const stats = [{ category: "A", revenue: 0, unitsSold: 0 }];
    const insights = computeSummaryInsights(stats, []);
    expect(insights.topCategory).toBeNull();
  });
});
