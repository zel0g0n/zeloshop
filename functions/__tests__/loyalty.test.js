/**
 * `loyalty.js` uchun testlar — mijozning o'z SODIQLIK DASTURI
 * ("Bonus hisobi") balansini o'qiydigan, TOR doiradagi onCall
 * funksiya (`sellers/{id}/customers/{clientId}` butun hujjati
 * FAQAT sotuvchi/admin uchun o'qiladigan bo'lgani uchun kerak -
 * batafsil izoh: `loyalty.js`).
 *
 * Haqiqiy Firestore'ga ULANMAYDI — barchasi taqlid qilingan (mock).
 */

function buildMockDb({ sellerData = null, customerData = null } = {}) {
  return {
    collection: (name) => {
      if (name !== "sellers") throw new Error(`Kutilmagan kolleksiya: ${name}`);
      return {
        doc: () => ({
          get: async () => (sellerData ? { exists: true, data: () => sellerData } : { exists: false }),
          collection: (sub) => {
            if (sub !== "customers") throw new Error(`Kutilmagan quyi kolleksiya: ${sub}`);
            return {
              doc: () => ({
                get: async () => (customerData ? { exists: true, data: () => customerData } : { exists: false }),
              }),
            };
          },
        }),
      };
    },
  };
}

function loadModule({ db } = {}) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({ db }));
  jest.doMock("../lib/rateLimit", () => ({ checkRateLimit: jest.fn(async () => undefined) }));
  return require("../loyalty");
}

describe("handleGetMyLoyaltyBalance", () => {
  test("autentifikatsiyasiz chaqiruvni rad etadi", async () => {
    const { _testables } = loadModule({ db: buildMockDb({}) });
    await expect(
      _testables.handleGetMyLoyaltyBalance({ auth: null, data: { sellerId: "s1" } })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("sellerId berilmasa rad etadi", async () => {
    const { _testables } = loadModule({ db: buildMockDb({}) });
    await expect(
      _testables.handleGetMyLoyaltyBalance({ auth: { uid: "c1" }, data: {} })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("sotuvchi hujjati topilmasa - o'chirilgan holat sifatida qaytaradi (xato bermaydi)", async () => {
    const { _testables } = loadModule({ db: buildMockDb({}) });
    const result = await _testables.handleGetMyLoyaltyBalance({ auth: { uid: "c1" }, data: { sellerId: "s1" } });
    expect(result).toEqual({ enabled: false, balance: 0, earnPercent: 0, maxRedeemPercent: 0 });
  });

  test("sotuvchida `loyaltyEnabled` false/yo'q bo'lsa - balans o'qilmasdan 0 qaytaradi", async () => {
    const { _testables } = loadModule({ db: buildMockDb({ sellerData: { loyaltyEnabled: false }, customerData: { bonusBalance: 99999 } }) });
    const result = await _testables.handleGetMyLoyaltyBalance({ auth: { uid: "c1" }, data: { sellerId: "s1" } });
    expect(result).toEqual({ enabled: false, balance: 0, earnPercent: 0, maxRedeemPercent: 0 });
  });

  test("yoqilgan, mijozning yig'ma hujjati hali mavjud bo'lmasa (birinchi xarid) - balans 0", async () => {
    const { _testables } = loadModule({
      db: buildMockDb({ sellerData: { loyaltyEnabled: true, loyaltyEarnPercent: 2, loyaltyMaxRedeemPercent: 30 } }),
    });
    const result = await _testables.handleGetMyLoyaltyBalance({ auth: { uid: "c1" }, data: { sellerId: "s1" } });
    expect(result).toEqual({ enabled: true, balance: 0, earnPercent: 2, maxRedeemPercent: 30 });
  });

  test("yoqilgan, mijozda balans bo'lsa - to'g'ri qaytaradi", async () => {
    const { _testables } = loadModule({
      db: buildMockDb({
        sellerData: { loyaltyEnabled: true, loyaltyEarnPercent: 2, loyaltyMaxRedeemPercent: 30 },
        customerData: { bonusBalance: 12500 },
      }),
    });
    const result = await _testables.handleGetMyLoyaltyBalance({ auth: { uid: "c1" }, data: { sellerId: "s1" } });
    expect(result).toEqual({ enabled: true, balance: 12500, earnPercent: 2, maxRedeemPercent: 30 });
  });

  test("`maxRedeemPercent` sozlanmagan bo'lsa - standart 50% qaytaradi", async () => {
    const { _testables } = loadModule({
      db: buildMockDb({ sellerData: { loyaltyEnabled: true, loyaltyEarnPercent: 5 }, customerData: { bonusBalance: 1000 } }),
    });
    const result = await _testables.handleGetMyLoyaltyBalance({ auth: { uid: "c1" }, data: { sellerId: "s1" } });
    expect(result.maxRedeemPercent).toBe(50);
  });

  test("mijozda manfiy/buzilgan bonusBalance bo'lsa ham - hech qachon manfiy qaytarmaydi", async () => {
    const { _testables } = loadModule({
      db: buildMockDb({ sellerData: { loyaltyEnabled: true }, customerData: { bonusBalance: -500 } }),
    });
    const result = await _testables.handleGetMyLoyaltyBalance({ auth: { uid: "c1" }, data: { sellerId: "s1" } });
    expect(result.balance).toBe(0);
  });
});
