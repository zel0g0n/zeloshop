/**
 * BIZNES BUYRUQ MARKAZI (2026-09, 3-band): panelning tepasida
 * ko'rsatiladigan, PROAKTIV "sun'iy intellekt xulosalari" (masalan:
 * "Oxirgi 7 kunda 'X' mahsuloti sotuvlari 32% kamaydi", "143 ta
 * mijoz qayta xarid qilish ehtimoli yuqori") uchun sof hisob-kitob
 * funksiyalari.
 *
 * MUHIM - HALOLLIK CHEGARASI (loyihaning "MOCK QILMA" qoidasi):
 * bu funksiyalar HAQIQIY sun'iy intellekt/ML BASHORATI EMAS — ular
 * DETERMINISTIK, sof arifmetik tendentsiya/o'rtacha hisob-kitoblari
 * (davrni davr bilan solishtirish, mijozning o'z tarixidagi o'rtacha
 * xarid oralig'i). Buni ATAYLAB HECH QACHON "AI bashorati" deb
 * atamaslik kerak — UI matnida "taxminiy"/"tendentsiya asosida" kabi
 * halol so'zlar ishlatiladi (loyihaning boshqa joylaridagi, masalan
 * Haversine ETA "taxminiy" yorlig'i bilan bir xil naqsh).
 */

const MS_IN_DAY = 24 * 60 * 60 * 1000;

/**
 * Joriy davr bilan OLDINGI (bir xil uzunlikdagi) davrni solishtirib,
 * sezilarli darajada PASAYGAN mahsulotlarni topadi.
 *
 * `previousStats`da yetarli tarix (`minPreviousUnits`dan kam sotuv)
 * bo'lmagan mahsulotlar ATAYLAB chiqarib tashlanadi — "0dan 1ga"
 * kabi tasodifiy o'zgarishlarni "32% pasaydi" deb noto'g'ri talqin
 * qilib yubormaslik uchun (haqiqiy tendentsiya emas, tasodifiy shovqin
 * bo'lishi mumkin).
 *
 * @param {Array} currentStats - `buildProductPeriodStats` natijasi (joriy davr)
 * @param {Array} previousStats - xuddi shu, LEKIN oldingi (bir xil uzunlikdagi) davr uchun
 * @param {{minPreviousUnits?: number, declineThresholdPercent?: number, limit?: number}} [options]
 * @returns {Array<{id, name, previousUnits, currentUnits, changePercent}>} eng katta pasayishdan boshlab
 */
export function computeProductDeclineInsights(currentStats, previousStats, options = {}) {
  const { minPreviousUnits = 3, declineThresholdPercent = 20, limit = 3 } = options;
  const prevMap = new Map((Array.isArray(previousStats) ? previousStats : []).map((p) => [p.id, p]));

  return (Array.isArray(currentStats) ? currentStats : [])
    .map((p) => {
      const prev = prevMap.get(p.id);
      if (!prev || prev.unitsSold < minPreviousUnits) return null; // yetarli tarix yo'q - taxmin qilinmaydi
      const changePercent = ((p.unitsSold - prev.unitsSold) / prev.unitsSold) * 100;
      return {
        id: p.id,
        name: p.name || "",
        previousUnits: prev.unitsSold,
        currentUnits: p.unitsSold,
        changePercent: Math.round(changePercent * 10) / 10,
      };
    })
    .filter((d) => d !== null && d.changePercent <= -declineThresholdPercent)
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, limit);
}

/**
 * Sezilarli darajada O'SGAN mahsulotlarni topadi — pasayish
 * tahlilining "ijobiy" ko'zgusi (bir xil mantiq, teskari yo'nalish).
 */
export function computeProductGrowthInsights(currentStats, previousStats, options = {}) {
  const { minPreviousUnits = 3, growthThresholdPercent = 20, limit = 3 } = options;
  const prevMap = new Map((Array.isArray(previousStats) ? previousStats : []).map((p) => [p.id, p]));

  return (Array.isArray(currentStats) ? currentStats : [])
    .map((p) => {
      const prev = prevMap.get(p.id);
      if (!prev || prev.unitsSold < minPreviousUnits) return null;
      const changePercent = ((p.unitsSold - prev.unitsSold) / prev.unitsSold) * 100;
      return {
        id: p.id,
        name: p.name || "",
        previousUnits: prev.unitsSold,
        currentUnits: p.unitsSold,
        changePercent: Math.round(changePercent * 10) / 10,
      };
    })
    .filter((d) => d !== null && d.changePercent >= growthThresholdPercent)
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, limit);
}

