/**
 * Platforma darajasidagi vaqtinchalik ON/OFF kalitlar.
 *
 * Bu yerdagi bayroqlar - kod ichida tarqoq shart yozishdan ko'ra, BITTA
 * markazlashgan joyda boshqarish uchun. Har birining nima uchun
 * o'chirilgani (yoki yoqilgani) izohda ko'rsatilgan - keyinchalik shart
 * bajarilganda faqat shu faylni o'zgartirish kifoya.
 */

/**
 * ATMOS to'lov tizimi hali ulanmagan (2026-08). Shu sababli:
 *  - Yandex Delivery kuryer chaqirish tugmasi seller buyurtma
 *    boshqaruvida YASHIRILADI - chunki Yandex Delivery pulni
 *    to'g'ridan-to'g'ri platforma egasining (Alisher) o'z Yandex
 *    balansidan yechib oladi, ATMOS orqali avtomatik hisob-kitob
 *    bo'lmagani uchun bu hozircha xavfli/nazoratsiz.
 *  - Online (karta) to'lov - ATMOS emas, "qo'lda karta" oqimi orqali
 *    ishlaydi (seller kartasiga o'tkazma + chek skrinshoti).
 *
 * ATMOS ulangandan keyin bu qiymatni `true`ga o'zgartirish kifoya -
 * Yandex tugmasi avtomatik qayta ko'rinadi (`canDispatchYandex`
 * shartiga bog'langan, src/utils/orderCourierLogic.js).
 */
export const ATMOS_PAYMENT_CONNECTED = false;
