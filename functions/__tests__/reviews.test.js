/**
 * `reviews.js` uchun testlar. ASOSIY MAQSAD: sharh qoldirish FAQAT
 * haqiqiy, yetkazib berilgan xaridi bor mijozlarga ruxsat berilishini,
 * va sharhni boshqarish (o'chirish/pin) FAQAT mahsulot egasiga
 * ruxsat berilishini tasdiqlash.
 */

function buildMockDb({ product = null, deliveredOrders = [] } = {}) {
  const reviewsStore = new Map();

  return {
    collection: (name) => {
      if (name === "products") {
        return {
          doc: (productId) => ({
            get: async () => (product ? { exists: true, data: () => product, id: productId } : { exists: false }),
            set: async () => undefined,
            collection: (sub) => {
              if (sub !== "reviews") return {};
              return {
                doc: (reviewId) => ({
                  set: async (data) => reviewsStore.set(reviewId, data),
                  update: async (data) => reviewsStore.set(reviewId, { ...reviewsStore.get(reviewId), ...data }),
                  delete: async () => reviewsStore.delete(reviewId),
                }),
                where: () => ({
                  get: async () => ({
                    forEach: () => {},
                    docs: [],
                  }),
                }),
              };
            },
          }),
        };
      }
      if (name === "orders") {
        return {
          where: () => ({
            where: () => ({
              where: () => ({
                get: async () => ({
                  docs: deliveredOrders.map((o) => ({ data: () => o })),
                }),
              }),
            }),
          }),
        };
      }
      return { doc: () => ({ get: async () => ({ exists: false }) }) };
    },
    batch: () => ({
      update: () => {},
      commit: async () => undefined,
    }),
    // MUHIM: `moderateProductReview` endi `checkRateLimit`ni
    // chaqiradi (avval yo'q edi) - bu, ICHKARIDA `db.runTransaction`
    // ishlatadi. Bu metod avval bu yerda YO'Q edi, shuning uchun
    // tegishli testlar "db.runTransaction is not a function" xatosi
    // bilan buzilardi. Haqiqiy Firestore'da ham xuddi shunday -
    // testlarda hech qachon chegaraga tegmasligi uchun har doim
    // "yangi oyna" deb hisoblaymiz.
    runTransaction: async (callback) => callback({ get: async () => ({ exists: false }), set: () => {} }),
    _reviewsStore: reviewsStore,
  };
}

function loadReviewsModule(mockDb) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: {
      firestore: {
        FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", increment: (n) => ({ __increment: n }) },
      },
    },
    db: mockDb,
    BOT_TOKEN: { value: () => "mock" },
    GEMINI_API_KEY: { value: () => "mock" },
  }));
  jest.doMock("../lib/rateLimit", () => ({ checkRateLimit: jest.fn(async () => undefined) }));
  return require("../reviews");
}

