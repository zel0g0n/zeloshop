/**
 * `birthdayRewards.js`ning `sendBirthdayRewards`i uchun testlar.
 *
 * MUHIM: bu `onSchedule` orqali eksport qilingan - shuning uchun
 * ICHKI mantiqni sinash uchun, `onSchedule`ning ikkinchi argumentini
 * (asosiy handler funksiyani) TO'G'RIDAN-TO'G'RI CHAQIRAMIZ - xuddi
 * `carts.test.js`/`engagementReminders.test.js`dagi bilan bir xil
 * naqsh.
 */

function buildMockDb({
  clientDocs = [],
  sellersData = {},
  existingCouponsBySeller = {},
  customBotTokensBySeller = {},
} = {}) {
  const couponSetCalls = [];
  const dailyStatSetCalls = [];
  const notificationLogAddCalls = [];

  return {
    collection: (name) => {
      if (name === "clients") {
        return {
          where: () => ({
            get: async () => ({
              empty: clientDocs.length === 0,
              docs: clientDocs.map((d) => ({ id: d.id, data: () => d.data })),
            }),
          }),
        };
      }
      if (name === "sellers") {
        return {
          doc: (sellerId) => ({
            get: async () => (
              sellersData[sellerId]
                ? { exists: true, data: () => sellersData[sellerId] }
                : { exists: false }
            ),
            collection: (subName) => {
              if (subName === "coupons") {
                return {
                  doc: (code) => ({
                    set: async (data) => couponSetCalls.push({ sellerId, code, data }),
                  }),
                  where: () => ({
                    where: () => ({
                      get: async () => {
                        const existing = existingCouponsBySeller[sellerId] || [];
                        return { docs: existing.map((data) => ({ data: () => data })) };
                      },
                    }),
                  }),
                };
              }
              if (subName === "private") {
                return {
                  doc: () => ({
                    get: async () => (
                      customBotTokensBySeller[sellerId]
                        ? { exists: true, data: () => ({ botToken: customBotTokensBySeller[sellerId] }) }
                        : { exists: false }
                    ),
                  }),
                };
              }
              if (subName === "dailyStats") {
                return {
                  doc: () => ({
                    set: async (data) => dailyStatSetCalls.push({ sellerId, data }),
                  }),
                };
              }
              return { doc: () => ({ get: async () => ({ exists: false }), set: async () => {} }) };
            },
          }),
        };
      }
      if (name === "notificationLogs") {
        return { add: async (data) => notificationLogAddCalls.push(data) };
      }
      return { doc: () => ({ get: async () => ({ exists: false }) }), add: async () => ({}) };
    },
    __couponSetCalls: couponSetCalls,
    __dailyStatSetCalls: dailyStatSetCalls,
    __notificationLogAddCalls: notificationLogAddCalls,
  };
}

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: (config, handler) => handler,
}));

function loadModule(db) {
  jest.resetModules();
  const sendTelegramMessageMock = jest.fn(async () => ({ ok: true }));
  jest.doMock("../lib/admin", () => ({
    admin: {
      firestore: {
        FieldValue: { serverTimestamp: () => "MOCK_TS", increment: (n) => ({ __increment: n }) },
      },
    },
    db,
    BOT_TOKEN: { value: () => "fallback-token" },
  }));
  jest.doMock("../lib/helpers", () => ({ sendTelegramMessage: sendTelegramMessageMock }));
  const mod = require("../birthdayRewards");
  return { ...mod, __sendTelegramMessageMock: sendTelegramMessageMock };
}

