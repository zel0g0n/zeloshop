/**
 * `lib/customerIntelligence.js` — MIJOZLAR RAZVEDKASI (Advanced
 * Customer Intelligence, Z-Biznes, 2026-09 punkt-royxati, 9-band)
 * sof tasniflash mantig'i uchun testlar.
 */

const {
  VIP_THRESHOLD,
  HIGH_VALUE_THRESHOLD,
  CHURN_DAYS,
  SLEEPING_DAYS,
  PRIMARY_SEGMENT_KEYS,
  TAG_KEYS,
  classifyCustomerIntelligence,
  filterClassifiedCustomers,
} = require("../lib/customerIntelligence");

const MS_IN_DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-04T12:00:00+05:00").getTime();

describe("classifyCustomerIntelligence - primarySegment zinapoyasi", () => {
  test("LTV VIP chegarasidan yuqori bo'lsa - 'vip' (oxirgi xariddan qat'i nazar)", () => {
    const customers = [{ clientId: "c1", ltv: VIP_THRESHOLD, orderCount: 3, lastOrderAtMs: NOW - 200 * MS_IN_DAY, firstOrderAtMs: NOW - 500 * MS_IN_DAY }];
    const { customers: result } = classifyCustomerIntelligence(customers, { now: NOW });
    expect(result[0].primarySegment).toBe("vip");
  });

  test("LTV high_value chegarasida (VIP'dan past) - 'high_value'", () => {
    const customers = [{ clientId: "c1", ltv: HIGH_VALUE_THRESHOLD, orderCount: 3, lastOrderAtMs: NOW, firstOrderAtMs: NOW - 10 * MS_IN_DAY }];
    const { customers: result } = classifyCustomerIntelligence(customers, { now: NOW });
    expect(result[0].primarySegment).toBe("high_value");
  });

  test("LTV VIP'dan bitta so'm kam bo'lsa - 'high_value'ga TUSHMAYDI (agar HIGH_VALUE_THRESHOLD'dan past bo'lsa)", () => {
    const customers = [{ clientId: "c1", ltv: HIGH_VALUE_THRESHOLD - 1, orderCount: 2, lastOrderAtMs: NOW, firstOrderAtMs: NOW - 5 * MS_IN_DAY }];
    const { customers: result } = classifyCustomerIntelligence(customers, { now: NOW });
    expect(result[0].primarySegment).not.toBe("vip");
    expect(result[0].primarySegment).not.toBe("high_value");
  });

  test("SLEEPING_DAYS'dan ko'p kun xarid qilmagan (past LTV) - 'sleeping'", () => {
    const customers = [{ clientId: "c1", ltv: 10_000, orderCount: 1, lastOrderAtMs: NOW - (SLEEPING_DAYS + 1) * MS_IN_DAY }];
    const { customers: result } = classifyCustomerIntelligence(customers, { now: NOW });
    expect(result[0].primarySegment).toBe("sleeping");
  });

  test("CHURN_DAYS'dan ko'p, lekin SLEEPING_DAYS'dan kam - 'churn_risk'", () => {
    const customers = [{ clientId: "c1", ltv: 10_000, orderCount: 1, lastOrderAtMs: NOW - (CHURN_DAYS + 1) * MS_IN_DAY }];
    const { customers: result } = classifyCustomerIntelligence(customers, { now: NOW });
    expect(result[0].primarySegment).toBe("churn_risk");
  });

  test("o'z tarixidagi o'rtacha xarid oralig'idan ORQADA qolgan (lekin CHURN_DAYS'dan kam kun) - 'at_risk'", () => {
    // Mijoz har 10 kunda xarid qiladi (5 marta, 40 kun oralig'ida) - so'nggi xariddan 15 kun o'tgan (>10, lekin <30).
    const customers = [{
      clientId: "c1", ltv: 10_000, orderCount: 5,
      firstOrderAtMs: NOW - 55 * MS_IN_DAY, lastOrderAtMs: NOW - 15 * MS_IN_DAY,
    }];
    const { customers: result } = classifyCustomerIntelligence(customers, { now: NOW });
    expect(result[0].primarySegment).toBe("at_risk");
  });

  test("bitta buyurtma qilgan - 'new'", () => {
    const customers = [{ clientId: "c1", ltv: 10_000, orderCount: 1, lastOrderAtMs: NOW }];
    const { customers: result } = classifyCustomerIntelligence(customers, { now: NOW });
    expect(result[0].primarySegment).toBe("new");
  });

  test("bir necha marta xarid qilgan, hech qanday shartga to'g'ri kelmasa - 'returning'", () => {
    const customers = [{
      clientId: "c1", ltv: 10_000, orderCount: 3,
      firstOrderAtMs: NOW - 20 * MS_IN_DAY, lastOrderAtMs: NOW - 2 * MS_IN_DAY,
    }];
    const { customers: result } = classifyCustomerIntelligence(customers, { now: NOW });
    expect(result[0].primarySegment).toBe("returning");
  });

  test("2 marta xarid qilgan, lekin firstOrderAtMs yo'q (eski/migratsiyadan oldingi yozuv) - at_risk EMAS, 'returning'", () => {
    const customers = [{ clientId: "c1", ltv: 10_000, orderCount: 2, lastOrderAtMs: NOW - 5 * MS_IN_DAY }];
    const { customers: result } = classifyCustomerIntelligence(customers, { now: NOW });
    expect(result[0].primarySegment).toBe("returning");
  });

  test("VIP ustuvorligi ENG YUQORI - sleeping/churn shartlariga ham mos kelsa, baribir 'vip'", () => {
    const customers = [{ clientId: "c1", ltv: VIP_THRESHOLD + 1, orderCount: 2, lastOrderAtMs: NOW - (SLEEPING_DAYS + 10) * MS_IN_DAY }];
    const { customers: result } = classifyCustomerIntelligence(customers, { now: NOW });
    expect(result[0].primarySegment).toBe("vip");
  });

  test("HAR BIR mijoz ANIQ BITTA segmentga tegishli (PRIMARY_SEGMENT_KEYS'dan biri)", () => {
    const customers = [
      { clientId: "c1", ltv: 600_000, orderCount: 2, lastOrderAtMs: NOW },
      { clientId: "c2", ltv: 10_000, orderCount: 1, lastOrderAtMs: NOW },
    ];
    const { customers: result } = classifyCustomerIntelligence(customers, { now: NOW });
    result.forEach((c) => expect(PRIMARY_SEGMENT_KEYS).toContain(c.primarySegment));
  });
});

