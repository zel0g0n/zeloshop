import { describe, test, expect } from "vitest";
import {
  computeProductDeclineInsights,
  computeProductGrowthInsights,
  computeReorderDueCustomers,
  computeNewCustomerTrend,
} from "./businessInsights";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("computeProductDeclineInsights", () => {
  test("sezilarli pasaygan mahsulotni to'g'ri aniqlaydi", () => {
    const current = [{ id: "p1", name: "Non", unitsSold: 10 }];
    const previous = [{ id: "p1", name: "Non", unitsSold: 20 }];
    const result = computeProductDeclineInsights(current, previous);
    expect(result).toEqual([{ id: "p1", name: "Non", previousUnits: 20, currentUnits: 10, changePercent: -50 }]);
  });

  test("chegaradan kam pasayish (masalan 10%) ro'yxatga kirmaydi", () => {
    const current = [{ id: "p1", name: "Non", unitsSold: 18 }];
    const previous = [{ id: "p1", name: "Non", unitsSold: 20 }]; // -10%
    expect(computeProductDeclineInsights(current, previous)).toEqual([]);
  });

  test("oldingi davrda yetarli tarix bo'lmagan mahsulot (masalan 1 dona) chiqarib tashlanadi - soxta % hisoblanmaydi", () => {
    const current = [{ id: "p1", name: "Yangi", unitsSold: 0 }];
    const previous = [{ id: "p1", name: "Yangi", unitsSold: 1 }]; // "0dan 1ga" - tasodifiy shovqin bo'lishi mumkin
    expect(computeProductDeclineInsights(current, previous)).toEqual([]);
  });

  test("oldingi davrda UMUMAN sotilmagan (yangi) mahsulot uchun HECH QANDAY o'zgarish % hisoblanmaydi", () => {
    const current = [{ id: "p2", name: "Yangi mahsulot", unitsSold: 5 }];
    const previous = []; // bu mahsulot oldingi davrda umuman yo'q edi
    expect(computeProductDeclineInsights(current, previous)).toEqual([]);
  });

  test("eng katta pasayish birinchi, limit hurmat qilinadi", () => {
    const current = [
      { id: "p1", name: "A", unitsSold: 10 }, // -50%
      { id: "p2", name: "B", unitsSold: 5 }, // -75%
    ];
    const previous = [
      { id: "p1", name: "A", unitsSold: 20 },
      { id: "p2", name: "B", unitsSold: 20 },
    ];
    const result = computeProductDeclineInsights(current, previous, { limit: 1 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p2");
  });

  test("bo'sh/mavjud bo'lmagan ro'yxatlar bilan xatosiz ishlaydi", () => {
    expect(computeProductDeclineInsights([], [])).toEqual([]);
    expect(computeProductDeclineInsights(undefined, undefined)).toEqual([]);
  });
});

describe("computeProductGrowthInsights", () => {
  test("sezilarli o'sgan mahsulotni to'g'ri aniqlaydi", () => {
    const current = [{ id: "p1", name: "Choy", unitsSold: 40 }];
    const previous = [{ id: "p1", name: "Choy", unitsSold: 10 }];
    const result = computeProductGrowthInsights(current, previous);
    expect(result).toEqual([{ id: "p1", name: "Choy", previousUnits: 10, currentUnits: 40, changePercent: 300 }]);
  });

  test("pasaygan mahsulot o'sish ro'yxatiga kirmaydi", () => {
    const current = [{ id: "p1", name: "Non", unitsSold: 5 }];
    const previous = [{ id: "p1", name: "Non", unitsSold: 20 }];
    expect(computeProductGrowthInsights(current, previous)).toEqual([]);
  });
});

describe("computeReorderDueCustomers", () => {
  test("o'rtacha xarid oralig'iga YETGAN (yoki oshgan) mijozni to'g'ri belgilaydi", () => {
    // 2 marta xarid, oralig'i 10 kun, oxirgi xariddan 15 kun o'tgan - MUDDATI KELGAN.
    // (firstOrderAtMs — kodda "0/noma'lum" bilan chalkashmasligi uchun,
    // haqiqiy sanalarga o'xshab, katta boshlang'ich vaqtdan hisoblanadi.)
    const base = 1_000 * DAY_MS;
    const customers = [{ clientId: "c1", orderCount: 2, firstOrderAtMs: base, lastOrderAtMs: base + 10 * DAY_MS }];
    const now = base + 10 * DAY_MS + 15 * DAY_MS;
    expect(computeReorderDueCustomers(customers, now)).toHaveLength(1);
  });

  test("hali o'rtacha oralig'iga YETMAGAN mijoz - hisobga kirmaydi", () => {
    const base = 1_000 * DAY_MS;
    const customers = [
      { clientId: "c1", orderCount: 2, firstOrderAtMs: base, lastOrderAtMs: base + 10 * DAY_MS }, // oralig'i 10 kun
    ];
    const now = base + 10 * DAY_MS + 5 * DAY_MS; // faqat 5 kun o'tgan - hali muddati kelmagan
    expect(computeReorderDueCustomers(customers, now)).toHaveLength(0);
  });

  test("bitta marta xarid qilgan mijoz - o'zining haqiqiy oralig'i yo'q, hisobga OLINMAYDI", () => {
    const customers = [{ clientId: "c1", orderCount: 1, firstOrderAtMs: 0, lastOrderAtMs: 0 }];
    expect(computeReorderDueCustomers(customers, 1000 * DAY_MS)).toHaveLength(0);
  });

  test("firstOrderAtMs noma'lum (migratsiyadan oldingi mijoz) - hisobga OLINMAYDI (soxta oraliq o'ylab topilmaydi)", () => {
    const customers = [{ clientId: "c1", orderCount: 3, firstOrderAtMs: null, lastOrderAtMs: 10 * DAY_MS }];
    expect(computeReorderDueCustomers(customers, 1000 * DAY_MS)).toHaveLength(0);
  });

  test("bo'sh/mavjud bo'lmagan ro'yxat bilan xatosiz ishlaydi", () => {
    expect(computeReorderDueCustomers([])).toEqual([]);
    expect(computeReorderDueCustomers(undefined)).toEqual([]);
  });
});

describe("computeNewCustomerTrend", () => {
  test("joriy va oldingi davrni to'g'ri solishtiradi (o'sish foizi)", () => {
    const days = [
      { dateMs: 0, newCustomersCount: 5 }, // oldingi davr
      { dateMs: 10 * DAY_MS, newCustomersCount: 10 }, // joriy davr
    ];
    const result = computeNewCustomerTrend(days, 10 * DAY_MS, 20 * DAY_MS);
    expect(result).toEqual({ currentPeriodCount: 10, previousPeriodCount: 5, changePercent: 100 });
  });

  test("oldingi davrda 0 bo'lsa - foizli o'zgarish hisoblanmaydi (null, cheksizlik emas)", () => {
    const days = [{ dateMs: 10 * DAY_MS, newCustomersCount: 10 }];
    const result = computeNewCustomerTrend(days, 10 * DAY_MS, 20 * DAY_MS);
    expect(result.changePercent).toBeNull();
    expect(result.currentPeriodCount).toBe(10);
  });

  test("davr chegaralaridan tashqaridagi kunlarni hisobga olmaydi", () => {
    const days = [
      { dateMs: -100 * DAY_MS, newCustomersCount: 999 }, // ancha oldin - chiqarib tashlanadi
      { dateMs: 15 * DAY_MS, newCustomersCount: 3 },
    ];
    const result = computeNewCustomerTrend(days, 10 * DAY_MS, 20 * DAY_MS);
    expect(result.currentPeriodCount).toBe(3);
  });
});
