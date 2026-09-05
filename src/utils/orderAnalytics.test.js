import { describe, test, expect } from "vitest";
import {
  filterOrdersInRange,
  computeStatusBreakdown,
  computeOrderSummary,
  buildDailyRevenueSeries,
  getTopCustomers,
  getCancellationReasons,
  getDeliveryZoneBreakdown,
  getLapsedCustomers,
  getDayPartBreakdown,
} from "./orderAnalytics";

const day = (n, hour = 12) => new Date(2026, 0, n, hour).getTime();
const STATUS_ORDER = ["pending", "new", "processing", "shipped", "delivered", "cancel"];

const makeOrder = (overrides = {}) => ({
  id: "o1",
  clientId: "c1",
  status: "delivered",
  totalAmount: 100_000,
  createdAt: day(15),
  customer: { fullName: "Ali", phone: "+998900000000" },
  ...overrides,
});

describe("filterOrdersInRange", () => {
  test("faqat davr ichidagilarni qaytaradi", () => {
    const orders = [makeOrder({ id: "a", createdAt: day(5) }), makeOrder({ id: "b", createdAt: day(20) })];
    const result = filterOrdersInRange(orders, day(10), day(25));
    expect(result.map((o) => o.id)).toEqual(["b"]);
  });

  test("holatidan qat'i nazar hammasini oladi (faqat delivered emas)", () => {
    const orders = [makeOrder({ id: "a", status: "cancel", createdAt: day(15) })];
    expect(filterOrdersInRange(orders, day(1), day(31))).toHaveLength(1);
  });
});

describe("computeStatusBreakdown", () => {
  test("har bir holat uchun son va foizni to'g'ri hisoblaydi", () => {
    const orders = [
      makeOrder({ status: "delivered" }),
      makeOrder({ status: "delivered" }),
      makeOrder({ status: "cancel" }),
    ];
    const result = computeStatusBreakdown(orders, STATUS_ORDER);
    const delivered = result.find((r) => r.status === "delivered");
    const cancel = result.find((r) => r.status === "cancel");
    expect(delivered).toMatchObject({ count: 2, percent: (2 / 3) * 100 });
    expect(cancel).toMatchObject({ count: 1, percent: (1 / 3) * 100 });
  });

  test("bo'sh ro'yxatda hech qanday xatoga olib kelmaydi", () => {
    const result = computeStatusBreakdown([], STATUS_ORDER);
    expect(result.every((r) => r.count === 0 && r.percent === 0)).toBe(true);
  });
});

describe("computeOrderSummary", () => {
  test("AOV faqat yetkazilgan buyurtmalardan hisoblanadi", () => {
    const orders = [
      makeOrder({ status: "delivered", totalAmount: 100_000 }),
      makeOrder({ status: "delivered", totalAmount: 200_000 }),
      makeOrder({ status: "new", totalAmount: 999_999 }), // hisobga olinmasligi kerak
    ];
    const summary = computeOrderSummary(orders);
    expect(summary.deliveredRevenue).toBe(300_000);
    expect(summary.aov).toBe(150_000);
    expect(summary.totalOrders).toBe(3);
  });

  test("bekor qilish darajasini to'g'ri hisoblaydi", () => {
    const orders = [
      makeOrder({ status: "delivered" }),
      makeOrder({ status: "cancel" }),
      makeOrder({ status: "cancel" }),
      makeOrder({ status: "new" }),
    ];
    const summary = computeOrderSummary(orders);
    expect(summary.cancelCount).toBe(2);
    expect(summary.cancelRate).toBe(50);
  });

  test("hech qanday yetkazilgan buyurtma bo'lmasa AOV 0 bo'ladi (bo'linishga xato bermaydi)", () => {
    const summary = computeOrderSummary([makeOrder({ status: "new" })]);
    expect(summary.aov).toBe(0);
  });
});

describe("buildDailyRevenueSeries", () => {
  test("har bir kun uchun (hatto bo'sh bo'lsa ham) yozuv yaratadi", () => {
    const orders = [makeOrder({ createdAt: day(2) })];
    const result = buildDailyRevenueSeries(orders, day(1, 0), day(3, 0));
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.some((d) => d.revenue === 100_000)).toBe(true);
  });

  test("faqat yetkazilganlarni jamlaydi", () => {
    const orders = [makeOrder({ status: "new", totalAmount: 50_000, createdAt: day(2) })];
    const result = buildDailyRevenueSeries(orders, day(1, 0), day(3, 0));
    expect(result.every((d) => d.revenue === 0)).toBe(true);
  });
});

