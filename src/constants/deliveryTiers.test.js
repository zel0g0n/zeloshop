import { describe, test, expect } from "vitest";
import { resolveDeliveryTier, hasDistrictTier } from "./deliveryTiers";

describe("resolveDeliveryTier", () => {
  test("hududlar ANIQ bir xil bo'lsa - 'sameCity'", () => {
    expect(resolveDeliveryTier("Xorazm", "Xorazm")).toBe("sameCity");
  });

  test("Toshkent shahri (sotuvchi) + Toshkent viloyati (xaridor) - 'sameRegionDistricts'", () => {
    expect(resolveDeliveryTier("Toshkent shahri", "Toshkent viloyati")).toBe("sameRegionDistricts");
  });

  test("teskari yo'nalish ham to'g'ri ishlaydi (Toshkent viloyati -> Toshkent shahri)", () => {
    expect(resolveDeliveryTier("Toshkent viloyati", "Toshkent shahri")).toBe("sameRegionDistricts");
  });

  test("butunlay boshqa viloyat - 'otherRegions'", () => {
    expect(resolveDeliveryTier("Xorazm", "Andijon")).toBe("otherRegions");
  });

  test("Xorazm sotuvchisi uchun HECH QANDAY boshqa hudud 'sameRegionDistricts' bermaydi (yakka guruh)", () => {
    expect(resolveDeliveryTier("Xorazm", "Buxoro")).toBe("otherRegions");
    expect(resolveDeliveryTier("Xorazm", "Toshkent shahri")).toBe("otherRegions");
  });

  test("hudud berilmagan bo'lsa, null qaytaradi (xato bermaydi)", () => {
    expect(resolveDeliveryTier(null, "Xorazm")).toBeNull();
    expect(resolveDeliveryTier("Xorazm", null)).toBeNull();
    expect(resolveDeliveryTier(null, null)).toBeNull();
  });
});

describe("hasDistrictTier", () => {
  test("Toshkent shahri/viloyati uchun TRUE (haqiqiy 2-bosqich mavjud)", () => {
    expect(hasDistrictTier("Toshkent shahri")).toBe(true);
    expect(hasDistrictTier("Toshkent viloyati")).toBe(true);
  });

  test("boshqa (yakka guruh) viloyatlar uchun FALSE", () => {
    expect(hasDistrictTier("Xorazm")).toBe(false);
    expect(hasDistrictTier("Andijon")).toBe(false);
    expect(hasDistrictTier("Qoraqalpog'iston Respublikasi")).toBe(false);
  });

  test("noma'lum/bo'sh hudud uchun FALSE", () => {
    expect(hasDistrictTier(null)).toBe(false);
    expect(hasDistrictTier("")).toBe(false);
    expect(hasDistrictTier("Notog'ri nom")).toBe(false);
  });
});
