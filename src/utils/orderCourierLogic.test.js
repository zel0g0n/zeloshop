import { describe, test, expect, vi } from "vitest";

// `canDispatchYandex` platforma darajasidagi `YANDEX_DISPATCH_VISIBLE`
// bayrog'iga ham bog'liq (2026-10-08 dan `true`). Bu fayl funksiyaning
// O'ZINING shart-mantiqini sinaydi, shuning uchun bayroq qiymati mock
// orqali qat'iy `true` qilib qo'yiladi - production qiymati o'zgarsa ham
// testlar barqaror qoladi.
vi.mock("@/config/platformFlags", () => ({ YANDEX_DISPATCH_VISIBLE: true }));

import { canDispatchYandex, isCourierAssignedPending, isCourierActiveDelivery } from "./orderCourierLogic";

const baseOrder = {
  status: "processing",
  customer: { location: { lat: 41.3, lng: 69.2 } },
};
const enabledStore = { yandexDeliveryEnabled: true };

describe("canDispatchYandex", () => {
  test("barcha shartlar bajarilsa true qaytaradi", () => {
    expect(canDispatchYandex(baseOrder, enabledStore)).toBe(true);
  });

  test("do'konda Yandex yoqilmagan bo'lsa false qaytaradi", () => {
    expect(canDispatchYandex(baseOrder, { yandexDeliveryEnabled: false })).toBe(false);
  });

  test("mijoz koordinatasi bo'lmasa false qaytaradi", () => {
    expect(canDispatchYandex({ ...baseOrder, customer: {} }, enabledStore)).toBe(false);
  });

  test("Yandex allaqachon chaqirilgan bo'lsa false qaytaradi", () => {
    expect(canDispatchYandex({ ...baseOrder, yandexClaimId: "claim1" }, enabledStore)).toBe(false);
  });

  test("MUHIM (v39.3 regressiya himoyasi): shaxsiy kuryer ALLAQACHON biriktirilgan bo'lsa, `courierId` bo'lishi shu YOLGIZ o'zi false qaytarishi kerak - hatto boshqa hamma shart bajarilgan bo'lsa ham", () => {
    expect(canDispatchYandex({ ...baseOrder, courierId: "c1" }, enabledStore)).toBe(false);
  });

  test("buyurtma 'processing' bosqichida bo'lmasa false qaytaradi", () => {
    expect(canDispatchYandex({ ...baseOrder, status: "shipped" }, enabledStore)).toBe(false);
    expect(canDispatchYandex({ ...baseOrder, status: "new" }, enabledStore)).toBe(false);
  });

  test("`order`/`store` yo'q bo'lsa xato tashlamasdan false qaytaradi", () => {
    expect(canDispatchYandex(null, enabledStore)).toBe(false);
    expect(canDispatchYandex(baseOrder, null)).toBe(false);
    expect(canDispatchYandex(null, null)).toBe(false);
  });
});

describe("isCourierAssignedPending", () => {
  test("courierId bor va courierDeliveryStatus==='assigned' bo'lsa true", () => {
    expect(isCourierAssignedPending({ courierId: "c1", courierDeliveryStatus: "assigned" })).toBe(true);
  });

  test("courierId yo'q bo'lsa false", () => {
    expect(isCourierAssignedPending({ courierDeliveryStatus: "assigned" })).toBe(false);
  });

  test("courierDeliveryStatus 'picked_up' bo'lsa false (bu endi BOSHQA holat)", () => {
    expect(isCourierAssignedPending({ courierId: "c1", courierDeliveryStatus: "picked_up" })).toBe(false);
  });

  test("order null bo'lsa false", () => {
    expect(isCourierAssignedPending(null)).toBe(false);
  });
});

describe("isCourierActiveDelivery", () => {
  test("courierId bor va courierDeliveryStatus==='picked_up' bo'lsa true", () => {
    expect(isCourierActiveDelivery({ courierId: "c1", courierDeliveryStatus: "picked_up" })).toBe(true);
  });

  test("courierDeliveryStatus 'assigned' bo'lsa false", () => {
    expect(isCourierActiveDelivery({ courierId: "c1", courierDeliveryStatus: "assigned" })).toBe(false);
  });

  test("order null bo'lsa false", () => {
    expect(isCourierActiveDelivery(null)).toBe(false);
  });

  test("`isCourierAssignedPending` va `isCourierActiveDelivery` HECH QACHON bir vaqtda ikkalasi ham true bo'lmasligi kerak (o'zaro eksklyuziv bosqichlar)", () => {
    const statuses = ["assigned", "picked_up", "delivered", "failed", undefined];
    statuses.forEach((s) => {
      const order = { courierId: "c1", courierDeliveryStatus: s };
      expect(isCourierAssignedPending(order) && isCourierActiveDelivery(order)).toBe(false);
    });
  });
});
