import { describe, test, expect } from "vitest";
import { computeStaffPerformance } from "./staffPerformanceStats";

const makeOrder = (overrides = {}) => ({
  id: "order-1",
  lastActionByStaffId: "staff-1",
  status: "new",
  ...overrides,
});

describe("computeStaffPerformance", () => {
  test("faqat berilgan xodim oxirgi marta amal bajargan buyurtmalarni hisobga oladi", () => {
    const orders = [
      makeOrder({ id: "o1", lastActionByStaffId: "staff-1" }),
      makeOrder({ id: "o2", lastActionByStaffId: "staff-2" }),
    ];
    expect(computeStaffPerformance(orders, "staff-1").handledCount).toBe(1);
  });

  test("yetkazilgan/bekor qilingan sonlarini alohida hisoblaydi", () => {
    const orders = [
      makeOrder({ id: "o1", status: "delivered", totalAmount: 100_000 }),
      makeOrder({ id: "o2", status: "delivered", totalAmount: 50_000 }),
      makeOrder({ id: "o3", status: "cancel", totalAmount: 30_000 }),
      makeOrder({ id: "o4", status: "processing", totalAmount: 20_000 }),
    ];
    expect(computeStaffPerformance(orders, "staff-1")).toEqual({
      handledCount: 4,
      deliveredCount: 2,
      cancelledCount: 1,
      revenue: 150_000,
    });
  });

  test("lastActionByStaffId maydoni umuman yo'q (eski buyurtmalar) - hisobga kirmaydi", () => {
    const orders = [makeOrder({ id: "o1", lastActionByStaffId: undefined })];
    expect(computeStaffPerformance(orders, "staff-1").handledCount).toBe(0);
  });

  test("bo'sh yoki mavjud bo'lmagan ro'yxat bilan ham xatosiz ishlaydi", () => {
    expect(computeStaffPerformance([], "staff-1")).toEqual({ handledCount: 0, deliveredCount: 0, cancelledCount: 0, revenue: 0 });
    expect(computeStaffPerformance(undefined, "staff-1")).toEqual({ handledCount: 0, deliveredCount: 0, cancelledCount: 0, revenue: 0 });
  });

  describe("revenue (Biznes Buyruq Markazi - 'eng yaxshi xodimlar')", () => {
    test("FAQAT 'delivered' buyurtmalarning summasi qo'shiladi - bekor qilingan/kutilayotgan KIRMAYDI", () => {
      const orders = [
        makeOrder({ id: "o1", status: "delivered", totalAmount: 100_000 }),
        makeOrder({ id: "o2", status: "cancel", totalAmount: 999_999 }),
        makeOrder({ id: "o3", status: "new", totalAmount: 999_999 }),
      ];
      expect(computeStaffPerformance(orders, "staff-1").revenue).toBe(100_000);
    });

    test("boshqa xodim ustida ishlagan buyurtmalar hisobga kirmaydi", () => {
      const orders = [
        makeOrder({ id: "o1", status: "delivered", totalAmount: 100_000, lastActionByStaffId: "staff-2" }),
      ];
      expect(computeStaffPerformance(orders, "staff-1").revenue).toBe(0);
    });
  });
});
