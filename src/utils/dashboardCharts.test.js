import { describe, it, expect } from "vitest";
import {
  startOfTashkentDay, getChartRange, buildDailySeries, niceScale, formatCompact,
  formatMoney, countOrdersByStatus, topProductsBySold, lowStockProducts,
} from "./dashboardCharts";

const DAY = 86400000;
// 2026-10-08 12:00 Toshkent = 07:00 UTC
const NOW = Date.UTC(2026, 9, 8, 7, 0, 0);

describe("startOfTashkentDay", () => {
  it("Toshkent yarim tunini qaytaradi", () => {
    expect(startOfTashkentDay(NOW)).toBe(Date.UTC(2026, 9, 7, 19, 0, 0));
  });
  it("UTC bo'yicha hali oldingi kun, Toshkentda esa yangi kun", () => {
    const ms = Date.UTC(2026, 9, 7, 20, 30, 0); // 01:30 Toshkent, 8-oktyabr
    expect(startOfTashkentDay(ms)).toBe(Date.UTC(2026, 9, 7, 19, 0, 0));
  });
});

describe("getChartRange", () => {
  it("Bugun/Hafta — oxirgi 7 kun", () => {
    const r = getChartRange("Hafta", NOW);
    expect((r.endMs - r.startMs) / DAY).toBe(7);
    expect(r.endMs).toBe(startOfTashkentDay(NOW) + DAY);
  });
  it("Oy — joriy oy 1-kunidan bugungacha", () => {
    const r = getChartRange("Oy", NOW);
    expect(r.startMs).toBe(Date.UTC(2026, 8, 30, 19, 0, 0));
    expect((r.endMs - r.startMs) / DAY).toBe(8);
  });
  it("o'tgan oy — to'liq kunlar", () => {
    const start = new Date(2026, 8, 1).getTime();
    const end = new Date(2026, 9, 1).getTime();
    const r = getChartRange("Oy", NOW, { start, end }, 1);
    expect((r.endMs - r.startMs) / DAY).toBe(30);
  });
});

describe("buildDailySeries", () => {
  it("bo'sh kunlarni 0 bilan to'ldiradi", () => {
    const today = startOfTashkentDay(NOW);
    const days = [{ dateMs: today, revenue: 1000, cogs: 400, ordersCreatedCount: 3 }];
    const s = buildDailySeries(days, today - 2 * DAY, today + DAY);
    expect(s).toHaveLength(3);
    expect(s[0]).toMatchObject({ revenue: 0, profit: 0, orders: 0 });
    expect(s[2]).toMatchObject({ revenue: 1000, profit: 600, orders: 3 });
  });
  it("bo'sh kirishda ham ishlaydi", () => {
    expect(buildDailySeries(null, 0, DAY * 2)).toHaveLength(2);
  });
});

describe("niceScale", () => {
  it("chiroyli qadam tanlaydi", () => {
    expect(niceScale(1000000).ticks).toEqual([0, 250000, 500000, 750000, 1000000]);
  });
  it("0 qiymatda ham ishlaydi", () => {
    const s = niceScale(0);
    expect(s.max).toBeGreaterThan(0);
    expect(s.ticks[0]).toBe(0);
  });
  it("max har doim qiymatni qamrab oladi", () => {
    expect(niceScale(1234567).max).toBeGreaterThanOrEqual(1234567);
  });
});

describe("format", () => {
  it("formatCompact", () => {
    expect(formatCompact(1250000)).toBe("1,3 mln");
    expect(formatCompact(45000)).toBe("45 ming");
    expect(formatCompact(800)).toBe("800");
    expect(formatCompact(2500000000)).toBe("2,5 mlrd");
  });
  it("formatMoney", () => {
    expect(formatMoney(1250000)).toBe("1 250 000");
    expect(formatMoney(null)).toBe("0");
  });
});

describe("holat va mahsulot yordamchilari", () => {
  it("countOrdersByStatus", () => {
    const r = countOrdersByStatus([{ status: "new" }, { status: "new" }, { status: "x" }], ["new", "cancel"]);
    expect(r).toEqual([{ status: "new", count: 2 }, { status: "cancel", count: 0 }]);
  });
  it("topProductsBySold", () => {
    const r = topProductsBySold([{ id: 1, sold: 2 }, { id: 2, sold: 9 }, { id: 3, sold: 0 }], 5);
    expect(r.map((p) => p.id)).toEqual([2, 1]);
  });
  it("lowStockProducts", () => {
    const r = lowStockProducts([{ id: 1, stock: 3 }, { id: 2, stock: 0 }, { id: 3, stock: 9 }, { id: 4, stock: 1, isActive: false }]);
    expect(r.map((p) => p.id)).toEqual([2, 1]);
  });
});
