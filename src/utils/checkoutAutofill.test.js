import { describe, test, expect } from "vitest";
import { deriveCheckoutAutofill } from "./checkoutAutofill";

/**
 * "Checkout'ni takrorlashdan qutqarish" (Zero Friction) tuzatishi
 * uchun testlar — oldin xaridor sotuvchidan 10-marta xarid qilsa ham
 * telefon/manzilni HAR SAFAR qo'lda kiritishga majbur edi
 * (`Checkout.jsx` faqat F.I.Sh'ni Telegramdan avtomatik to'ldirardi).
 */
describe("deriveCheckoutAutofill", () => {
  test("oldingi buyurtma bo'lmasa, null qaytaradi", () => {
    expect(deriveCheckoutAutofill(null)).toBeNull();
    expect(deriveCheckoutAutofill(undefined)).toBeNull();
  });

  test("qo'lda kiritilgan manzilli buyurtmadan telefon/manzilni tiklaydi", () => {
    const lastOrder = {
      customer: { phone: "998901234567", address: "Chilonzor, 12-uy" },
      customerRegion: "Toshkent shahri",
    };
    expect(deriveCheckoutAutofill(lastOrder)).toEqual({
      phone: "+998 90 123 45 67",
      address: "Chilonzor, 12-uy",
      addressMode: "manual",
      mapLocation: null,
      customerRegion: "Toshkent shahri",
    });
  });

  test("xaritadan tanlangan manzilli buyurtma uchun xarita rejimini tiklaydi, matn maydonini emas", () => {
    const lastOrder = {
      customer: {
        phone: "901234567",
        address: "Xaritadagi joylashuv: 41.31000, 69.28000",
        location: { lat: 41.31, lng: 69.28 },
      },
      customerRegion: null,
    };
    const result = deriveCheckoutAutofill(lastOrder);
    expect(result.addressMode).toBe("map");
    expect(result.mapLocation).toEqual({ lat: 41.31, lng: 69.28 });
    // Texnik "Xaritadagi joylashuv: ..." matni matn maydoniga
    // qo'yilmasligi kerak - aks holda xaridor uni tahrirlashi kerak
    // bo'lib qoladi, bu "takrorlamang" tamoyiliga zid.
    expect(result.address).toBe("");
    expect(result.customerRegion).toBe("");
  });

  test("telefon/manzil bo'lmagan buyurtma uchun bo'sh qatorlar qaytaradi, xato tashlamaydi", () => {
    const result = deriveCheckoutAutofill({ customer: {} });
    expect(result.phone).toBe("");
    expect(result.address).toBe("");
    expect(result.addressMode).toBe("manual");
    expect(result.mapLocation).toBeNull();
  });

  test("noto'liq/xato location obyekti bo'lsa (lat/lng son emas), manual rejimga tushadi", () => {
    const lastOrder = {
      customer: { phone: "901234567", address: "", location: { lat: "41.3", lng: null } },
    };
    const result = deriveCheckoutAutofill(lastOrder);
    expect(result.addressMode).toBe("manual");
    expect(result.mapLocation).toBeNull();
  });
});
