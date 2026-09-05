const { computeSellerRatingDelta } = require("../lib/sellerTrustStats");

/**
 * `computeSellerRatingDelta` - sotuvchi darajasidagi reyting
 * yig'indisi/sonini XOM (yaxlitlanmagan) qiymatlardan DELTA orqali
 * saqlab borish uchun sof funksiya. Yumaloqlash xatosi to'planmasligi
 * MUHIM - shuning uchun aynan shu holatlar sinaladi.
 */
describe("computeSellerRatingDelta", () => {
  test("YANGI sharh (before=null) - to'liq rating qo'shiladi, son +1", () => {
    const result = computeSellerRatingDelta(null, { rating: 5 });
    expect(result).toEqual({ ratingSumDelta: 5, ratingCountDelta: 1 });
  });

  test("O'CHIRILGAN sharh (after=null) - rating ayiriladi, son -1", () => {
    const result = computeSellerRatingDelta({ rating: 3 }, null);
    expect(result).toEqual({ ratingSumDelta: -3, ratingCountDelta: -1 });
  });

  test("TAHRIRLANGAN sharh (ikkalasi ham mavjud) - FAQAT farq qo'shiladi, son o'zgarmaydi", () => {
    const result = computeSellerRatingDelta({ rating: 2 }, { rating: 5 });
    expect(result).toEqual({ ratingSumDelta: 3, ratingCountDelta: 0 });
  });

  test("ikkalasi ham null bo'lsa (amalda sodir bo'lmaydi) - hech narsa o'zgarmaydi", () => {
    const result = computeSellerRatingDelta(null, null);
    expect(result).toEqual({ ratingSumDelta: 0, ratingCountDelta: 0 });
  });

  test("bir xil baho bilan qayta yozilsa - delta nolga teng", () => {
    const result = computeSellerRatingDelta({ rating: 4 }, { rating: 4 });
    expect(result).toEqual({ ratingSumDelta: 0, ratingCountDelta: 0 });
  });
});
