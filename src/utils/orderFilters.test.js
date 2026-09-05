import { describe, test, expect } from "vitest";
import { filterOrders, computeOrderNumbers, computeDeliveredRevenue, computeActiveOrdersCount, findLatestActiveOrder } from "./orderFilters";

const makeOrder = (overrides = {}) => ({
  id: "order-1",
  status: "new",
  totalAmount: 100_000,
  createdAt: Date.now(),
  customer: { fullName: "Ali", phone: "+998901234567" },
  ...overrides,
});

describe("filterOrders", () => {
  test("faqat active tab statusiga mos buyurtmalarni qaytaradi", () => {
    const orders = [
      makeOrder({ id: "a", status: "new" }),
      makeOrder({ id: "b", status: "delivered" }),
    ];
    const result = filterOrders(orders, { activeTab: "new", searchQuery: "" });
    expect(result.map((o) => o.id)).toEqual(["a"]);
  });

  test("mijoz ismi bo'yicha qidiradi (katta-kichik harfga sezgir emas)", () => {
    const orders = [
      makeOrder({ id: "a", status: "new", customer: { fullName: "Aziza Karimova" } }),
      makeOrder({ id: "b", status: "new", customer: { fullName: "Botir" } }),
    ];
    const result = filterOrders(orders, { activeTab: "new", searchQuery: "aziza" });
    expect(result.map((o) => o.id)).toEqual(["a"]);
  });

  test("telefon raqami bo'yicha qidiradi", () => {
    const orders = [
      makeOrder({ id: "a", status: "new", customer: { fullName: "X", phone: "+998901112233" } }),
      makeOrder({ id: "b", status: "new", customer: { fullName: "Y", phone: "+998907778899" } }),
    ];
    const result = filterOrders(orders, { activeTab: "new", searchQuery: "1112233" });
    expect(result.map((o) => o.id)).toEqual(["a"]);
  });

  test("buyurtma ID'si bo'yicha qidiradi", () => {
    const orders = [
      makeOrder({ id: "abc123", status: "new" }),
      makeOrder({ id: "xyz789", status: "new" }),
    ];
    const result = filterOrders(orders, { activeTab: "new", searchQuery: "abc" });
    expect(result.map((o) => o.id)).toEqual(["abc123"]);
  });

  test("qidiruv statusga mos KELMAGAN buyurtmani qaytarmaydi (AND mantig'i)", () => {
    const orders = [makeOrder({ id: "a", status: "delivered", customer: { fullName: "Aziza" } })];
    const result = filterOrders(orders, { activeTab: "new", searchQuery: "aziza" });
    expect(result).toHaveLength(0);
  });

  test("hiddenAt belgilangan buyurtmani (tarixdan o'chirilgan) hech qaysi tabda qaytarmaydi", () => {
    const orders = [
      makeOrder({ id: "a", status: "delivered" }),
      makeOrder({ id: "b", status: "delivered", hiddenAt: Date.now() }),
    ];
    const result = filterOrders(orders, { activeTab: "delivered", searchQuery: "" });
    expect(result.map((o) => o.id)).toEqual(["a"]);
  });
});

describe("computeOrderNumbers", () => {
  test("eng eski buyurtmaga #1 beradi, xronologik tartibda", () => {
    const orders = [
      makeOrder({ id: "newest", createdAt: 3000 }),
      makeOrder({ id: "oldest", createdAt: 1000 }),
      makeOrder({ id: "middle", createdAt: 2000 }),
    ];
    const numbers = computeOrderNumbers(orders);
    expect(numbers.get("oldest")).toBe(1);
    expect(numbers.get("middle")).toBe(2);
    expect(numbers.get("newest")).toBe(3);
  });

  test("HAQIQIY `orderNumber` maydoni mavjud bo'lsa, o'shani ishlatadi (massiv o'rniga emas)", () => {
    // Bu, yuklash chegarasidan (masalan 150 talik) MUSTAQIL, doimiy
    // raqamlash to'g'ri ishlashini tasdiqlaydi - hatto massivdagi
    // TARTIB boshqacha bo'lsa ham, HAQIQIY raqam ustunlik qiladi.
    const orders = [
      makeOrder({ id: "a", createdAt: 1000, orderNumber: 241 }),
      makeOrder({ id: "b", createdAt: 2000, orderNumber: 242 }),
    ];
    const numbers = computeOrderNumbers(orders);
    expect(numbers.get("a")).toBe(241);
    expect(numbers.get("b")).toBe(242);
  });
});

describe("computeDeliveredRevenue", () => {
  test("faqat 'delivered' statusidagi buyurtmalar summasini qo'shadi", () => {
    const orders = [
      makeOrder({ status: "delivered", totalAmount: 50_000 }),
      makeOrder({ status: "delivered", totalAmount: 30_000 }),
      makeOrder({ status: "new", totalAmount: 999_999 }),
    ];
    expect(computeDeliveredRevenue(orders)).toBe(80_000);
  });

  test("tarixdan yashirilgan (hiddenAt) buyurtma ham hisobga kiraveradi - hisob-kitob o'zgarmasligi kerak", () => {
    const orders = [
      makeOrder({ status: "delivered", totalAmount: 50_000 }),
      makeOrder({ status: "delivered", totalAmount: 30_000, hiddenAt: Date.now() }),
    ];
    expect(computeDeliveredRevenue(orders)).toBe(80_000);
  });
});

describe("computeActiveOrdersCount", () => {
  test("yetkazilgan va bekor qilingan buyurtmalarni hisobga olmaydi", () => {
    const orders = [
      makeOrder({ status: "new" }),
      makeOrder({ status: "processing" }),
      makeOrder({ status: "delivered" }),
      makeOrder({ status: "cancel" }),
    ];
    expect(computeActiveOrdersCount(orders)).toBe(2);
  });
});

describe("findLatestActiveOrder", () => {
  test("ro'yxatdagi BIRINCHI (eng yangi, chunki kirish allaqachon createdAt desc saralangan) faol buyurtmani qaytaradi", () => {
    const orders = [
      makeOrder({ id: "order-3", status: "processing" }),
      makeOrder({ id: "order-2", status: "new" }),
      makeOrder({ id: "order-1", status: "delivered" }),
    ];
    expect(findLatestActiveOrder(orders)?.id).toBe("order-3");
  });

  test("yetkazilgan/bekor qilingan buyurtmalarni o'tkazib yuboradi", () => {
    const orders = [
      makeOrder({ id: "order-2", status: "delivered" }),
      makeOrder({ id: "order-1", status: "cancel" }),
    ];
    expect(findLatestActiveOrder(orders)).toBeNull();
  });

  test("tarixdan yashirilgan (hiddenAt) buyurtmani ham faol deb hisoblamaydi", () => {
    const orders = [makeOrder({ id: "order-1", status: "shipped", hiddenAt: Date.now() })];
    expect(findLatestActiveOrder(orders)).toBeNull();
  });

  test("hech qanday faol buyurtma bo'lmasa yoki ro'yxat bo'sh bo'lsa `null` qaytaradi", () => {
    expect(findLatestActiveOrder([])).toBeNull();
  });
});
