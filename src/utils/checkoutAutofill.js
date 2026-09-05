import { formatUzPhone } from "@/utils/phone";

/**
 * "TAKRORLAMANG" (Zero Friction) — xaridor bir sotuvchidan oldin
 * buyurtma bergan bo'lsa, checkout formasidagi telefon/manzilni HAR
 * SAFAR qo'lda qayta kiritishga majburlanmasin. Bu funksiya faqat
 * "eng so'nggi buyurtmadan qanday qiymatlar olinishi kerak"ni
 * hisoblaydi (pure) — qachon qo'llash (masalan, xaridor allaqachon
 * o'zi biror narsa yozgan bo'lsa, ustidan yozib yuborilmasligi kerak)
 * chaqiruvchi tomon (`Checkout.jsx`) zimmasida.
 *
 * `lastOrder` — `getClientOrder.js` bergan, `createdAt desc` bo'yicha
 * saralangan ro'yxatning birinchi elementi (eng so'nggi buyurtma).
 *
 * @param {object|null} lastOrder
 * @returns {{phone: string, address: string, addressMode: 'manual'|'map', mapLocation: {lat:number,lng:number}|null, customerRegion: string}|null}
 */
export function deriveCheckoutAutofill(lastOrder) {
  if (!lastOrder) return null;
  const customer = lastOrder.customer || {};
  const hasMapLocation = Boolean(
    customer.location &&
    typeof customer.location.lat === "number" &&
    typeof customer.location.lng === "number"
  );

  return {
    phone: customer.phone ? formatUzPhone(customer.phone) : "",
    // Agar oldingi buyurtma xaritadan tanlangan bo'lsa, matnli manzil
    // maydoni odatda "Xaritadagi joylashuv: lat, lng" kabi texnik
    // matn bo'ladi — buni matn maydoniga qo'yish o'rniga, xarita
    // rejimini o'zini tiklaymiz (`addressMode`/`mapLocation`).
    address: hasMapLocation ? "" : (customer.address || ""),
    addressMode: hasMapLocation ? "map" : "manual",
    mapLocation: hasMapLocation ? customer.location : null,
    customerRegion: lastOrder.customerRegion || "",
  };
}
