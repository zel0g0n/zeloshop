import { describe, test, expect } from "vitest";
import { computeCampaignStats, getBestCampaign } from "./campaignStats";

const makeCampaign = (overrides = {}) => ({
  id: "c1",
  title: "Kuzgi aksiya",
  audienceCount: 10,
  couponCode: "KUZGI20",
  sentAtMs: 1000,
  ...overrides,
});

const makeOrder = (overrides = {}) => ({
  status: "delivered",
  createdAt: 2000,
  totalAmount: 100_000,
  appliedCoupon: { code: "KUZGI20" },
  ...overrides,
});

describe("computeCampaignStats", () => {
  test("promokodli kampaniya - mos promokod bilan qilingan yetkazilgan buyurtmalarni to'g'ri jamlaydi", () => {
    const campaigns = [makeCampaign()];
    const orders = [
      makeOrder({ totalAmount: 100_000 }),
      makeOrder({ totalAmount: 50_000 }),
    ];
    const result = computeCampaignStats(campaigns, orders);
    expect(result[0]).toMatchObject({
      isAttributable: true,
      attributedOrders: 2,
      attributedRevenue: 150_000,
    });
  });

  test("promokodSIZ yuborilgan kampaniya - HECH QACHON daromad o'ylab topilmaydi (isAttributable: false)", () => {
    const campaigns = [makeCampaign({ couponCode: null })];
    const orders = [makeOrder()];
    const result = computeCampaignStats(campaigns, orders);
    expect(result[0]).toMatchObject({
      isAttributable: false,
      attributedOrders: null,
      attributedRevenue: null,
    });
  });

  test("kampaniya YUBORILGANDAN OLDIN qilingan buyurtma (bir xil promokod bo'lsa ham) hisobga kirmaydi", () => {
    const campaigns = [makeCampaign({ sentAtMs: 5000 })];
    const orders = [makeOrder({ createdAt: 1000 })]; // kampaniyadan OLDIN
    const result = computeCampaignStats(campaigns, orders);
    expect(result[0].attributedOrders).toBe(0);
    expect(result[0].attributedRevenue).toBe(0);
  });

  test("boshqa promokod bilan qilingan buyurtma hisobga kirmaydi", () => {
    const campaigns = [makeCampaign({ couponCode: "KUZGI20" })];
    const orders = [makeOrder({ appliedCoupon: { code: "BOSHQA10" } })];
    const result = computeCampaignStats(campaigns, orders);
    expect(result[0].attributedOrders).toBe(0);
  });

  test("bekor qilingan/yetkazilmagan buyurtma daromadga qo'shilmaydi", () => {
    const campaigns = [makeCampaign()];
    const orders = [makeOrder({ status: "cancel" }), makeOrder({ status: "new" })];
    const result = computeCampaignStats(campaigns, orders);
    expect(result[0].attributedOrders).toBe(0);
    expect(result[0].attributedRevenue).toBe(0);
  });

  test("eng yangi (sentAtMs) kampaniya birinchi bo'ladi", () => {
    const campaigns = [
      makeCampaign({ id: "old", sentAtMs: 1000 }),
      makeCampaign({ id: "new", sentAtMs: 5000 }),
    ];
    const result = computeCampaignStats(campaigns, []);
    expect(result.map((c) => c.id)).toEqual(["new", "old"]);
  });

  test("bo'sh yoki mavjud bo'lmagan ro'yxatlar bilan ham xatosiz ishlaydi", () => {
    expect(computeCampaignStats([], [])).toEqual([]);
    expect(computeCampaignStats(undefined, undefined)).toEqual([]);
  });
});

describe("getBestCampaign", () => {
  test("ENG KO'P daromad keltirgan (atributsiya mumkin bo'lgan) kampaniyani qaytaradi", () => {
    const stats = [
      { id: "a", isAttributable: true, attributedRevenue: 100_000 },
      { id: "b", isAttributable: true, attributedRevenue: 500_000 },
      { id: "c", isAttributable: false, attributedRevenue: null },
    ];
    expect(getBestCampaign(stats).id).toBe("b");
  });

  test("atributsiya mumkin bo'lgan kampaniya YO'Q bo'lsa - null (soxta 'eng yaxshisi' o'ylab topilmaydi)", () => {
    const stats = [
      { id: "a", isAttributable: false, attributedRevenue: null },
      { id: "b", isAttributable: true, attributedRevenue: 0 },
    ];
    expect(getBestCampaign(stats)).toBeNull();
  });

  test("bo'sh ro'yxat uchun null qaytaradi", () => {
    expect(getBestCampaign([])).toBeNull();
  });
});
