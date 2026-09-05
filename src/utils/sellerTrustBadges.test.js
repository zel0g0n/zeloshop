import { describe, test, expect } from "vitest";
import { computeSellerTrustBadges } from "./sellerTrustBadges";

const NOW = new Date("2026-09-01T00:00:00Z").getTime();

describe("computeSellerTrustBadges", () => {
  test("seller null/undefined bo'lsa - bo'sh ro'yxat", () => {
    expect(computeSellerTrustBadges(null, NOW)).toEqual([]);
    expect(computeSellerTrustBadges(undefined, NOW)).toEqual([]);
  });

  test("hech qanday tarixi yo'q YANGI sotuvchi - HECH QANDAY nishon bermaydi (soxta boshlang'ich nishon YO'Q)", () => {
    const seller = { createdAt: { seconds: NOW / 1000 } };
    expect(computeSellerTrustBadges(seller, NOW)).toEqual([]);
  });

  test("5 tadan KAM sharh bo'lsa - reyting YUQORI bo'lsa ham, reyting nishoni BERILMAYDI (yetarli namuna emas)", () => {
    const seller = { trustStats: { ratingSum: 20, ratingCount: 4 } }; // o'rtacha 5.0, lekin faqat 4 ta sharh
    const badges = computeSellerTrustBadges(seller, NOW);
    expect(badges.find((b) => b.key === "highRating")).toBeUndefined();
  });

  test("5+ sharh VA o'rtacha >= 4.5 bo'lsa - highRating nishoni to'g'ri parametr bilan qaytadi", () => {
    const seller = { trustStats: { ratingSum: 47, ratingCount: 10 } }; // 4.7
    const badges = computeSellerTrustBadges(seller, NOW);
    const badge = badges.find((b) => b.key === "highRating");
    expect(badge).toEqual({ key: "highRating", params: { rating: "4.7", count: 10 } });
  });

  test("o'rtacha 4.5dan PAST bo'lsa (masalan 4.0) - highRating nishoni BERILMAYDI", () => {
    const seller = { trustStats: { ratingSum: 40, ratingCount: 10 } };
    const badges = computeSellerTrustBadges(seller, NOW);
    expect(badges.find((b) => b.key === "highRating")).toBeUndefined();
  });

  test("buyurtmalar soni to'g'ri PASTGA yaxlitlangan chegaraga (bucket) qo'yiladi - 47 ta -> '40+' emas, '20+ '(keyingi pastroq chegara)", () => {
    const seller = { trustStats: { completedOrders: 47 } };
    const badges = computeSellerTrustBadges(seller, NOW);
    // 47 >= 20 lekin < 50, shuning uchun eng yaqin PASTKI chegara - 20.
    expect(badges.find((b) => b.key === "orderVolume")).toEqual({ key: "orderVolume", params: { count: 20 } });
  });

  test("buyurtmalar soni 10dan KAM bo'lsa - orderVolume nishoni umuman berilmaydi", () => {
    const seller = { trustStats: { completedOrders: 9 } };
    const badges = computeSellerTrustBadges(seller, NOW);
    expect(badges.find((b) => b.key === "orderVolume")).toBeUndefined();
  });

  test("'Ishonchli sotuvchi' (trustedSeller) - FAQAT hajm VA reyting IKKALASI ham yetarli bo'lsa beriladi", () => {
    const highVolumeLowRating = { trustStats: { completedOrders: 50, ratingSum: 30, ratingCount: 10 } }; // 3.0
    expect(computeSellerTrustBadges(highVolumeLowRating, NOW).find((b) => b.key === "trustedSeller")).toBeUndefined();

    const highRatingLowVolume = { trustStats: { completedOrders: 5, ratingSum: 48, ratingCount: 10 } }; // 4.8, lekin faqat 5 buyurtma
    expect(computeSellerTrustBadges(highRatingLowVolume, NOW).find((b) => b.key === "trustedSeller")).toBeUndefined();

    const both = { trustStats: { completedOrders: 50, ratingSum: 48, ratingCount: 10 } };
    expect(computeSellerTrustBadges(both, NOW).find((b) => b.key === "trustedSeller")).toEqual({ key: "trustedSeller" });
  });

  test("do'kon ochilganiga 1 oydan kam bo'lsa - 'faol' nishoni YO'Q", () => {
    const seller = { createdAt: { seconds: (NOW - 10 * 24 * 60 * 60 * 1000) / 1000 } };
    expect(computeSellerTrustBadges(seller, NOW).find((b) => b.key.startsWith("activeSince"))).toBeUndefined();
  });

  test("do'kon ochilganiga necha OY bo'lganini to'g'ri hisoblaydi (12dan kam)", () => {
    const seller = { createdAt: { seconds: (NOW - 90 * 24 * 60 * 60 * 1000) / 1000 } }; // ~3 oy
    const badge = computeSellerTrustBadges(seller, NOW).find((b) => b.key.startsWith("activeSince"));
    expect(badge).toEqual({ key: "activeSinceMonths", params: { count: 3 } });
  });

  test("do'kon ochilganiga 12+ oy bo'lsa - YIL birligida ko'rsatadi, oy EMAS", () => {
    const seller = { createdAt: { seconds: (NOW - 400 * 24 * 60 * 60 * 1000) / 1000 } }; // ~13.3 oy = 1 yil
    const badge = computeSellerTrustBadges(seller, NOW).find((b) => b.key.startsWith("activeSince"));
    expect(badge).toEqual({ key: "activeSinceYears", params: { count: 1 } });
  });

  test("manfiy/buzuq trustStats qiymatlari (masalan xatolik tufayli increment manfiyga tushib ketsa) - 0 sifatida ishlov beriladi, xato tashlamaydi", () => {
    const seller = { trustStats: { completedOrders: -5, ratingSum: -10, ratingCount: -2 } };
    expect(() => computeSellerTrustBadges(seller, NOW)).not.toThrow();
    expect(computeSellerTrustBadges(seller, NOW)).toEqual([]);
  });

  test("createdAt Firestore Timestamp (`toMillis` metodi bilan) formatida ham to'g'ri ishlaydi", () => {
    const seller = { createdAt: { toMillis: () => NOW - 90 * 24 * 60 * 60 * 1000 } };
    const badge = computeSellerTrustBadges(seller, NOW).find((b) => b.key.startsWith("activeSince"));
    expect(badge).toEqual({ key: "activeSinceMonths", params: { count: 3 } });
  });
});
