/**
 * MAHSULOT KARTOCHKASIDAGI "BUGUN SOTILDI" IJTIMOIY ISBOT BELGISI (#119).
 *
 * QARORNI QAYTA KO'RIB CHIQISH NATIJASI: kodda ataylab qo'yilgan
 * "hech qanday raqam o'ylab topilmaydi / soxta shoshilinchlik
 * yaratilmaydi" tamoyili (`src/utils/productSignals.js`,
 * `sellerTrustBadges.js` bilan bir xil) BUZILMAYDI — bu yerda HECH
 * QANDAY soxta "hozir N kishi ko'rmoqda" turdagi hisoblagich yo'q.
 * Faqat HAQIQIY, shu kun ichida yakunlangan (buyurtma yaratilgan)
 * sotuvlar soni hisoblanadi, va frontend (`computeTodaySoldSignal`,
 * `productSignals.js`) buni faqat YETARLICHA katta bo'lsagina
 * ko'rsatadi (masalan "bugun 1 marta sotildi" ishonchni
 * kuchaytirmaydi, aksincha shubha uyg'otishi mumkin).
 *
 * TEXNIK YECHIM: har bir mahsulot hujjatida ikkita maydon saqlanadi -
 * `soldTodayCount` (bugungi sana uchun hisoblagich) va
 * `soldTodayDate` (oxirgi yangilangan sana, "YYYY-MM-DD",
 * Osiyo/Toshkent vaqti - `lib/dailyStats.js`dagi `todayDocId()` bilan
 * BIR XIL formatda). Har kuni BARCHA mahsulotlarni "nolga tushirish"
 * uchun alohida (qimmat, keraksiz) cron FUNKSIYASI YO'Q - buning
 * o'rniga "dangasa" (lazy) reset: agar saqlangan sana bugungidan farq
 * qilsa, hisoblagich shu yerning o'zida nolga tushirilib qayta
 * boshlanadi. Bu `functions/orders.js`dagi buyurtma yaratish
 * TRANZAKSIYASI ichida chaqiriladi - `productSnaps[i]` allaqachon
 * shu tranzaksiya orqali o'qilgan, qo'shimcha o'qish shart emas.
 */

/**
 * @param {{soldTodayCount?: number, soldTodayDate?: string}|undefined} product - joriy mahsulot hujjati ma'lumotlari
 * @param {string} todayDateId - bugungi sana, "YYYY-MM-DD" (`todayDocId()`)
 * @param {number} quantityToAdd - shu buyurtmada sotilgan miqdor
 * @returns {{soldTodayCount: number, soldTodayDate: string}}
 */
function computeDailySoldCountUpdate(product, todayDateId, quantityToAdd) {
  const isSameDay = product?.soldTodayDate === todayDateId;
  const currentCount = isSameDay ? Number(product?.soldTodayCount) || 0 : 0;
  const addedQuantity = Number(quantityToAdd) || 0;
  return {
    soldTodayCount: currentCount + addedQuantity,
    soldTodayDate: todayDateId,
  };
}

module.exports = { computeDailySoldCountUpdate };
