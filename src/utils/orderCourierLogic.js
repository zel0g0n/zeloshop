import { ATMOS_PAYMENT_CONNECTED } from "@/config/platformFlags";

/**
 * `OrderCard.jsx` (sotuvchi buyurtma kartochkasi)dagi kuryer/Yandex
 * bilan bog'liq shart mantig'i — sof funksiyalarga chiqarilgan, chunki
 * bu xato qilish oson bo'lgan joy: shaxsiy kuryer allaqachon
 * biriktirilgan bo'lsa, Yandex chaqirish yoki qayta-biriktirish
 * tugmalari noto'g'ri bosqichda ko'rinib qolishi mumkin. Shuning uchun
 * `!order.courierId` sharti komponentdan tashqarida, alohida sinaladi.
 */

/**
 * Yandex Delivery chaqirish tugmasi FAQAT: ATMOS to'lov tizimi ulangan
 * (`ATMOS_PAYMENT_CONNECTED`, src/config/platformFlags.js - hozircha
 * `false`, chunki Yandex Delivery pulni platforma egasining o'z
 * balansidan yechadi), do'konda Yandex yoqilgan, mijoz manzili
 * (koordinatasi) bor, hali Yandex chaqirilmagan, HECH QANDAY shaxsiy
 * kuryer biriktirilmagan, va buyurtma "Yig'ilmoqda" bosqichida bo'lsa
 * ko'rinadi.
 */
export const canDispatchYandex = (order, store) =>
  Boolean(
    ATMOS_PAYMENT_CONNECTED &&
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
