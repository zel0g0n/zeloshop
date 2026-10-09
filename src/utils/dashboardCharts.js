// Desktop Dashboard grafiklari uchun SOF yordamchilar (React/DOM'ga
// bog'liq emas) — shu sababli alohida fayl va unit-testlar bilan.
// Kunlar Toshkent vaqti (UTC+5, yozgi vaqt yo'q) bo'yicha hisoblanadi,
// `useOrderRollups` dagi kun kalitlari bilan BIR XIL qoida.

const DAY_MS = 24 * 60 * 60 * 1000;
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Berilgan vaqtning Toshkent kuni boshlanishi (00:00, ms). */
export const startOfTashkentDay = (ms) =>
  Math.floor((ms + TASHKENT_OFFSET_MS) / DAY_MS) * DAY_MS - TASHKENT_OFFSET_MS;

/** Holatlar rangi (donut + legenda) — `ORDER_STATUS_LABELS` ranglariga mos. */
export const STATUS_COLORS = {
  new: "#8b5cf6",
  processing: "#3b82f6",
  shipped: "#f59e0b",
  delivered: "#10b981",
  cancel: "#f43f5e",
};

/**
 * Grafik oralig'i (kunma-kun). "Bugun" va "Hafta" — oxirgi 7 kun (bitta
 * nuqtali grafik ma'nosiz bo'lgani uchun), "Oy" — joriy oyning 1-kunidan
 * bugungacha, yoki o'tgan oy tanlangan bo'lsa shu oyning to'liq kunlari.
 * `monthRange` — `getCalendarMonthRange()` natijasi (faqat o'tgan oy uchun).
 */
export function getChartRange(timeframe, nowMs, monthRange = null, selectedMonthsAgo = 0) {
  const today = startOfTashkentDay(nowMs);
  if (timeframe === "Oy") {
    if (selectedMonthsAgo > 0 && monthRange) {
      return {
        startMs: startOfTashkentDay(monthRange.start + 12 * 60 * 60 * 1000),
        endMs: startOfTashkentDay(monthRange.end - 12 * 60 * 60 * 1000) + DAY_MS,
      };
    }
    const d = new Date(nowMs + TASHKENT_OFFSET_MS);
    const monthStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - TASHKENT_OFFSET_MS;
    return { startMs: monthStart, endMs: today + DAY_MS };
  }
  return { startMs: today - 6 * DAY_MS, endMs: today + DAY_MS };
}

/**
 * Kunlik yig'malardan [startMs, endMs) oralig'ida HAR BIR KUN uchun
 * nuqta quradi (ma'lumot yo'q kun = 0, shunda grafikda bo'shliq bo'lmaydi).
 */
export function buildDailySeries(days, startMs, endMs) {
  const byDay = new Map();
  (Array.isArray(days) ? days : []).forEach((d) => byDay.set(startOfTashkentDay(d.dateMs + 1), d));
  const out = [];
  for (let t = startMs; t < endMs; t += DAY_MS) {
    const d = byDay.get(t);
    const revenue = Number(d?.revenue) || 0;
    const cogs = Number(d?.cogs) || 0;
    out.push({
      dateMs: t,
      revenue,
      profit: revenue - cogs,
      orders: Number(d?.ordersCreatedCount) || 0,
      newCustomers: Number(d?.newCustomersCount) || 0,
    });
  }
  return out;
}

/** Y o'qi uchun "chiroyli" shkala: 0..max, teng qadamli belgilar. */
export function niceScale(maxValue, targetTicks = 4) {
  const max = Number(maxValue) > 0 ? Number(maxValue) : 1;
  const rough = max / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const steps = mag >= 10 ? [1, 2, 2.5, 5, 10] : [1, 2, 5, 10];
  const step = (steps.find((s) => s * mag >= rough) || 10) * mag;
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 1000; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { max: top, step, ticks };
}

/** 1 250 000 -> "1,3 mln", 45 000 -> "45 ming". */
export function formatCompact(value) {
  const n = Math.abs(Number(value) || 0);
  const sign = Number(value) < 0 ? "-" : "";
  const fmt = (x, unit) => `${sign}${(Math.round(x * 10) / 10).toString().replace(".", ",")} ${unit}`;
  if (n >= 1e9) return fmt(n / 1e9, "mlrd");
  if (n >= 1e6) return fmt(n / 1e6, "mln");
  if (n >= 1e3) return fmt(n / 1e3, "ming");
  return `${sign}${Math.round(n)}`;
}

/** 1250000 -> "1 250 000" (oddiy bo'shliq bilan, tor bo'shliqsiz). */
export const formatMoney = (value) =>
  String(Math.round(Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** Buyurtmalarni holat bo'yicha sanaydi (faqat ma'lum 5 holat). */
export function countOrdersByStatus(orders, statusOrder) {
  const counts = Object.fromEntries(statusOrder.map((s) => [s, 0]));
  (orders || []).forEach((o) => {
    if (o.status in counts) counts[o.status] += 1;
  });
  return statusOrder.map((status) => ({ status, count: counts[status] }));
}

/** Eng ko'p sotilgan mahsulotlar (sotuvi 0 bo'lganlar chiqarib tashlanadi). */
export function topProductsBySold(products, limit = 5) {
  return (products || [])
    .map((p) => ({ ...p, soldNum: Number(p.sold) || 0 }))
    .filter((p) => p.soldNum > 0)
    .sort((a, b) => b.soldNum - a.soldNum)
    .slice(0, limit);
}

/** Zaxirasi kam (<=3) faol mahsulotlar, eng kami birinchi. */
export function lowStockProducts(products, limit = 5, threshold = 3) {
  return (products || [])
    .filter((p) => (p.isActive ?? true) && Number(p.stock) <= threshold)
    .sort((a, b) => Number(a.stock) - Number(b.stock))
    .slice(0, limit);
}