describe("sendBirthdayRewards", () => {
  test("bugun hech kimning tug'ilgan kuni bo'lmasa - hech narsa qilmaydi", async () => {
    const db = buildMockDb({ clientDocs: [] });
    const { sendBirthdayRewards } = loadModule(db);
    await expect(sendBirthdayRewards()).resolves.not.toThrow();
    expect(db.__couponSetCalls.length).toBe(0);
  });

  test("tug'ilgan kuni bugun bo'lgan, lekin HECH QAYERDAN buyurtma bermagan (linkedSellerIds yo'q) mijozga hech narsa yubormaydi", async () => {
    const db = buildMockDb({
      clientDocs: [{ id: "client-1", data: { birthdayMonthDay: "05-20" } }],
    });
    const { sendBirthdayRewards } = loadModule(db);
    await sendBirthdayRewards();
    expect(db.__couponSetCalls.length).toBe(0);
  });

  test("sotuvchi tug'ilgan kun chegirmasini YOQMAGAN bo'lsa - mukofot berilmaydi", async () => {
    const db = buildMockDb({
      clientDocs: [{ id: "client-1", data: { birthdayMonthDay: "05-20", linkedSellerIds: ["seller-1"] } }],
      sellersData: { "seller-1": { birthdayDiscountEnabled: false, storeName: "Test Do'kon" } },
    });
    const { sendBirthdayRewards } = loadModule(db);
    await sendBirthdayRewards();
    expect(db.__couponSetCalls.length).toBe(0);
  });

  test("haqiqiy, yaroqli holatda - promokod yaratadi, xabar yuboradi va statistikani yozadi", async () => {
    const db = buildMockDb({
      clientDocs: [{ id: "client-1", data: { birthdayMonthDay: "05-20", linkedSellerIds: ["seller-1"] } }],
      sellersData: { "seller-1": { birthdayDiscountEnabled: true, birthdayDiscountPercent: 15, storeName: "Test Do'kon" } },
    });
    const { sendBirthdayRewards, __sendTelegramMessageMock } = loadModule(db);
    await sendBirthdayRewards();

    expect(db.__couponSetCalls.length).toBe(1);
    const coupon = db.__couponSetCalls[0];
    expect(coupon.sellerId).toBe("seller-1");
    expect(coupon.data.discountValue).toBe(15);
    expect(coupon.data.isBirthdayReward).toBe(true);
    expect(coupon.data.rewardForClientId).toBe("client-1");
    expect(coupon.data.usageLimit).toBe(1);

    expect(__sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    expect(__sendTelegramMessageMock.mock.calls[0][0]).toBe("fallback-token");
    expect(db.__dailyStatSetCalls.length).toBe(1);
    expect(db.__notificationLogAddCalls.length).toBe(1);
  });

  test("sotuvchida birthdayDiscountPercent ko'rsatilmagan bo'lsa - standart 10% ishlatiladi", async () => {
    const db = buildMockDb({
      clientDocs: [{ id: "client-1", data: { birthdayMonthDay: "05-20", linkedSellerIds: ["seller-1"] } }],
      sellersData: { "seller-1": { birthdayDiscountEnabled: true, storeName: "Test Do'kon" } },
    });
    const { sendBirthdayRewards } = loadModule(db);
    await sendBirthdayRewards();
    expect(db.__couponSetCalls[0].data.discountValue).toBe(10);
  });

  test("shu (sotuvchi, mijoz) juftligiga SHU YILDA allaqachon mukofot berilgan bo'lsa - qayta bermaydi", async () => {
    const currentYear = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }).slice(0, 4);
    const db = buildMockDb({
      clientDocs: [{ id: "client-1", data: { birthdayMonthDay: "05-20", linkedSellerIds: ["seller-1"] } }],
      sellersData: { "seller-1": { birthdayDiscountEnabled: true, storeName: "Test Do'kon" } },
      existingCouponsBySeller: {
        "seller-1": [{ rewardForClientId: "client-1", isBirthdayReward: true, birthdayYear: Number(currentYear) }],
      },
    });
    const { sendBirthdayRewards } = loadModule(db);
    await sendBirthdayRewards();
    expect(db.__couponSetCalls.length).toBe(0);
  });

  test("O'TGAN YILGI mukofot mavjud bo'lsa (bu yilgi emas) - bu yil YANA mukofot beradi", async () => {
    const db = buildMockDb({
      clientDocs: [{ id: "client-1", data: { birthdayMonthDay: "05-20", linkedSellerIds: ["seller-1"] } }],
      sellersData: { "seller-1": { birthdayDiscountEnabled: true, storeName: "Test Do'kon" } },
      existingCouponsBySeller: {
        "seller-1": [{ rewardForClientId: "client-1", isBirthdayReward: true, birthdayYear: 2000 }],
      },
    });
    const { sendBirthdayRewards } = loadModule(db);
    await sendBirthdayRewards();
    expect(db.__couponSetCalls.length).toBe(1);
  });

  test("mijoz BIR NECHTA sotuvchidan xarid qilgan bo'lsa - HAR BIR yoqilgan sotuvchidan alohida mukofot oladi", async () => {
    const db = buildMockDb({
      clientDocs: [{ id: "client-1", data: { birthdayMonthDay: "05-20", linkedSellerIds: ["seller-1", "seller-2"] } }],
      sellersData: {
        "seller-1": { birthdayDiscountEnabled: true, storeName: "Do'kon 1" },
        "seller-2": { birthdayDiscountEnabled: true, storeName: "Do'kon 2" },
      },
    });
    const { sendBirthdayRewards } = loadModule(db);
    await sendBirthdayRewards();
    expect(db.__couponSetCalls.length).toBe(2);
  });

  test("sotuvchida shaxsiy bot ULANGAN bo'lsa - tabrik xabari O'SHA bot orqali yuboriladi", async () => {
    const db = buildMockDb({
      clientDocs: [{ id: "client-1", data: { birthdayMonthDay: "05-20", linkedSellerIds: ["seller-1"] } }],
      sellersData: { "seller-1": { birthdayDiscountEnabled: true, storeName: "Test Do'kon" } },
      customBotTokensBySeller: { "seller-1": "sellers-own-bot-token" },
    });
    const { sendBirthdayRewards, __sendTelegramMessageMock } = loadModule(db);
    await sendBirthdayRewards();
    expect(__sendTelegramMessageMock.mock.calls[0][0]).toBe("sellers-own-bot-token");
  });
});

describe("_testables", () => {
  test("computeTodayMonthDay - berilgan millisekunddan 'MM-DD' formatini qaytaradi", () => {
    const db = buildMockDb({});
    const { _testables } = loadModule(db);
    // 2026-05-20T10:00:00Z - Toshkent (+05:00) da ham 05-20 kuni ichida.
    expect(_testables.computeTodayMonthDay(new Date("2026-05-20T10:00:00Z").getTime())).toBe("05-20");
  });

  test("computeCurrentYear - berilgan millisekunddan yilni qaytaradi", () => {
    const db = buildMockDb({});
    const { _testables } = loadModule(db);
    expect(_testables.computeCurrentYear(new Date("2026-05-20T10:00:00Z").getTime())).toBe(2026);
  });

  test("generateBirthdayCouponCode - 'BDAY-' bilan boshlanuvchi kod qaytaradi", () => {
    const db = buildMockDb({});
    const { _testables } = loadModule(db);
    const code = _testables.generateBirthdayCouponCode();
    expect(code.startsWith("BDAY-")).toBe(true);
  });
});