describe("classifyCustomerIntelligence - tags (discount_hunter, high_intent)", () => {
  test("discount_hunter: buyurtmalarining kamida yarmi promokod bilan bo'lsa VA kamida 2 buyurtma bo'lsa", () => {
    const customers = [{ clientId: "c1", ltv: 10_000, orderCount: 4, couponOrderCount: 2, lastOrderAtMs: NOW }];
    const { customers: result } = classifyCustomerIntelligence(customers, { now: NOW });
    expect(result[0].tags).toContain("discount_hunter");
  });

  test("discount_hunter: nisbat yarmidan kam bo'lsa - belgilanmaydi", () => {
    const customers = [{ clientId: "c1", ltv: 10_000, orderCount: 4, couponOrderCount: 1, lastOrderAtMs: NOW }];
    const { customers: result } = classifyCustomerIntelligence(customers, { now: NOW });
    expect(result[0].tags).not.toContain("discount_hunter");
  });

  test("discount_hunter: FAQAT 1 buyurtma bo'lsa (hatto promokod bilan bo'lsa ham) - belgilanmaydi (tarix yetarli emas)", () => {
    const customers = [{ clientId: "c1", ltv: 10_000, orderCount: 1, couponOrderCount: 1, lastOrderAtMs: NOW }];
    const { customers: result } = classifyCustomerIntelligence(customers, { now: NOW });
    expect(result[0].tags).not.toContain("discount_hunter");
  });

  test("high_intent: chaqiruvchi tomonidan berilgan to'plamda mavjud clientId'larga belgilanadi", () => {
    const customers = [
      { clientId: "c1", ltv: 10_000, orderCount: 1, lastOrderAtMs: NOW },
      { clientId: "c2", ltv: 10_000, orderCount: 1, lastOrderAtMs: NOW },
    ];
    const { customers: result } = classifyCustomerIntelligence(customers, { now: NOW, highIntentClientIds: new Set(["c1"]) });
    expect(result.find((c) => c.clientId === "c1").tags).toContain("high_intent");
    expect(result.find((c) => c.clientId === "c2").tags).not.toContain("high_intent");
  });

  test("bitta mijoz IKKALA belgiga HAM ega bo'lishi mumkin (mustaqil o'lchamlar)", () => {
    const customers = [{ clientId: "c1", ltv: 10_000, orderCount: 2, couponOrderCount: 2, lastOrderAtMs: NOW }];
    const { customers: result } = classifyCustomerIntelligence(customers, { now: NOW, highIntentClientIds: new Set(["c1"]) });
    expect(result[0].tags).toEqual(expect.arrayContaining(["discount_hunter", "high_intent"]));
    expect(result[0].tags).toHaveLength(2);
  });

  test("highIntentClientIds berilmasa (standart) - hech kimga high_intent belgilanmaydi, xato tashlanmaydi", () => {
    const customers = [{ clientId: "c1", ltv: 10_000, orderCount: 1, lastOrderAtMs: NOW }];
    const { customers: result } = classifyCustomerIntelligence(customers, { now: NOW });
    expect(result[0].tags).toEqual([]);
  });
});

