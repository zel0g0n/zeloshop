const TASHKENT_TZ = "Asia/Tashkent";

/**
 * Millisekundni "YYYY-MM-DD" kun-kalitiga aylantiradi — TOSHKENT
 * VAQTI bo'yicha (qurilma qaysi vaqt zonasida bo'lishidan qat'i
 * nazar). MUHIM: bu, server tomonidagi yig'ma yozuvlarning kun
 * kalitlari bilan (`functions/lib/rollups.js`dagi
 * `dateKeyFromMillis`, `src/hooks/seller/useOrderRollups.jsx`dagi
 * nusxa) BIR XIL bo'lishi SHART — aks holda, bo'sh kunlarni to'ldirish
 * (pastga qarang) haqiqiy yig'ma yozuvlar bilan mos kelmay qolib,
 * kun ikki marta (turli kalit bilan) ko'rinishi yoki umuman
 * ko'rinmasligi mumkin edi. Uch joyda takrorlangan - loyihaning
 * o'zida allaqachon bor "frontend+backend bir xil mantiq, qo'lda
 * sinxronlangan" naqshi (masalan `deliveryTiers.js`) bilan bir xil.
 */
function dateKeyTashkent(ms) {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: TASHKENT_TZ });
}

/**
 * Kunlik daromad/foyda seriyasini quradi — ENDI xom buyurtmalar
 * ro'yxatidan EMAS, server tomonida oldindan hisoblangan KUNLIK
 * yig'ma yozuvlardan (`useOrderRollups`, batafsil izoh:
 * `functions/orderRollups.js`). Bu, "Barcha vaqt" (10 yillik) kabi
 * uzoq davrlar uchun ham, buyurtmalar soni necha o'n minglab bo'lsa
 * ham, TEZ va ARZON ishlaydi - chunki kirish hajmi endi kunlar
 * soniga bog'liq, buyurtmalar soniga EMAS.
 *
 * MUHIM: natija — oraliqdagi HAR BIR kunni o'z ichiga oladi (hatto
 * o'sha kunda buyurtma bo'lmasa ham, 0 qiymat bilan) — bu faqat
 * 366 kungacha bo'lgan oraliqlarda amal qiladi (uzoqroq oraliqda
 * minglab bo'sh kun qo'shib yubormaslik uchun, faqat HAQIQIY
 * ma'lumoti bor kunlar qaytariladi).
 *
 * @param {Array<{date:string, dateMs:number, revenue:number, cogs:number}>} days
 * @param {number} rangeStart - davr boshlanishi (ms)
 * @param {number} rangeEnd - davr oxiri (ms, standart: hozirgi vaqt)
 * @returns {Array<{date: string, revenue: number, profit: number}>} - sanaga ko'ra o'sish tartibida
 */
export function buildDailyProfitSeriesFromRollups(days, rangeStart, rangeEnd = Date.now()) {
  const dayBuckets = new Map(); // "YYYY-MM-DD" -> { revenue, profit }

  (Array.isArray(days) ? days : [])
    .filter((d) => d.dateMs >= rangeStart && d.dateMs <= rangeEnd)
    .forEach((d) => {
      const revenue = Number(d.revenue) || 0;
      const profit = revenue - (Number(d.cogs) || 0);
      dayBuckets.set(d.date, { revenue, profit });
    });

  const DAY_MS = 24 * 60 * 60 * 1000;
  const totalDays = Math.round((rangeEnd - rangeStart) / DAY_MS);

  if (totalDays > 0 && totalDays <= 366) {
    for (let t = rangeStart; t <= rangeEnd; t += DAY_MS) {
      const dateKey = dateKeyTashkent(t);
      if (!dayBuckets.has(dateKey)) {
        dayBuckets.set(dateKey, { revenue: 0, profit: 0 });
      }
    }
  }

  return Array.from(dayBuckets.entries())
    .map(([date, values]) => ({ date, ...values }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Kunlik seriya asosida qisqa tahlil ko'rsatkichlarini hisoblaydi:
 * eng yuqori kun, o'rtacha kunlik foyda, va tendentsiya o'sishi
 * (seriyaning birinchi yarmi bilan ikkinchi yarmini solishtirib).
 */
export function computeSeriesInsights(series) {
  if (series.length === 0) {
    return { peakDay: null, averageDailyProfit: 0, trendPercent: null };
  }

  const peakDay = series.reduce((best, day) => (day.revenue > best.revenue ? day : best), series[0]);
  const totalProfit = series.reduce((sum, day) => sum + day.profit, 0);
  const averageDailyProfit = Math.round(totalProfit / series.length);

  let trendPercent = null;
  if (series.length >= 2) {
    const mid = Math.floor(series.length / 2);
    const firstHalf = series.slice(0, mid);
    const secondHalf = series.slice(mid);
    const firstAvg = firstHalf.reduce((s, d) => s + d.profit, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, d) => s + d.profit, 0) / secondHalf.length;
    trendPercent = firstAvg !== 0 ? Math.round(((secondAvg - firstAvg) / Math.abs(firstAvg)) * 1000) / 10 : null;
  }

  return { peakDay, averageDailyProfit, trendPercent };
}
