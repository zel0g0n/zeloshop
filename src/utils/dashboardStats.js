/**
 * Dashboard uchun KPI statistikasini hisoblaydi. Bu — sof funksiya
 * (React'ga, DOM'ga yoki joriy vaqtga bog'liq emas).
 *
 * Funksiya server tomonida oldindan hisoblangan kunlik yig'ma
 * yozuvlarni (`useOrderRollups`, batafsil izoh:
 * `functions/orderRollups.js`) qabul qiladi — buyurtmalarni har safar
 * qaytadan filtrlab/yig'ish o'rniga. Kirish hajmi buyurtmalar soniga
 * emas, davr ichidagi kunlar soniga bog'liq (eng ko'pi — "Yil" oralig'i
 * uchun ~365 ta kichik hujjat), shuning uchun buyurtmalar sonining
 * o'sishi hisoblash tezligiga ta'sir qilmaydi.
 *
 * "Kutilayotgan buyurtmalar" (`pendingCount`) — davr bo'yicha emas,
 * hozirgi holat ko'rsatkichi bo'lgani uchun kunlik yig'ma yozuvlarga
 * mos kelmaydi va bu funksiya tomonidan qaytarilmaydi; buning o'rniga
 * alohida, yengil `usePendingOrdersCount` hook'i (Firestore `count()`
 * agregatsiyasi) ishlatiladi.
 *
 * @param {Array<{dateMs:number, revenue:number, cogs:number, deliveredCount:number, ordersCreatedCount:number}>} days
 * @param {Array} products - sotuvchining barcha mahsulotlari.
 * @param {number} rangeStart - joriy davr boshlanishi (ms).
 * @param {number} prevRangeStart - oldingi (solishtirish uchun) davr boshlanishi (ms).
 * @param {number} [rangeEnd] - joriy davr TUGASHI (ms, EXCLUSIVE) - ixtiyoriy,
 *   berilmasa cheksiz ("hozirgi vaqtgacha") hisoblanadi. Bu — OY-TANLASH
 *   (`MonthPickerSheet.jsx`) uchun MUHIM: sotuvchi O'TGAN bir oyni tanlasa
 *   (masalan hozir sentyabr, lekin iyulni tanlagan), shu oy ma'lumotlari
 *   FAQAT o'sha oy bilan chegaralanishi kerak - aks holda oradagi
 *   avgust/sentyabr kunlari ham noto'g'ri qo'shilib ketardi.
 */
export function computeDashboardStatsFromRollups(days, products, rangeStart, prevRangeStart, rangeEnd = Infinity) {
  const list = Array.isArray(days) ? days : [];
  const current = list.filter((d) => d.dateMs >= rangeStart && d.dateMs < rangeEnd);
  const previous = list.filter((d) => d.dateMs >= prevRangeStart && d.dateMs < rangeStart);

  const sum = (rows, key) => rows.reduce((s, d) => s + (Number(d[key]) || 0), 0);

  const totalSales = sum(current, "revenue");
  const previousSales = sum(previous, "revenue");
  const growthPercent = previousSales > 0 ? Math.round(((totalSales - previousSales) / previousSales) * 100) : null;

  const totalCost = sum(current, "cogs");
  const netProfit = totalSales - totalCost;
  const profitMargin = totalSales > 0 ? Math.round((netProfit / totalSales) * 100) : 0;

  const deliveredCount = sum(current, "deliveredCount");
  // "ordersCount" — barcha holatdagi buyurtmalarni sanaydi (daromad
  // emas, faoliyat ko'rsatkichi) — Buyurtmalar analitikasidagi "jami
  // buyurtmalar"ga mos kelishi kerak.
  const ordersCount = sum(current, "ordersCreatedCount");

  // "Konversiya" (tashrif->buyurtma nisbati) ko'rsatkichi uchun sahifa
  // tashriflarini kuzatuvchi alohida, server tomonidagi `visits`
  // kolleksiyasi kerak (`Dashboard.jsx`da ishlatiladi). Bu yerda esa
  // to'g'ridan-to'g'ri hisoblanadigan ko'rsatkich — o'rtacha chek.
  const averageOrderValue = deliveredCount > 0 ? Math.round(totalSales / deliveredCount) : 0;

  const lowStockCount = products.filter((p) => Number(p.stock) <= 3).length;
  const activeProductsCount = products.filter((p) => p.isActive ?? true).length;

  return {
    totalSales,
    growthPercent,
    netProfit,
    profitMargin,
    ordersCount,
    deliveredCount,
    activeProductsCount,
    lowStockCount,
    averageOrderValue,
  };
}
