/**
 * Platforma darajasidagi ON/OFF kalitlar.
 *
 * Bu yerdagi bayroqlar - kod ichida tarqoq shart yozishdan ko'ra, BITTA
 * markazlashgan joyda boshqarish uchun. Har birining nima uchun
 * o'chirilgani (yoki yoqilgani) izohda ko'rsatilgan - keyinchalik shart
 * bajarilganda faqat shu faylni o'zgartirish kifoya.
 */

/**
 * Yandex Delivery kuryer chaqirish tugmasi (sotuvchi va ruxsatli xodim
 * buyurtma kartochkasida) ko'rinadimi. Har bir sotuvchi Yandex Delivery
 * hisobini O'ZI yaratadi va "Yetkazib berish" sozlamalarida O'Z tokenini
 * ulaydi - Yandex puli shu sotuvchining o'z hisobidan yechiladi, ZeloShop
 * platformasida hech qanday pul aylanmasi yo'q. Tugma baribir faqat
 * do'konda Yandex yoqilgan, mijozning koordinatasi bor va buyurtma
 * "Yig'ilmoqda" bosqichida bo'lsagina ko'rinadi. Yashirish uchun: `false`.
 */
export const YANDEX_DISPATCH_VISIBLE = true;
