/**
 * `delivery.js`dagi `handleGetYandexPerformerPosition` uchun testlar
 * (Yandex jonli kuzatish, yangi qo'shilgan funksiya).
 *
 * ASOSIY MAQSAD: (1) faqat BUYURTMA EGASI SOTUVCHI so'ray olishini
 * (boshqa sotuvchining buyurtmasi bo'yicha SO'RALMASLIGINI), va
 * (2) Yandex API javobi to'g'ri {lat, lon} shaklga o'girilishini
 * tasdiqlash.
 */

// MUHIM: `lib/sentry.js`ni soxtalashtiramiz (batafsil izoh:
// `aiCeo.test.js`).
jest.mock("../lib/sentry", () => ({
  withSentry: (fn) => fn,
  SENTRY_DSN: { value: () => null },
  Sentry: { captureException: jest.fn() },
  initSentry: jest.fn(),
}));

function buildMockDb({ orderData = null, yandexDeliveryData = null } = {}) {
  const updateCalls = [];
  return {
    collection: (name) => {
      if (name === "orders") {
        return {
          doc: () => ({
            get: async () => (orderData
              ? { exists: true, data: () => orderData, ref: { update: async (data) => updateCalls.push(data) } }
              : { exists: false }),
          }),
        };
      }
      if (name === "sellers") {
        return {
          doc: () => ({
            collection: () => ({
              doc: () => ({
                get: async () => (yandexDeliveryData ? { exists: true, data: () => yandexDeliveryData } : { exists: false }),
              }),
            }),
          }),
        };
      }
      return { doc: () => ({ get: async () => ({ exists: false }) }) };
    },
    runTransaction: async (callback) => callback({ get: async () => ({ exists: false }), set: () => {} }),
    __updateCalls: updateCalls,
  };
}

function loadModule(db, yandexMock = {}) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: { firestore: { FieldValue: { serverTimestamp: () => "MOCK_TS" } } },
    db,
  }));
  jest.doMock("../lib/yandexDelivery", () => ({
    getPerformerPosition: jest.fn(),
    getTrackingLinks: jest.fn(),
    getClaimInfo: jest.fn(),
    acceptClaim: jest.fn(),
    cancelClaim: jest.fn(),
    ...yandexMock,
  }));
  return require("../delivery");
}

const baseRequest = (overrides = {}) => ({ auth: { uid: "seller-1" }, data: { orderId: "order-1", ...overrides } });