describe("getTopCustomers", () => {
  test("mijoz bo'yicha jamlaydi va sarflagan summasi bo'yicha saralaydi", () => {
    const orders = [
      makeOrder({ clientId: "a", totalAmount: 50_000 }),
      makeOrder({ clientId: "a", totalAmount: 50_000 }),
      makeOrder({ clientId: "b", totalAmount: 200_000 }),
    ];
    const result = getTopCustomers(orders, 5);
    expect(result[0]).toMatchObject({ clientId: "b", totalSpent: 200_000, ordersCount: 1 });
    expect(result[1]).toMatchObject({ clientId: "a", totalSpent: 100_000, ordersCount: 2 });
  });

  test("faqat yetkazilgan buyurtmalarni hisoblaydi", () => {
    const orders = [makeOrder({ clientId: "a", status: "new", totalAmount: 999_999 })];
    expect(getTopCustomers(orders)).toHaveLength(0);
  });
});

describe("getCancellationReasons", () => {
  test("sabab bo'yicha guruhlaydi va sanaydi", () => {
    const orders = [
      makeOrder({ status: "cancel", cancelReason: "Mahsulot tugagan" }),
      makeOrder({ status: "cancel", cancelReason: "Mahsulot tugagan" }),
      makeOrder({ status: "cancel", cancelReason: "Mijoz voz kechdi" }),
    ];
    const result = getCancellationReasons(orders);
    expect(result[0]).toMatchObject({ reason: "Mahsulot tugagan", count: 2 });
  });
});

describe("getDeliveryZoneBreakdown", () => {
  test("bosqich bo'yicha jamlaydi, bosqich yo'q buyurtmalarni chetlab o'tadi", () => {
    const orders = [
      makeOrder({ deliveryZone: { tier: "sameCity" } }),
      makeOrder({ deliveryZone: { tier: "sameCity" } }),
      makeOrder({ deliveryZone: { tier: "otherRegions" } }),
      makeOrder({ deliveryZone: null }),
    ];
    const result = getDeliveryZoneBreakdown(orders);
    expect(result[0]).toMatchObject({ tier: "sameCity", count: 2 });
    expect(result.reduce((s, r) => s + r.count, 0)).toBe(3); // null chetlangan
  });
});

describe("getLapsedCustomers", () => {
  test("chegaradan ko'p vaqt o'tgan mijozni topadi", () => {
    const orders = [makeOrder({ clientId: "a", createdAt: day(1) })]; // 14+ kun oldin
    const result = getLapsedCustomers(orders, 10, day(15));
    expect(result).toHaveLength(1);
    expect(result[0].clientId).toBe("a");
    expect(result[0].daysSinceLastOrder).toBe(14);
  });

  test("yaqinda buyurtma bergan mijozni chetlab o'tadi", () => {
    const orders = [makeOrder({ clientId: "a", createdAt: day(14) })]; // 1 kun oldin
    const result = getLapsedCustomers(orders, 10, day(15));
    expect(result).toHaveLength(0);
  });

  test("bir nechta buyurtmadan ENG SO'NGGISINI hisobga oladi (davr filtridan mustaqil)", () => {
    const orders = [
      makeOrder({ clientId: "a", createdAt: day(1) }),
      makeOrder({ clientId: "a", createdAt: day(14) }), // eng so'nggi - yaqinda
    ];
    const result = getLapsedCustomers(orders, 10, day(15));
    expect(result).toHaveLength(0); // eng so'nggi buyurtma yaqinda bo'lgani uchun "uxlab qolgan" emas
  });

  test("faqat yetkazilgan buyurtmalarni hisobga oladi", () => {
    const orders = [makeOrder({ clientId: "a", status: "new", createdAt: day(1) })];
    const result = getLapsedCustomers(orders, 10, day(15));
    expect(result).toHaveLength(0);
  });

  test("eng uzoq vaqt o'tgan mijozni birinchi qilib saralaydi", () => {
    const orders = [
      makeOrder({ clientId: "a", createdAt: day(5) }),
      makeOrder({ clientId: "b", createdAt: day(1) }),
    ];
    const result = getLapsedCustomers(orders, 5, day(20));
    expect(result[0].clientId).toBe("b"); // "b" ko'proq vaqt o'tgan (uzoqroq oldin)
  });
});

describe("getDayPartBreakdown", () => {
  test("soatga qarab to'g'ri bo'lakka joylaydi", () => {
    const orders = [
      makeOrder({ createdAt: day(1, 8) }), // morning
      makeOrder({ createdAt: day(1, 15) }), // afternoon
      makeOrder({ createdAt: day(1, 20) }), // evening
      makeOrder({ createdAt: day(1, 2) }), // night
    ];
    const result = getDayPartBreakdown(orders);
    expect(result.find((r) => r.key === "morning").count).toBe(1);
    expect(result.find((r) => r.key === "afternoon").count).toBe(1);
    expect(result.find((r) => r.key === "evening").count).toBe(1);
    expect(result.find((r) => r.key === "night").count).toBe(1);
  });
});
