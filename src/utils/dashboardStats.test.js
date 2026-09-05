import { describe, test, expect } from "vitest";
import { computeDashboardStatsFromRollups } from "./dashboardStats";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000; // qat'iy, o'zgarmas nuqta (test har doim bir xil natija berishi uchun)

const makeDay = (overrides = {}) => ({
  dateMs: NOW,
  revenue: 0,
  cogs: 0,
  deliveredCount: 0,
  ordersCreatedCount: 0,
  ...overrides,
});

describe("computeDashboardStatsFromRollups", () => {
  test("bo'sh ma'lumot uchun xavfsiz, nol qiymatlarni qaytaradi", () => {
    const stats = computeDashboardStatsFromRollups([], [], NOW - DAY, NOW - 2 * DAY);
    expect(stats.totalSales).toBe(0);
    expect(stats.ordersCount).toBe(0);
    expect(stats.averageOrderValue).toBe(0);
    expect(stats.growthPercent).toBeNull(); // oldingi davrda savdo yo'q — foizni hisoblab bo'lmaydi
  });

  test("joriy davrdagi kunlarni to'g'ri yig'adi, eski davr chetda qoladi", () => {
    const days = [
      makeDay({ dateMs: NOW, revenue: 100_000, ordersCreatedCount: 1 }),
      makeDay({ dateMs: NOW - 100, revenue: 50_000, ordersCreatedCount: 1 }),
      // Bu — chegaradan OLDINGI (eski) davrga tegishli, hisobga olinmasligi kerak:
      makeDay({ dateMs: NOW - 10 * DAY, revenue: 999_999, ordersCreatedCount: 5 }),
    ];
    const stats = computeDashboardStatsFromRollups(days, [], NOW - DAY, NOW - 2 * DAY);
    expect(stats.totalSales).toBe(150_000);
    expect(stats.ordersCount).toBe(2);
  });

  test("o'sish foizini (growthPercent) to'g'ri hisoblaydi", () => {
    const days = [
      makeDay({ dateMs: NOW, revenue: 150_000 }),
      makeDay({ dateMs: NOW - 1.5 * DAY, revenue: 100_000 }),
    ];
    const stats = computeDashboardStatsFromRollups(days, [], NOW - DAY, NOW - 2 * DAY);
    expect(stats.growthPercent).toBe(50); // (150000-100000)/100000 * 100
  });

  test("sof foydani HAQIQIY yig'ilgan tannarxdan (cogs) hisoblaydi, daromaddan emas", () => {
    const days = [makeDay({ dateMs: NOW, revenue: 100_000, cogs: 60_000, deliveredCount: 1 })];
    const stats = computeDashboardStatsFromRollups(days, [], NOW - DAY, NOW - 2 * DAY);
    expect(stats.netProfit).toBe(40_000);
    expect(stats.profitMargin).toBe(40);
  });

  test("ombor: stock<=3 bo'lgan mahsulotlarni kam qolgan deb belgilaydi", () => {
    const products = [
      { id: "p1", stock: 2 },
      { id: "p2", stock: 10 },
      { id: "p3", stock: 3 },
    ];
    const stats = computeDashboardStatsFromRollups([], products, NOW - DAY, NOW - 2 * DAY);
    expect(stats.lowStockCount).toBe(2);
  });

  test("faol mahsulotlar: isActive ko'rsatilmagan bo'lsa ham FAOL deb hisoblanadi (standart holat)", () => {
    const products = [
      { id: "p1", isActive: true },
      { id: "p2", isActive: false },
      { id: "p3" }, // isActive umuman yo'q — standart bo'yicha FAOL
    ];
    const stats = computeDashboardStatsFromRollups([], products, NOW - DAY, NOW - 2 * DAY);
    expect(stats.activeProductsCount).toBe(2);
  });

  test("o'rtacha chek (averageOrderValue) — FAQAT yetkazilgan buyurtmalar soniga bo'linadi", () => {
    const days = [makeDay({ dateMs: NOW, revenue: 300_000, deliveredCount: 2, ordersCreatedCount: 5 })];
    const stats = computeDashboardStatsFromRollups(days, [], NOW - DAY, NOW - 2 * DAY);
    expect(stats.averageOrderValue).toBe(150_000);
  });

  // REGRESSIYA TESTI: bu funksiya endi kunlik SERVER-SIDE yig'ma
  // yozuvlardan (`orderRollups`) ishlaydi - u yerda faqat "delivered"
  // holatiga o'tgan buyurtmalar `revenue`/`cogs`ga qo'shiladi
  // (`functions/orderRollups.js`), shuning uchun bu funksiyaning
  // o'zi statusni QAYTA filtrlashi SHART EMAS - lekin
  // `ordersCreatedCount` HAR DOIM barcha holatdagi buyurtmalarni
  // o'z ichiga oladi (bu, `functions/orderRollups.js`dagi
  // `incrementOrdersCreatedCount` orqali ta'minlanadi).
  test("ordersCount kunlik yig'ma yozuvdagi 'ordersCreatedCount'dan to'g'ridan-to'g'ri olinadi (barcha holat)", () => {
    const days = [makeDay({ dateMs: NOW, revenue: 100_000, deliveredCount: 1, ordersCreatedCount: 4 })];
    const stats = computeDashboardStatsFromRollups(days, [], NOW - DAY, NOW - 2 * DAY);
    expect(stats.ordersCount).toBe(4);
    expect(stats.totalSales).toBe(100_000);
  });
});
