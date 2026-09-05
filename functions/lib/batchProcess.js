/**
 * Ko'p sonli elementni (masalan, sotuvchilar ro'yxati) PARALEL, lekin
 * CHEKLANGAN GURUHLARDA ("batch") qayta ishlash uchun umumiy
 * yordamchi.
 *
 * NEGA KERAK: bir nechta `onSchedule` cron funksiyasi (`sendAiCeoDigests`,
 * `processProductDrafts`, `sendAbandonedCartReminders` va h.k.)
 * ketma-ket (`for...of` + `await`) ishlov berardi - har bir elementda
 * Gemini/Telegram so'rovi bo'lgani uchun, N ta element N marta shu
 * so'rov vaqtini yig'adi. `onSchedule`ning standart timeout'i (agar
 * `timeoutSeconds` ko'rsatilmagan bo'lsa) atigi 60 soniya - 50-100+
 * faol sotuvchida bu chegaradan ANIQ oshib ketadi, funksiya majburan
 * to'xtatiladi va QOLGAN sotuvchilar hech qanday ko'rinadigan xatosiz
 * shu safar hech narsa OLMAYDI. Guruhlab PARALEL ishlov berish umumiy
 * vaqtni ~`batchSize` marta kamaytiradi, lekin baribir bir vaqtning
 * o'zida faqat cheklangan sonli tashqi so'rov yuboradi - Gemini/
 * Telegram API'siga to'satdan zarba bermaslik uchun.
 *
 * MUHIM CHEKLOV (chaqiruvchi tomon hisobga olishi kerak): agar
 * qayta ishlanadigan elementlar orasida BIR XIL sotuvchiga tegishli
 * umumiy o'zgaruvchan holat (masalan navbatdagi chegirmalar sonini
 * hisoblovchi hisoblagich) bo'lsa, o'sha elementlarni PARALEL emas,
 * ketma-ket ishlash kerak (masalan, elementlarni avval sotuvchi
 * bo'yicha guruhlab, keyin har bir GURUHNI shu funksiyaga
 * PARALEL element sifatida berish - guruh ICHIDA esa chaqiruvchi
 * o'zi ketma-ket ishlaydi). Aks holda poyga sharoiti (race condition)
 * yuzaga kelishi mumkin.
 *
 * Har bir elementning xatosi ALOHIDA ushlanadi - bitta elementning
 * xatosi qolgan elementlarni to'xtatib qo'ymaydi (mavjud kodning
 * "bitta sotuvchi xato bersa ham, qolganlar davom etadi" tamoyili
 * bilan bir xil).
 *
 * @param {Array} items
 * @param {(item: any, index: number) => Promise<any>} handler
 * @param {number} [batchSize=10]
 * @returns {Promise<{total: number, successCount: number, failureCount: number}>}
 */
async function processBatched(items, handler, batchSize = 10) {
  const list = Array.isArray(items) ? items : [];
  const size = Number.isInteger(batchSize) && batchSize > 0 ? batchSize : 10;
  let successCount = 0;
  let failureCount = 0;

  for (let start = 0; start < list.length; start += size) {
    const batch = list.slice(start, start + size);
    await Promise.all(
      batch.map((item, i) =>
        Promise.resolve()
          .then(() => handler(item, start + i))
          .then(() => {
            successCount += 1;
          })
          .catch((err) => {
            failureCount += 1;
            console.error("processBatched: elementni qayta ishlashda xatolik:", err);
          })
      )
    );
  }

  return { total: list.length, successCount, failureCount };
}

module.exports = { processBatched };