describe("handleGetYandexPerformerPosition", () => {
  test("tizimga kirmagan foydalanuvchi rad etiladi", async () => {
    const { _testables } = loadModule(buildMockDb());
    await expect(_testables.handleGetYandexPerformerPosition({ auth: null, data: {} })).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("boshqa sotuvchining buyurtmasi bo'yicha so'ralsa rad etiladi", async () => {
    const db = buildMockDb({ orderData: { sellerId: "seller-OTHER", yandexClaimId: "claim-1" } });
    const { _testables } = loadModule(db);
    await expect(_testables.handleGetYandexPerformerPosition(baseRequest())).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("buyurtma Yandex Delivery'ga jo'natilmagan bo'lsa rad etiladi", async () => {
    const db = buildMockDb({ orderData: { sellerId: "seller-1", yandexClaimId: null } });
    const { _testables } = loadModule(db);
    await expect(_testables.handleGetYandexPerformerPosition(baseRequest())).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("Yandex Delivery ulanmagan bo'lsa rad etiladi", async () => {
    const db = buildMockDb({ orderData: { sellerId: "seller-1", yandexClaimId: "claim-1" }, yandexDeliveryData: null });
    const { _testables } = loadModule(db);
    await expect(_testables.handleGetYandexPerformerPosition(baseRequest())).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("muvaffaqiyatli holatda {lat, lon} to'g'ri qaytariladi", async () => {
    const db = buildMockDb({
      orderData: { sellerId: "seller-1", yandexClaimId: "claim-1" },
      yandexDeliveryData: { oauthToken: "token-123" },
    });
    const getPerformerPosition = jest.fn().mockResolvedValue({ position: { lat: 41.31, lon: 69.28, timestamp: "2026-01-01T00:00:00Z" } });
    const { _testables } = loadModule(db, { getPerformerPosition });

    const result = await _testables.handleGetYandexPerformerPosition(baseRequest());

    expect(getPerformerPosition).toHaveBeenCalledWith("token-123", "claim-1");
    expect(result).toMatchObject({ lat: 41.31, lon: 69.28 });
  });

  test("kuryer joylashuvi hali mavjud bo'lmasa (position=null) tushunarli xato beriladi", async () => {
    const db = buildMockDb({
      orderData: { sellerId: "seller-1", yandexClaimId: "claim-1" },
      yandexDeliveryData: { oauthToken: "token-123" },
    });
    const getPerformerPosition = jest.fn().mockResolvedValue({ position: null });
    const { _testables } = loadModule(db, { getPerformerPosition });

    await expect(_testables.handleGetYandexPerformerPosition(baseRequest())).rejects.toMatchObject({ code: "failed-precondition" });
  });
});

describe("handleCancelYandexDelivery", () => {
  test("boshqa sotuvchining buyurtmasini bekor qila olmaydi", async () => {
    const db = buildMockDb({ orderData: { sellerId: "boshqa-sotuvchi", yandexClaimId: "claim-1" } });
    const { _testables } = loadModule(db);

    await expect(_testables.handleCancelYandexDelivery(baseRequest())).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("Yandex Delivery'ga jo'natilmagan buyurtmani bekor qila olmaydi", async () => {
    const db = buildMockDb({ orderData: { sellerId: "seller-1" } }); // yandexClaimId yo'q
    const { _testables } = loadModule(db);

    await expect(_testables.handleCancelYandexDelivery(baseRequest())).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("HAQIQIY bekor qilish: eng so'nggi version bilan cancelClaim chaqiradi, buyurtma holatini yangilaydi", async () => {
    const db = buildMockDb({
      orderData: { sellerId: "seller-1", yandexClaimId: "claim-1" },
      yandexDeliveryData: { oauthToken: "token-123" },
    });
    const getClaimInfo = jest.fn()
      .mockResolvedValueOnce({ status: "performer_found", version: 3 }) // bekor qilishdan OLDIN, eng so'nggi holat
      .mockResolvedValueOnce({ status: "cancelled" }); // bekor qilingandan KEYIN, tekshirish uchun
    const cancelClaim = jest.fn().mockResolvedValue({});
    const { _testables } = loadModule(db, { getClaimInfo, cancelClaim });

    const result = await _testables.handleCancelYandexDelivery(baseRequest());

    // MUHIM: `cancelClaim` ENG SO'NGGI (eskirmagan) version (3) bilan
    // chaqirilgani tasdiqlanadi - eskirgan/keshlangan qiymat EMAS.
    expect(cancelClaim).toHaveBeenCalledWith("token-123", "claim-1", "free", 3);
    expect(result.status).toBe("cancelled");
    expect(result.alreadyCancelled).toBe(false);
    // MUHIM TUZATISH TEKSHIRUVI: `yandexClaimId` ham `null`ga
    // o'rnatiladi - aks holda sotuvchi bekor qilingandan keyin
    // HECH QACHON qayta kuryer chaqira olmasdi (`dispatchYandexDelivery`
    // "allaqachon jo'natilgan" xatosi bilan rad etaverardi).
    expect(db.__updateCalls[0]).toMatchObject({ yandexStatus: "cancelled", yandexClaimId: null });
  });

  test("allaqachon bekor qilingan/tugagan bo'lsa, qayta bekor qilishga URINMAYDI (lekin yandexClaimId'ni tozalaydi)", async () => {
    const db = buildMockDb({
      orderData: { sellerId: "seller-1", yandexClaimId: "claim-1" },
      yandexDeliveryData: { oauthToken: "token-123" },
    });
    const getClaimInfo = jest.fn().mockResolvedValue({ status: "cancelled", version: 5 });
    const cancelClaim = jest.fn();
    const { _testables } = loadModule(db, { getClaimInfo, cancelClaim });

    const result = await _testables.handleCancelYandexDelivery(baseRequest());

    expect(cancelClaim).not.toHaveBeenCalled();
    expect(result.alreadyCancelled).toBe(true);
    expect(db.__updateCalls[0]).toMatchObject({ yandexStatus: "cancelled", yandexClaimId: null });
  });

  test("Yandex bekor qilishni RAD ETSA, ANIQ sababini sotuvchiga ko'rsatadi", async () => {
    const db = buildMockDb({
      orderData: { sellerId: "seller-1", yandexClaimId: "claim-1" },
      yandexDeliveryData: { oauthToken: "token-123" },
    });
    const getClaimInfo = jest.fn().mockResolvedValueOnce({ status: "performer_found", version: 2 });
    const cancelClaim = jest.fn().mockRejectedValue({ message: "Rad etildi", body: { message: "free cancellation window has passed" } });
    const { _testables } = loadModule(db, { getClaimInfo, cancelClaim });

    await expect(_testables.handleCancelYandexDelivery(baseRequest())).rejects.toMatchObject({
      code: "failed-precondition",
      message: expect.stringContaining("free cancellation window has passed"),
    });
  });
});

/**
 * `handleDispatchYandexDelivery` - ayniqsa YANGI qo'shilgan
 * `request.data.taxiClass`ning to'g'ri `createAndAcceptClaim`ga
 * yetib borishini tekshirish uchun (v31: tarif sinfi endi doimiy
 * sozlama emas, "Kuryer chaqirish" tugmasi bosilganda HAR SAFAR
 * tanlanadi va shu tanlov to'g'ridan-to'g'ri shu yerga keladi).
 */
function buildDispatchMockDb({ orderData = null, yandexDeliveryData = null, sellerData = null } = {}) {
  const updateCalls = [];
  return {
    collection: (name) => {
      if (name === "orders") {
        return {
          doc: () => ({
            get: async () => (orderData
              ? { exists: true, data: () => orderData, ref: { update: async (data) => updateCalls.push(data) } }
              : { exists: false }),
            update: async (data) => updateCalls.push(data),
          }),
        };
      }
      if (name === "sellers") {
        return {
          doc: () => ({
            get: async () => (sellerData ? { exists: true, data: () => sellerData } : { exists: false }),
            collection: () => ({
              doc: () => ({
                get: async () => (yandexDeliveryData ? { exists: true, data: () => yandexDeliveryData } : { exists: false }),
              }),
            }),
          }),
        };
      }
      return { doc: () => ({ get: async () => ({ exists: false }) }) };
    },
    runTransaction: async (callback) => callback({ get: async () => ({ exists: false }), set: () => {} }),
    __updateCalls: updateCalls,
  };
}

describe("handleDispatchYandexDelivery - taxiClass o'tishi", () => {
  const orderData = {
    sellerId: "seller-1",
    yandexClaimId: null,
    customer: { fullName: "Mijoz", phone: "+998901112233", address: "Toshkent", location: { lat: 41.31, lng: 69.24 } },
    orders: [{ name: "Krem", quantity: 1, price: 50000 }],
  };
  const yandexDeliveryData = { enabled: true, oauthToken: "token-123", pickupLat: 41.3, pickupLng: 69.27, pickupAddress: "Do'kon" };
  const sellerData = { storeName: "Lg Shop", phone: "+998901110000" };

  test("frontend tanlagan taxiClass to'g'ridan-to'g'ri createAndAcceptClaim'ga o'tadi", async () => {
    const db = buildDispatchMockDb({ orderData, yandexDeliveryData, sellerData });
    const createAndAcceptClaim = jest.fn().mockResolvedValue({ id: "claim-1", status: "new" });
    // MUHIM: "ready_for_approval" - aks holda `handleDispatchYandexDelivery`ning
    // ichki qayta-urinish tsikli (`estimating`/`new` holatda 2.5s kutadi,
    // 10 marta) haqiqiy vaqt kutib, Jest test-timeoutiga uchraydi.
    const getClaimInfo = jest.fn().mockResolvedValue({ status: "ready_for_approval", version: 1 });
    const acceptClaim = jest.fn().mockResolvedValue({});
    const { _testables } = loadModule(db, { createAndAcceptClaim, getClaimInfo, acceptClaim });

    await _testables.handleDispatchYandexDelivery(baseRequest({ taxiClass: "courier" }));

    expect(createAndAcceptClaim.mock.calls[0][1]).toMatchObject({ taxiClass: "courier" });
  });

  test("taxiClass berilmasa, undefined sifatida o'tadi (lib qatlamida \"express\"ga qaytadi)", async () => {
    const db = buildDispatchMockDb({ orderData, yandexDeliveryData, sellerData });
    const createAndAcceptClaim = jest.fn().mockResolvedValue({ id: "claim-2", status: "new" });
    const getClaimInfo = jest.fn().mockResolvedValue({ status: "ready_for_approval", version: 1 });
    const acceptClaim = jest.fn().mockResolvedValue({});
    const { _testables } = loadModule(db, { createAndAcceptClaim, getClaimInfo, acceptClaim });

    await _testables.handleDispatchYandexDelivery(baseRequest());

    expect(createAndAcceptClaim.mock.calls[0][1].taxiClass).toBeUndefined();
  });
});