describe("classifyCustomerIntelligence - counts/tagCounts va umumiy xatti-harakat", () => {
  test("bo'sh/noto'g'ri kirish - bo'sh natija, xato tashlanmaydi", () => {
    expect(classifyCustomerIntelligence(null).customers).toEqual([]);
    expect(classifyCustomerIntelligence(undefined).counts.all).toBe(0);
  });

  test("counts VA tagCounts TO'G'RI hisoblanadi", () => {
    const customers = [
      { clientId: "c1", ltv: 600_000, orderCount: 2, lastOrderAtMs: NOW }, // vip
      { clientId: "c2", ltv: 10_000, orderCount: 1, lastOrderAtMs: NOW }, // new
      { clientId: "c3", ltv: 10_000, orderCount: 4, couponOrderCount: 3, lastOrderAtMs: NOW }, // returning + discount_hunter
    ];
    const { counts, tagCounts } = classifyCustomerIntelligence(customers, { now: NOW });
    expect(counts).toEqual({ all: 3, vip: 1, high_value: 0, sleeping: 0, churn_risk: 0, at_risk: 0, new: 1, returning: 1 });
    expect(tagCounts).toEqual({ discount_hunter: 1, high_intent: 0 });
  });

  test("natija LTV bo'yicha KAMAYISH tartibida saralanadi", () => {
    const customers = [
      { clientId: "c1", ltv: 10_000, orderCount: 1, lastOrderAtMs: NOW },
      { clientId: "c2", ltv: 500_000, orderCount: 1, lastOrderAtMs: NOW },
      { clientId: "c3", ltv: 100_000, orderCount: 1, lastOrderAtMs: NOW },
    ];
    const { customers: result } = classifyCustomerIntelligence(customers, { now: NOW });
    expect(result.map((c) => c.clientId)).toEqual(["c2", "c3", "c1"]);
  });

  test("ismi bo'lmagan mijoz - 'Noma'lum' bilan almashtiriladi", () => {
    const customers = [{ clientId: "c1", ltv: 0, orderCount: 1, lastOrderAtMs: NOW }];
    const { customers: result } = classifyCustomerIntelligence(customers, { now: NOW });
    expect(result[0].fullName).toBe("Noma'lum");
  });
});

describe("filterClassifiedCustomers", () => {
  const classified = [
    { clientId: "c1", primarySegment: "vip", tags: ["discount_hunter"], ltv: 600_000 },
    { clientId: "c2", primarySegment: "churn_risk", tags: [], ltv: 100_000 },
    { clientId: "c3", primarySegment: "churn_risk", tags: ["high_intent"], ltv: 50_000 },
  ];

  test("segment berilsa - FAQAT o'sha segmentga mos ro'yxat qaytadi", () => {
    expect(filterClassifiedCustomers(classified, { segment: "churn_risk" }).map((c) => c.clientId)).toEqual(["c2", "c3"]);
  });

  test("segment 'all' bo'lsa (yoki berilmasa) - HAMMASI qaytadi", () => {
    expect(filterClassifiedCustomers(classified, { segment: "all" })).toHaveLength(3);
    expect(filterClassifiedCustomers(classified, {})).toHaveLength(3);
  });

  test("tag berilsa - FAQAT o'sha belgiga ega mijozlar qaytadi", () => {
    expect(filterClassifiedCustomers(classified, { tag: "high_intent" }).map((c) => c.clientId)).toEqual(["c3"]);
  });

  test("segment VA tag BIRGA berilsa - IKKALASIGA ham mos kelganlar qaytadi", () => {
    expect(filterClassifiedCustomers(classified, { segment: "churn_risk", tag: "high_intent" }).map((c) => c.clientId)).toEqual(["c3"]);
  });

  test("limit berilsa - natija shu sonda kesiladi", () => {
    expect(filterClassifiedCustomers(classified, { limit: 1 })).toHaveLength(1);
  });

  test("noto'g'ri/bo'sh kirish - bo'sh ro'yxat qaytadi, xato tashlanmaydi", () => {
    expect(filterClassifiedCustomers(null, { segment: "vip" })).toEqual([]);
  });
});

test("TAG_KEYS aynan ikkita, PRIMARY_SEGMENT_KEYS aynan yettita kalitdan iborat", () => {
  expect(PRIMARY_SEGMENT_KEYS).toHaveLength(7);
  expect(TAG_KEYS).toEqual(["discount_hunter", "high_intent"]);
});
