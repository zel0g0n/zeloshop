import { YANDEX_DISPATCH_VISIBLE } from "@/config/platformFlags";

/**
 * `OrderCard.jsx` (sotuvchi buyurtma kartochkasi)dagi kuryer/Yandex
 * bilan bog'liq shart mantig'i — sof funksiyalarga chiqarilgan, chunki
 * bu xato qilish oson bo'lgan joy: shaxsiy kuryer allaqachon
 * biriktirilgan bo'lsa, Yandex chaqirish yoki qayta-biriktirish
 * tugmalari noto'g'ri bosqichda ko'rinib qolishi mumkin. Shuning uchun
 * `!order.courierId` sharti komponentdan tashqarida, alohida sinaladi.
 */

/**
 * Yandex Delivery chaqirish tugmasi FAQAT: platforma bayrog'i yoqilgan
 * (`YANDEX_DISPATCH_VISIBLE`, src/config/platformFlags.js), do'konda Yandex yoqilgan, mijoz manzili
 * (koordinatasi) bor, hali Yandex chaqirilmagan, HECH QANDAY shaxsiy
 * kuryer biriktirilmagan, va buyurtma "Yig'ilmoqda" bosqichida bo'lsa
 * ko'rinadi.
 */
export const canDispatchYandex = (order, store) =>
  Boolean(
    YANDEX_DISPATCH_VISIBLE &&
    store?.yandexDeliveryEnabled &&
    order?.customer?.location?.lat &&
    !order?.yandexClaimId &&
    !order?.courierId &&
    order?.status === "processing"
  );

/**
 * Shaxsiy kuryer biriktirilgan, LEKIN u hali "Boshladim" bosmagan —
 * buyurtma hali jismonan yo'lga chiqmagan ("kutilmoqda" paneli
 * ko'rsatilishi kerak bo'lgan holat).
 */
export const isCourierAssignedPending = (order) =>
  Boolean(order?.courierId && order?.courierDeliveryStatus === "assigned");

/**
 * Shaxsiy kuryer HAQIQATAN yo'lda ("Boshladim" bosilgan, hali
 * yetkazilmagan/muvaffaqiyatsiz tugallanmagan).
 */
export const isCourierActiveDelivery = (order) =>
  Boolean(order?.courierId && order?.courierDeliveryStatus === "picked_up");

// Yandex'ning to'liq status ro'yxatidan, sotuvchiga TUSHUNARLI
// qisqa yorliqlarga moslashtirilgan qism — barcha texnik holatlarni
// emas, faqat eng muhim bosqichlarni ko'rsatamiz.
export const YANDEX_STATUS_LABEL_KEYS = {
  new: "yandexStatusSearching",
  estimating: "yandexStatusSearching",
  ready_for_approval: "yandexStatusSearching",
  accepted: "yandexStatusSearching",
  performer_lookup: "yandexStatusSearching",
  performer_draft: "yandexStatusSearching",
  performer_found: "yandexStatusCourierFound",
  pickup_arrived: "yandexStatusCourierFound",
  pickuped: "yandexStatusOnTheWay",
  delivery_arrived: "yandexStatusOnTheWay",
  delivered_finish: "yandexStatusDelivered",
  cancelled: "yandexStatusCancelled",
  cancelled_with_payment: "yandexStatusCancelled",
  cancelled_by_taxi: "yandexStatusCancelled",
  failed: "yandexStatusCancelled",
};
