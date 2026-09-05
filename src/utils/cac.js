/**
 * CAC (mijoz jalb qilish narxi — Customer Acquisition Cost) hisob-kitobi.
 * Sof funksiya — P&L paneli (`PnLDashboard.jsx`) uchun.
 *
 * FORMULA: tanlangan davrdagi marketing xarajati / o'sha davrda
 * BIRINCHI marta xarid qilgan (yangi) mijozlar soni.
 *
 * Ikkala tomon ham HAQIQIY ma'lumotdan olinadi: marketing xarajati —
 * sotuvchi qo'lda kiritgan xarajatlar (`category:"marketing"`,
 * `PnLDashboard.jsx`da allaqachon hisoblanadi), yangi mijozlar soni —
 * server tomonida (`functions/lib/rollups.js`) real buyurtma
 * tarixidan hisoblangan `firstOrderAtMs` maydonidan. Hech qanday
 * taxminiy/o'ylab topilgan raqam ishlatilmaydi (MOCK QILMA qoidasi).
 *
 * Migratsiyadan oldingi mijozlarda `firstOrderAtMs` yo'q bo'lishi
 * mumkin (batafsil izoh: `functions/lib/rollups.js`) — bunday
 * mijozlar "yangi mijoz" sifatida HISOBGA OLINMAYDI (soxta sana
 * o'ylab topilmaydi), shuning uchun `backfillSellerRollups` hali
 * ishga tushmagan yoki juda yangi tizimda CAC kam ko'rsatilishi
 * (undercounting) mumkin — bu holat `hasEnoughData` orqali chaqiruvchi
 * tomonga ma'lum qilinadi, lekin raqamning o'zi soxtalashtirilmaydi.
 *
 * @param {Array<{firstOrderAtMs?: number|null}>} customers
 * @param {number} rangeStart - davr boshi (ms, inclusive)
 * @param {number} rangeEnd - davr oxiri (ms, exclusive)
 * @param {number} marketingSpend - shu davrdagi jami marketing xarajati (so'm)
 * @returns {{ newCustomersCount: number, cac: number|null }}
 */
export function computeCac(customers, rangeStart, rangeEnd, marketingSpend) {
  const list = Array.isArray(customers) ? customers : [];
  const start = Number(rangeStart) || 0;
  const end = Number.isFinite(rangeEnd) ? rangeEnd : Infinity;

  const newCustomersCount = list.filter((c) => {
    const firstOrderAtMs = Number(c?.firstOrderAtMs) || 0;
    if (firstOrderAtMs <= 0) return false; // noma'lum - hisobga olinmaydi
    return firstOrderAtMs >= start && firstOrderAtMs < end;
  }).length;

  const spend = Number(marketingSpend) || 0;
  const cac = newCustomersCount > 0 ? Math.round(spend / newCustomersCount) : null;

  return { newCustomersCount, cac };
}
