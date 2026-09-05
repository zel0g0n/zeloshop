import { describe, test, expect } from "vitest";
import { buildDailyProfitSeriesFromRollups, computeSeriesInsights } from "./profitTimeSeries";

const DAY = 24 * 60 * 60 * 1000;
// Toshkent vaqti bo'yicha aniq belgilangan (peshin, +05:00 ofset bilan)
// vaqt tamg'asi - test ishga tushirilayotgan mashinaning O'Z vaqt
// zonasidan (masalan CI/sandbox'da odatda UTC) MUSTAQIL, har doim
// bir xil "YYYY-MM-DD" kun-kalitiga aylanishini kafolatlaydi.
const day = (n) => new Date(`2026-01-${String(n).padStart(2, "0")}T12:00:00+05:00`).getTime();
const dateKey = (n) => `2026-01-${String(n).padStart(2, "0")}`;

const makeDay = (n, overrides = {}) => ({
  date: dateKey(n),
  dateMs: day(n),
  revenue: 0,
  cogs: 0,
  ...overrides,
});

describe("buildDailyProfitSeriesFromRollups", () => {
  test("kunlik yig'ma yozuvdan daromad/foydani to'g'ri o'tkazadi", () => {
    const days = [makeDay(1, { revenue: 100_000, cogs: 40_000 })];
    const series = buildDailyProfitSeriesFromRollups(days, day(1), day(1));
    expect(series).toHaveLength(1);
    expect(series[0].revenue).toBe(100_000);
    expect(series[0].profit).toBe(60_000); // 100,000 - 40,000 (tannarx allaqachon serverda hisoblangan)
  });

  test("sanaga ko'ra o'sish tartibida saralaydi", () => {
    const days = [
      makeDay(3, { revenue: 10_000 }),
      makeDay(1, { revenue: 20_000 }),
    ];
    const series = buildDailyProfitSeriesFromRollups(days, day(1), day(3));
    expect(series[0].date < series[series.length - 1].date).toBe(true);
  });

  test("davr chegarasidan TASHQARIDAGI kunlarni chetlab o'tadi", () => {
    const days = [makeDay(1, { revenue: 999_999 })];
    const series = buildDailyProfitSeriesFromRollups(days, day(5), day(6));
    // 1-kun chetda qoladi, lekin 5-6-kunlar oralig'i BO'SH kunlar
    // bilan (0 qiymat) to'ldiriladi — shuning uchun natija bo'sh EMAS.
    expect(series.every((d) => d.revenue === 0)).toBe(true);
  });

  // MUHIM: grafik uzilib qolmasligi uchun, oraliqdagi HAR BIR kun
  // (hatto o'sha kunga mos yig'ma yozuv bo'lmasa ham) natijaga
  // kiradi, 0 qiymat bilan.
  test("oraliqdagi BO'SH kunlarni ham 0 qiymat bilan to'ldiradi (grafik uzilib qolmasligi uchun)", () => {
    const days = [
      makeDay(1, { revenue: 70_000, cogs: 20_000 }),
      makeDay(5, { revenue: 40_000, cogs: 10_000 }),
    ];
    const series = buildDailyProfitSeriesFromRollups(days, day(1), day(5));
    // 1,2,3,4,5-kunlar — jami 5 ta kun, hattoki 2,3,4-kunlar uchun
    // yig'ma yozuv bo'lmasa ham.
    expect(series).toHaveLength(5);
    expect(series[1].revenue).toBe(0); // 2-kun — bo'sh
    expect(series[2].revenue).toBe(0); // 3-kun — bo'sh
    expect(series[3].revenue).toBe(0); // 4-kun — bo'sh
  });

  test("juda uzoq oraliqda (366 kundan ortiq) bo'sh kunlarni TO'LDIRMAYDI — faqat haqiqiy kunlarni qaytaradi", () => {
    const days = [makeDay(1, { revenue: 70_000 })];
    const farFuture = day(1) + 400 * DAY;
    const series = buildDailyProfitSeriesFromRollups(days, day(1), farFuture);
    // 400+ kunlik bo'sh qatorlar QO'SHILMAYDI — faqat 1 ta haqiqiy kun.
    expect(series).toHaveLength(1);
  });

  test("bo'sh (hech qanday yig'ma yozuv yo'q) massiv uchun xato bermaydi", () => {
    // day(1)->day(2): 1 kunlik oraliq (0'dan katta) - bo'sh kunlarni
    // to'ldirish qoidasi ishga tushishi uchun (`totalDays > 0` sharti).
    const series = buildDailyProfitSeriesFromRollups([], day(1), day(2));
    expect(series.length).toBeGreaterThan(0);
    expect(series.every((d) => d.revenue === 0)).toBe(true);
  });
});

describe("computeSeriesInsights", () => {
  test("bo'sh seriya uchun xavfsiz standart qiymatlarni qaytaradi", () => {
    const insights = computeSeriesInsights([]);
    expect(insights).toEqual({ peakDay: null, averageDailyProfit: 0, trendPercent: null });
  });

  test("eng yuqori tushumli kunni (peakDay) to'g'ri topadi", () => {
    const series = [
      { date: "2026-01-01", revenue: 100_000, profit: 40_000 },
      { date: "2026-01-02", revenue: 450_000, profit: 200_000 },
      { date: "2026-01-03", revenue: 200_000, profit: 90_000 },
    ];
    const insights = computeSeriesInsights(series);
    expect(insights.peakDay.date).toBe("2026-01-02");
  });

  test("o'rtacha kunlik foydani to'g'ri hisoblaydi", () => {
    const series = [
      { date: "2026-01-01", revenue: 100_000, profit: 60_000 },
      { date: "2026-01-02", revenue: 100_000, profit: 40_000 },
    ];
    const insights = computeSeriesInsights(series);
    expect(insights.averageDailyProfit).toBe(50_000);
  });

  test("ijobiy tendentsiyani (o'sish) to'g'ri hisoblaydi", () => {
    const series = [
      { date: "2026-01-01", revenue: 100_000, profit: 10_000 },
      { date: "2026-01-02", revenue: 100_000, profit: 10_000 },
      { date: "2026-01-03", revenue: 100_000, profit: 20_000 },
      { date: "2026-01-04", revenue: 100_000, profit: 20_000 },
    ];
    const insights = computeSeriesInsights(series);
    expect(insights.trendPercent).toBe(100); // 10k->20k = +100%
  });
});
