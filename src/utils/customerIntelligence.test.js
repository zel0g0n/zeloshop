import { describe, test, expect } from "vitest";
import { PRIMARY_SEGMENT_KEYS, TAG_KEYS, filterClassifiedCustomers } from "./customerIntelligence";

/**
 * `filterClassifiedCustomers` — `getCustomerIntelligence` onCall
 * natijasini (ALLAQACHON server tomonida tasniflangan) UI'da
 * qo'shimcha so'rovsiz filtrlash uchun. Tasniflashning O'ZI bu yerda
 * SINALMAYDI (backend `functions/lib/customerIntelligence.js`da
 * sinalgan) — faqat mahalliy filtr mantig'i.
 */

const CUSTOMERS = [
  { clientId: "c1", fullName: "Vali Aliyev", phone: "+998901112233", primarySegment: "vip", tags: ["discount_hunter"] },
  { clientId: "c2", fullName: "Sardor Karimov", phone: "+998907778899", primarySegment: "churn_risk", tags: [] },
  { clientId: "c3", fullName: "Nodira Yusupova", phone: "+998935556677", primarySegment: "churn_risk", tags: ["high_intent"] },
];

describe("PRIMARY_SEGMENT_KEYS / TAG_KEYS", () => {
  test("backend `lib/customerIntelligence.js` bilan BIR XIL sondagi kalitlar", () => {
    expect(PRIMARY_SEGMENT_KEYS).toHaveLength(7);
    expect(TAG_KEYS).toEqual(["discount_hunter", "high_intent"]);
  });
});

describe("filterClassifiedCustomers", () => {
  test("segment berilsa - FAQAT o'sha segmentga mos mijozlar qaytadi", () => {
    expect(filterClassifiedCustomers(CUSTOMERS, { segment: "churn_risk" }).map((c) => c.clientId)).toEqual(["c2", "c3"]);
  });

  test("segment 'all' bo'lsa (yoki berilmasa) - HAMMASI qaytadi", () => {
    expect(filterClassifiedCustomers(CUSTOMERS, { segment: "all" })).toHaveLength(3);
    expect(filterClassifiedCustomers(CUSTOMERS, {})).toHaveLength(3);
  });

  test("tag berilsa - FAQAT o'sha belgiga ega mijozlar qaytadi", () => {
    expect(filterClassifiedCustomers(CUSTOMERS, { tag: "high_intent" }).map((c) => c.clientId)).toEqual(["c3"]);
  });

  test("searchText - ism yoki telefon bo'yicha (katta-kichik harfga sezgir emas) qidiradi", () => {
    expect(filterClassifiedCustomers(CUSTOMERS, { searchText: "vali" }).map((c) => c.clientId)).toEqual(["c1"]);
    expect(filterClassifiedCustomers(CUSTOMERS, { searchText: "998907" }).map((c) => c.clientId)).toEqual(["c2"]);
  });

  test("bir nechta filtr BIRGA qo'llanadi (VA mantig'i)", () => {
    expect(filterClassifiedCustomers(CUSTOMERS, { segment: "churn_risk", tag: "high_intent" }).map((c) => c.clientId)).toEqual(["c3"]);
  });

  test("noto'g'ri/bo'sh kirish - xato tashlamaydi, bo'sh ro'yxat qaytaradi", () => {
    expect(filterClassifiedCustomers(null, { segment: "vip" })).toEqual([]);
    expect(filterClassifiedCustomers(undefined, {})).toEqual([]);
  });
});
