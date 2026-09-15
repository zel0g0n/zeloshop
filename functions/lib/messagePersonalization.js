/**
 * Xabar shabloni ichidagi `{ism}` o'rniga mijozning ismini qo'yish —
 * HAQIQIY, oddiy shaxsiylashtirish (mock EMAS). Dastlab
 * `automationRules.js`da (Z-Biznes avtomatlashtirish qoidalari uchun)
 * yozilgan edi — endi CRM broadcast xabarlarida (`notifications.js`dagi
 * `sendCrmNotification`) ham QAYTA ISHLATILADI (2026-09, foydalanuvchi
 * so'rovi: "Mijozlarga xabar yuborish qismini Biznes tarifga
 * moslashtir... haqiqiy productlarda ishlatiladigan top
 * funksiyalardan qo'sh") — mantiq ikki marta yozilmasin uchun shu
 * yerga ko'chirildi.
 */

/**
 * Shablon ichidagi HAR BIR `{ism}` o'rniga mijozning ismini (to'liq
 * ismning BIRINCHI so'zi) qo'yadi. Ism topilmasa, xushmuomala umumiy
 * murojaat bilan almashtiriladi. Shablon `{ism}` umuman ishlatmagan
 * bo'lsa, matn o'zgarishsiz qaytadi (xavfsiz, hech qanday holatda
 * yon ta'sir yo'q).
 */
function personalizeMessage(template, fullName) {
  const firstName = (fullName || "").trim().split(/\s+/)[0] || "";
  return String(template || "").split("{ism}").join(firstName || "Hurmatli mijoz");
}

module.exports = { personalizeMessage };
