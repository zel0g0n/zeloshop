/**
 * `lib/deliveryTiers.js` uchun testlar - `src/constants/deliveryTiers.js`
 * (frontend) bilan BIR XIL natija berishini tasdiqlaydi (izchillik
 * eng muhim narsa - mijozga ko'rsatilgan narx serverda hisoblangan
 * narx bilan TENG bo'lishi SHART).
 */
const { resolveDeliveryTier } = require("../lib/deliveryTiers");

describe("resolveDeliveryTier (backend)", () => {
  test("hududlar ANIQ bir xil bo'lsa - 'sameCity'", () => {
    expect(resolveDeliveryTier("Xorazm", "Xorazm")).toBe("sameCity");
  });

  test("Toshkent shahri + Toshkent viloyati - 'sameRegionDistricts'", () => {
    expect(resolveDeliveryTier("Toshkent shahri", "Toshkent viloyati")).toBe("sameRegionDistricts");
  });

  test("butunlay boshqa viloyat - 'otherRegions'", () => {
    expect(resolveDeliveryTier("Xorazm", "Andijon")).toBe("otherRegions");
  });

  test("hudud berilmagan bo'lsa, null qaytaradi", () => {
    expect(resolveDeliveryTier(null, "Xorazm")).toBeNull();
    expect(resolveDeliveryTier("Xorazm", null)).toBeNull();
  });
});
