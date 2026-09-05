import { describe, test, expect } from "vitest";
import {
  filterCourierOrdersForTab,
  computeCourierTabCounts,
  findActiveCourierOrderId,
  getCourierTab,
  COURIER_TABS,
} from "./courierOrderFilters";

const orders = [
  { id: "o1", courierDeliveryStatus: "assigned", customer: { fullName: "Aziz", phone: "+998901112233" } },
  { id: "o2", courierDeliveryStatus: "picked_up", customer: { fullName: "Malika", phone: "+998907778899" } },
  { id: "o3", courierDeliveryStatus: "delivered", customer: { fullName: "Bekzod", phone: "+998909998877" } },
  { id: "o4", courierDeliveryStatus: "failed", customer: { fullName: "Nodira", phone: "+998905554433" } },
];

describe("getCourierTab", () => {
  test("mavjud kalit uchun to'g'ri yorliqni qaytaradi", () => {
    expect(getCourierTab("inProgress").key).toBe("inProgress");
  });

  test("noma'lum/bo'sh kalit uchun BIRINCHI yorliqqa (\"new\") qaytadi", () => {
    expect(getCourierTab("unknown").key).toBe("new");
    expect(getCourierTab(undefined).key).toBe("new");
  });

  test("3 ta yorliq mavjud: new, inProgress, history", () => {
    expect(COURIER_TABS.map((t) => t.key)).toEqual(["new", "inProgress", "history"]);
  });
});

describe("filterCourierOrdersForTab", () => {
  test("'new' yorlig'ida faqat 'assigned' statusidagi buyurtmalarni qaytaradi", () => {
    expect(filterCourierOrdersForTab(orders, "new").map((o) => o.id)).toEqual(["o1"]);
  });

  test("'inProgress' yorlig'ida faqat 'picked_up' statusidagini qaytaradi", () => {
    expect(filterCourierOrdersForTab(orders, "inProgress").map((o) => o.id)).toEqual(["o2"]);
  });

  test("'history' yorlig'ida 'delivered' VA 'failed' ikkalasini ham qaytaradi", () => {
    expect(filterCourierOrdersForTab(orders, "history").map((o) => o.id)).toEqual(["o3", "o4"]);
  });

  test("qidiruv so'zi mijoz ismi bo'yicha filtrlaydi (katta-kichik harfga sezgir emas)", () => {
    expect(filterCourierOrdersForTab(orders, "history", "malika").length).toBe(0); // Malika 'picked_up'da, 'history'da emas
    expect(filterCourierOrdersForTab(orders, "inProgress", "MALIKA").map((o) => o.id)).toEqual(["o2"]);
  });

  test("qidiruv so'zi telefon bo'yicha ham ishlaydi", () => {
    expect(filterCourierOrdersForTab(orders, "new", "901112233").map((o) => o.id)).toEqual(["o1"]);
  });

  test("qidiruv so'zi buyurtma ID'si bo'yicha ham ishlaydi", () => {
    expect(filterCourierOrdersForTab(orders, "new", "o1").map((o) => o.id)).toEqual(["o1"]);
  });

  test("hech biriga mos kelmasa bo'sh massiv qaytaradi", () => {
    expect(filterCourierOrdersForTab(orders, "new", "hech-kim")).toEqual([]);
  });

  test("bo'sh/`null` ro'yxat uchun xato tashlamasdan bo'sh massiv qaytaradi", () => {
    expect(filterCourierOrdersForTab(null, "new")).toEqual([]);
    expect(filterCourierOrdersForTab(undefined, "new")).toEqual([]);
  });
});

describe("computeCourierTabCounts", () => {
  test("har bir yorliq uchun to'g'ri sonni hisoblaydi", () => {
    expect(computeCourierTabCounts(orders)).toEqual({ new: 1, inProgress: 1, history: 2 });
  });

  test("bo'sh ro'yxat uchun barcha sonlar 0", () => {
    expect(computeCourierTabCounts([])).toEqual({ new: 0, inProgress: 0, history: 0 });
  });
});

describe("findActiveCourierOrderId", () => {
  test("'picked_up' statusidagi buyurtma ID'sini topadi", () => {
    expect(findActiveCourierOrderId(orders)).toBe("o2");
  });

  test("'picked_up' bo'lmasa null qaytaradi", () => {
    expect(findActiveCourierOrderId(orders.filter((o) => o.id !== "o2"))).toBeNull();
  });

  test("bo'sh/`null` ro'yxat uchun null qaytaradi", () => {
    expect(findActiveCourierOrderId([])).toBeNull();
    expect(findActiveCourierOrderId(null)).toBeNull();
  });
});
