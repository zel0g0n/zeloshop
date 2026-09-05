import { describe, test, expect } from "vitest";
import { computeCourierPerformance } from "./courierPerformanceStats";

const makeOrder = (overrides = {}) => ({
  id: "order-1",
  courierId: "courier-1",
  courierDeliveryStatus: "assigned",
  ...overrides,
});

describe("computeCourierPerformance", () => {
  test("faqat berilgan kuryerga biriktirilgan buyurtmalarni hisobga oladi", () => {
    const orders = [
      makeOrder({ id: "o1", courierId: "courier-1", courierDeliveryStatus: "delivered" }),
      makeOrder({ id: "o2", courierId: "courier-2", courierDeliveryStatus: "delivered" }),
    ];
    expect(computeCourierPerformance(orders, "courier-1").deliveredCount).toBe(1);
  });

  test("har bir courierDeliveryStatus toifasini to'g'ri sanaydi", () => {
    const orders = [
      makeOrder({ id: "o1", courierDeliveryStatus: "delivered" }),
      makeOrder({ id: "o2", courierDeliveryStatus: "delivered" }),
      makeOrder({ id: "o3", courierDeliveryStatus: "picked_up" }),
      makeOrder({ id: "o4", courierDeliveryStatus: "assigned" }),
      makeOrder({ id: "o5", courierDeliveryStatus: "failed" }),
    ];
    expect(computeCourierPerformance(orders, "courier-1")).toEqual({
      deliveredCount: 2,
      activeCount: 1,
      pendingCount: 1,
      failedCount: 1,
    });
  });

  test("courierId umuman mos kelmasa - barcha sonlar nolga teng", () => {
    const orders = [makeOrder({ courierId: "someone-else", courierDeliveryStatus: "delivered" })];
    expect(computeCourierPerformance(orders, "courier-1")).toEqual({
      deliveredCount: 0,
      activeCount: 0,
      pendingCount: 0,
      failedCount: 0,
    });
  });

  test("bo'sh yoki mavjud bo'lmagan ro'yxat bilan ham xatosiz ishlaydi", () => {
    expect(computeCourierPerformance([], "courier-1")).toEqual({
      deliveredCount: 0,
      activeCount: 0,
      pendingCount: 0,
      failedCount: 0,
    });
    expect(computeCourierPerformance(undefined, "courier-1")).toEqual({
      deliveredCount: 0,
      activeCount: 0,
      pendingCount: 0,
      failedCount: 0,
    });
  });
});
