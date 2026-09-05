import { describe, test, expect } from "vitest";
import { resolveTrackingView } from "./courierTrackingView";

describe("resolveTrackingView", () => {
  test("`loading` HAMMASIDAN USTUN — hatto `order`/`accessError` allaqachon berilgan bo'lsa ham", () => {
    expect(resolveTrackingView({ loading: true, accessError: true, order: { courierId: "c1" } })).toBe("loading");
  });

  test("`accessError` — `loading` tugagach, `order`dan USTUN", () => {
    expect(resolveTrackingView({ loading: false, accessError: true, order: { courierId: "c1" } })).toBe("accessError");
  });

  test("`order` bo'lmasa (topilmadi) 'notFound' qaytaradi", () => {
    expect(resolveTrackingView({ loading: false, accessError: false, order: null })).toBe("notFound");
  });

  test("`order` bor, lekin `courierId` yo'q bo'lsa 'noCourierYet' qaytaradi", () => {
    expect(resolveTrackingView({ loading: false, accessError: false, order: { id: "o1" } })).toBe("noCourierYet");
  });

  test.each([
    ["assigned", "assigned"],
    ["picked_up", "pickedUp"],
    ["delivered", "delivered"],
    ["failed", "failed"],
  ])("courierDeliveryStatus='%s' bo'lsa '%s' qaytaradi", (status, expected) => {
    expect(resolveTrackingView({ loading: false, accessError: false, order: { courierId: "c1", courierDeliveryStatus: status } })).toBe(expected);
  });

  test("noma'lum/kutilmagan courierDeliveryStatus uchun 'unknown' qaytaradi", () => {
    expect(resolveTrackingView({ loading: false, accessError: false, order: { courierId: "c1", courierDeliveryStatus: "weird" } })).toBe("unknown");
    expect(resolveTrackingView({ loading: false, accessError: false, order: { courierId: "c1" } })).toBe("unknown");
  });
});
