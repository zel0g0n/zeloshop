import { describe, test, expect } from "vitest";
import { computeClientSpendingSummary, buildMonthlySpendingSeries } from "./clientSpending";

const makeOrder = (overrides = {}) => ({
  status: "delivered",
  totalAmount: 100_000,
  createdAt: Date.now(),
  orders: [{ name: "Krem", quantity: 1 }],
  ...overrides,
});

describe("computeClientSpendingSummary", () => {
  test("faqat yetkazilgan buyurtmalardan umumiy xarajatni hisoblaydi", () => {
    const orders = [
      makeOrder({ status: "delivered", totalAmount: 100_000 }),
      makeOrder({ status: "new", totalAmount: 999_999 }),
    ];
    const result = computeClientSpendingSummary(orders);
    expect(result.totalSpent).toBe(100_000);
    expect(result.deliveredCount).toBe(1);
    expect(result.totalOrderCount).toBe(2);
  });

  test("bekor qilingan buyurtmalar sonini to'g'ri hisoblaydi", () => {
    const orders = [makeOrder({ status: "cancel" }), makeOrder({ status: "delivered" })];
    const result = computeClientSpendingSummary(orders);
    expect(result.cancelledCount).toBe(1);
  });

  test("o'rtacha buyurtma qiymatini to'g'ri hisoblaydi", () => {
    const orders = [
      makeOrder({ totalAmount: 100_000 }),
      makeOrder({ totalAmount: 200_000 }),
    ];
    const result = computeClientSpendingSummary(orders);
    expect(result.averageOrderValue).toBe(150_000);
  });

  test("hech qanday buyurtma bo'lmasa, xato bermaydi (0 qaytaradi)", () => {
    const result = computeClientSpendingSummary([]);
    expect(result.totalSpent).toBe(0);
    expect(result.averageOrderValue).toBe(0);
    expect(result.topProductName).toBeNull();
  });

  test("eng ko'p xarid qilingan mahsulotni to'g'ri topadi", () => {
    const orders = [
      makeOrder({ orders: [{ name: "Krem", quantity: 2 }] }),
      makeOrder({ orders: [{ name: "Sovun", quantity: 1 }] }),
      makeOrder({ orders: [{ name: "Krem", quantity: 3 }] }),
    ];
    const result = computeClientSpendingSummary(orders);
    expect(result.topProductName).toBe("Krem");
    expect(result.topProductQty).toBe(5);
  });
});

describe("buildMonthlySpendingSeries", () => {
  test("so'ralgan oylar sonicha qator qaytaradi", () => {
    const result = buildMonthlySpendingSeries([], 6);
    expect(result).toHaveLength(6);
  });

  test("joriy oydagi xaridni to'g'ri oyga joylashtiradi", () => {
    const now = Date.now();
    const orders = [makeOrder({ createdAt: now, totalAmount: 50_000 })];
    const result = buildMonthlySpendingSeries(orders, 3);
    const lastBucket = result[result.length - 1];
    expect(lastBucket.total).toBe(50_000);
  });
});