/**
 * "QAYTA XARID QILISH VAQTI KELGAN" mijozlar — DETERMINISTIK
 * HEVRISTIKA (AI bashorati EMAS): mijozning O'Z TARIXIDAGI o'rtacha
 * xarid oralig'i (`(lastOrderAtMs - firstOrderAtMs) / (orderCount-1)`)
 * bilan "oxirgi xariddan beri o'tgan kun" solishtiriladi — agar
 * o'tgan vaqt o'rtacha oraliqqa YETGAN yoki OSHGAN bo'lsa, mijoz
 * "qayta xarid qilish vaqti kelgan" deb belgilanadi.
 *
 * Kamida 2 marta xarid qilgan (shuning uchun o'zining haqiqiy
 * oralig'i hisoblanadigan) mijozlar hisobga olinadi — bitta marta
 * xarid qilgan mijozning "oralig'i" mavjud emas, soxta son o'ylab
 * topilmaydi.
 *
 * @param {Array<{clientId, orderCount, firstOrderAtMs, lastOrderAtMs}>} customers
 * @param {number} [now]
 */
export function computeReorderDueCustomers(customers, now = Date.now()) {
  return (Array.isArray(customers) ? customers : []).filter((c) => {
    const orderCount = Number(c.orderCount) || 0;
    const firstOrderAtMs = Number(c.firstOrderAtMs) || 0;
    const lastOrderAtMs = Number(c.lastOrderAtMs) || 0;
    if (orderCount < 2 || firstOrderAtMs <= 0 || lastOrderAtMs <= 0) return false;

    const averageIntervalDays = (lastOrderAtMs - firstOrderAtMs) / (orderCount - 1) / MS_IN_DAY;
    if (averageIntervalDays <= 0) return false;

    const daysSinceLastOrder = (now - lastOrderAtMs) / MS_IN_DAY;
    return daysSinceLastOrder >= averageIntervalDays;
  });
}

/**
 * "MIJOZ JALB QILISH" TENDENTSIYASI: so'nggi davrdagi yangi
 * mijozlar sonini oldingi (bir xil uzunlikdagi) davr bilan
 * solishtiradi. `orderRollups`dagi `newCustomersCount` kunlik
 * hisoblagichidan (batafsil izoh: `functions/lib/rollups.js`)
 * to'g'ridan-to'g'ri hisoblanadi.
 *
 * @param {Array<{dateMs:number, newCustomersCount:number}>} days - `useOrderRollups` natijasi
 * @param {number} rangeStart - joriy davr boshlanishi (ms)
 * @param {number} rangeEnd - joriy davr oxiri (ms)
 * @returns {{currentPeriodCount:number, previousPeriodCount:number, changePercent:number|null}}
 */
export function computeNewCustomerTrend(days, rangeStart, rangeEnd) {
  const list = Array.isArray(days) ? days : [];
  const periodLength = rangeEnd - rangeStart;
  const previousStart = rangeStart - periodLength;

  const sumIn = (start, end) => list
    .filter((d) => d.dateMs >= start && d.dateMs < end)
    .reduce((sum, d) => sum + (Number(d.newCustomersCount) || 0), 0);

  const currentPeriodCount = sumIn(rangeStart, rangeEnd);
  const previousPeriodCount = sumIn(previousStart, rangeStart);

  const changePercent = previousPeriodCount > 0
    ? Math.round(((currentPeriodCount - previousPeriodCount) / previousPeriodCount) * 1000) / 10
    : null; // oldingi davrda 0 bo'lsa - foizli o'zgarish ma'nosiz (cheksizlik), taxmin qilinmaydi

  return { currentPeriodCount, previousPeriodCount, changePercent };
}