describe("submitProductReview", () => {
  test("tizimga kirmagan foydalanuvchini rad etadi", async () => {
    const mockDb = buildMockDb({});
    const { _testables } = loadReviewsModule(mockDb);
    await expect(
      _testables.handleSubmitProductReview({ auth: null, data: {} })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("1-5 oralig'idan tashqari bahoni rad etadi", async () => {
    const mockDb = buildMockDb({ product: { sellerId: "seller-1" } });
    const { _testables } = loadReviewsModule(mockDb);
    await expect(
      _testables.handleSubmitProductReview({
        auth: { uid: "client-1" },
        data: { productId: "p1", rating: 6, text: "yaxshi" },
      })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("YETKAZILMAGAN (yoki umuman bo'lmagan) xaridi bor mijozni rad etadi", async () => {
    const mockDb = buildMockDb({ product: { sellerId: "seller-1" }, deliveredOrders: [] });
    const { _testables } = loadReviewsModule(mockDb);
    await expect(
      _testables.handleSubmitProductReview({
        auth: { uid: "client-1" },
        data: { productId: "p1", rating: 5, text: "ajoyib!" },
      })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("HAQIQIY, yetkazilgan xaridi bor mijozga sharh qoldirishga ruxsat beradi", async () => {
    const mockDb = buildMockDb({
      product: { sellerId: "seller-1" },
      deliveredOrders: [{ customer: { fullName: "Ali Aliyev" }, orders: [{ id: "p1", quantity: 1 }] }],
    });
    const { _testables } = loadReviewsModule(mockDb);
    const result = await _testables.handleSubmitProductReview({
      auth: { uid: "client-1" },
      data: { productId: "p1", rating: 5, text: "ajoyib mahsulot!" },
    });
    expect(result.success).toBe(true);
    expect(mockDb._reviewsStore.get("client-1").customerName).toBe("Ali Aliyev");
    expect(mockDb._reviewsStore.get("client-1").rating).toBe(5);
  });

  test("photoUrls berilsa - saqlanadi, chegaradan (MAX_REVIEW_PHOTOS) ortig'i kesib tashlanadi", async () => {
    const mockDb = buildMockDb({
      product: { sellerId: "seller-1" },
      deliveredOrders: [{ customer: { fullName: "Ali" }, orders: [{ id: "p1", quantity: 1 }] }],
    });
    const { _testables } = loadReviewsModule(mockDb);
    await _testables.handleSubmitProductReview({
      auth: { uid: "client-1" },
      data: { productId: "p1", rating: 5, text: "zo'r", photoUrls: ["url1", "url2", "url3", "url4"] },
    });
    expect(mockDb._reviewsStore.get("client-1").photoUrls).toEqual(["url1", "url2", "url3"]);
  });

  test("photoUrls berilmasa - bo'sh massiv sifatida saqlanadi", async () => {
    const mockDb = buildMockDb({
      product: { sellerId: "seller-1" },
      deliveredOrders: [{ customer: { fullName: "Ali" }, orders: [{ id: "p1", quantity: 1 }] }],
    });
    const { _testables } = loadReviewsModule(mockDb);
    await _testables.handleSubmitProductReview({
      auth: { uid: "client-1" },
      data: { productId: "p1", rating: 5, text: "zo'r" },
    });
    expect(mockDb._reviewsStore.get("client-1").photoUrls).toEqual([]);
  });

  test("photoUrls ichidagi bo'sh/noto'g'ri turdagi qiymatlar filtrlanadi", async () => {
    const mockDb = buildMockDb({
      product: { sellerId: "seller-1" },
      deliveredOrders: [{ customer: { fullName: "Ali" }, orders: [{ id: "p1", quantity: 1 }] }],
    });
    const { _testables } = loadReviewsModule(mockDb);
    await _testables.handleSubmitProductReview({
      auth: { uid: "client-1" },
      data: { productId: "p1", rating: 5, text: "zo'r", photoUrls: ["url1", "", null, 123, "url2"] },
    });
    expect(mockDb._reviewsStore.get("client-1").photoUrls).toEqual(["url1", "url2"]);
  });

  test("buyurtmada BOSHQA mahsulot bo'lsa (aynan shu mahsulot emas), rad etadi", async () => {
    const mockDb = buildMockDb({
      product: { sellerId: "seller-1" },
      deliveredOrders: [{ customer: { fullName: "Ali" }, orders: [{ id: "boshqa-mahsulot", quantity: 1 }] }],
    });
    const { _testables } = loadReviewsModule(mockDb);
    await expect(
      _testables.handleSubmitProductReview({
        auth: { uid: "client-1" },
        data: { productId: "p1", rating: 5, text: "yaxshi" },
      })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });
});

describe("moderateProductReview", () => {
  test("mahsulot EGASI bo'lmagan sotuvchini rad etadi", async () => {
    const mockDb = buildMockDb({ product: { sellerId: "seller-1" } });
    const { _testables } = loadReviewsModule(mockDb);
    await expect(
      _testables.handleModerateProductReview({
        auth: { uid: "seller-2" }, // boshqa sotuvchi
        data: { productId: "p1", reviewId: "r1", action: "delete" },
      })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("mahsulot EGASI sharhni muvaffaqiyatli o'chira oladi", async () => {
    const mockDb = buildMockDb({ product: { sellerId: "seller-1" } });
    mockDb._reviewsStore.set("r1", { rating: 5 });
    const { _testables } = loadReviewsModule(mockDb);
    const result = await _testables.handleModerateProductReview({
      auth: { uid: "seller-1" },
      data: { productId: "p1", reviewId: "r1", action: "delete" },
    });
    expect(result.success).toBe(true);
    expect(mockDb._reviewsStore.has("r1")).toBe(false);
  });
});
