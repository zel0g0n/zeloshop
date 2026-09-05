import { describe, test, expect } from "vitest";
import { computeCustomerSegments } from "./customerSegments";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

const makeCustomer = (overrides = {}) => ({
  clientId: "client-1",
  fullName: "Ali",
  phone: "+998901234567",
  ltv: 100_000,
  orderCount: 1,
  lastOrderAtMs: NOW,
  ...overrides,
});

describe("computeCustomerSegments", () => {
  test("bo'sh mijozlar ro'yxati uchun xavfsiz, bo'sh natija qaytaradi", () => {
    const result = computeCustomerSegments([], NOW);
    expect(result.customers).toHaveLength(0);
    expect(result.averageLtv).toBe(0);
    expect(result.retentionRate).toBe(0);
  });

  test("500,000 so'mdan ko'p sarflagan mijozni VIP deb belgilaydi", () => {
    const customers = [makeCustomer({ ltv: 600_000 })];
    const result = computeCustomerSegments(customers, NOW);
    expect(result.customers[0].segment).toBe("vip");
  });

  test("30 kundan ortiq xarid qilmagan mijozni Xavfda (churn) deb belgilaydi", () => {
    const customers = [makeCustomer({ lastOrderAtMs: NOW - 35 * DAY, ltv: 50_000, orderCount: 2 })];
    const result = computeCustomerSegments(customers, NOW);
    expect(result.customers[0].segment).toBe("churn");
  });

  test("bitta, yaqinda qilingan buyurtmali mijozni 'Yangi' deb belgilaydi", () => {
    const customers = [makeCustomer({ lastOrderAtMs: NOW - 2 * DAY, ltv: 50_000, orderCount: 1 })];
    const result = computeCustomerSegments(customers, NOW);
    expect(result.customers[0].segment).toBe("new");
  });

  test("2+ marta, yaqinda xarid qilgan mijozni 'Doimiy' deb belgilaydi", () => {
    const customers = [makeCustomer({ lastOrderAtMs: NOW - 1 * DAY, ltv: 100_000, orderCount: 2 })];
    const result = computeCustomerSegments(customers, NOW);
    expect(result.customers[0].segment).toBe("regular");
  });

  test("VIP ustuvorligi — hatto churn bo'lsa ham, LTV yuqori bo'lsa VIP", () => {
    const customers = [makeCustomer({ lastOrderAtMs: NOW - 40 * DAY, ltv: 600_000, orderCount: 3 })];
    const result = computeCustomerSegments(customers, NOW);
    expect(result.customers[0].segment).toBe("vip");
  });

  test("mijoz maydonlarini (LTV, buyurtmalar soni) o'zgarishsiz o'tkazadi", () => {
    const customers = [makeCustomer({ ltv: 80_000, orderCount: 2 })];
    const result = computeCustomerSegments(customers, NOW);
    expect(result.customers[0].ltv).toBe(80_000);
    expect(result.customers[0].orderCount).toBe(2);
  });

  test("ism/telefon bo'lmasa, xavfsiz standart qiymatlarga tushadi", () => {
    const customers = [{ clientId: "c1", ltv: 10_000, orderCount: 1, lastOrderAtMs: NOW }];
    const result = computeCustomerSegments(customers, NOW);
    expect(result.customers[0].fullName).toBe("Noma'lum");
    expect(result.customers[0].phone).toBe("");
  });

  test("o'rtacha LTV'ni to'g'ri hisoblaydi (bir necha mijoz bo'yicha)", () => {
    const customers = [
      makeCustomer({ clientId: "c1", ltv: 100_000 }),
      makeCustomer({ clientId: "c2", ltv: 200_000 }),
    ];
    const result = computeCustomerSegments(customers, NOW);
    expect(result.averageLtv).toBe(150_000);
  });

  test("Retention Rate — takroriy xaridorlar foizini to'g'ri hisoblaydi", () => {
    const customers = [
      makeCustomer({ clientId: "c1", orderCount: 2 }), // takroriy
      makeCustomer({ clientId: "c2", orderCount: 1 }), // takroriy emas
    ];
    const result = computeCustomerSegments(customers, NOW);
    expect(result.retentionRate).toBe(50); // 1 dan 2 mijoz — 50%
  });

  test("counts — barcha segmentlar to'g'ri sanaladi", () => {
    const customers = [
      makeCustomer({ clientId: "c-vip", ltv: 600_000, orderCount: 3 }),
      makeCustomer({ clientId: "c-churn", ltv: 10_000, orderCount: 2, lastOrderAtMs: NOW - 40 * DAY }),
      makeCustomer({ clientId: "c-new", ltv: 10_000, orderCount: 1, lastOrderAtMs: NOW - 1 * DAY }),
    ];
    const result = computeCustomerSegments(customers, NOW);
    expect(result.counts).toEqual({ all: 3, vip: 1, churn: 1, regular: 0, new: 1 });
  });

  test("natija LTV bo'yicha kamayish tartibida saralanadi", () => {
    const customers = [
      makeCustomer({ clientId: "c1", ltv: 50_000 }),
      makeCustomer({ clientId: "c2", ltv: 300_000 }),
    ];
    const result = computeCustomerSegments(customers, NOW);
    expect(result.customers[0].clientId).toBe("c2");
  });
});
