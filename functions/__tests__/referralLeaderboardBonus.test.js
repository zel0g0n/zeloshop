/**
 * `referralLeaderboardBonus.js`ning `sendReferralLeaderboardBonuses`i
 * uchun testlar - referal reytingining haftalik TOP-3 g'olibiga
 * avtomatik chegirma promokodi + Telegram xabari.
 *
 * MUHIM: bu `onSchedule` orqali eksport qilingan - shuning uchun
 * ICHKI mantiqni sinash uchun, `onSchedule`ning ikkinchi argumentini
 * (asosiy handler funksiyani) TO'G'RIDAN-TO'G'RI CHAQIRAMIZ - xuddi
 * `birthdayRewards.test.js`dagi bilan bir xil naqsh.
 */

function buildMockDb({
  sellersList = [], // [{id, data}]
  weeklyCountsBySeller = {}, // { sellerId: {counts, bonusGranted} | undefined }
  customBotTokensBySeller = {},
} = {}) {
  const couponSetCalls = [];
  const weeklySetCalls = [];
  const dailyStatSetCalls = [];
  const notificationLogAddCalls = [];
  const batchSetCalls = [];

  return {
    collection: (name) => {
      if (name === "sellers") {
        return {
          get: async () => ({
            empty: sellersList.length === 0,
            // MUHIM: `.ref` qo'shildi - `backfillMissingBonusFlag`
            // `doc.ref`ni `batch.set(...)` uchun ishlatadi (haqiqiy
            // Firestore QueryDocumentSnapshot'da bu maydon HAR DOIM
            // mavjud).
            docs: sellersList.map((s) => ({ id: s.id, data: () => s.data, ref: { id: s.id } })),
          }),
          doc: (sellerId) => ({
            collection: (subName) => {
              if (subName === "referralWeeklyCounts") {
                return {
                  doc: (weekKey) => ({
                    get: async () => {
                      const data = weeklyCountsBySeller[sellerId];
                      return data ? { exists: true, data: () => data } : { exists: false };
                    },
                    set: async (data, opts) => weeklySetCalls.push({ sellerId, weekKey, data, opts }),
                  }),
                };
              }
              if (subName === "coupons") {
                return {
                  doc: (code) => ({
                    set: async (data) => couponSetCalls.push({ sellerId, code, data }),
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
                return { doc: () => ({ set: async (data) => dailyStatSetCalls.push({ sellerId, data }) }) };
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
    // `backfillMissingBonusFlag` ishlatadigan to'plamli yozuv mock'i -
    // haqiqiy Firestore `WriteBatch` kabi, `set(ref, data, opts)`
    // chaqiruvlarini yig'ib boradi, `commit()` esa shunchaki tugaydi.
    batch: () => {
      const calls = [];
      const batchObj = {
        set: (ref, data, opts) => {
          calls.push({ ref, data, opts });
          batchSetCalls.push({ ref, data, opts });
        },
        commit: async () => calls,
      };
      return batchObj;
    },
    __couponSetCalls: couponSetCalls,
    __weeklySetCalls: weeklySetCalls,
    __dailyStatSetCalls: dailyStatSetCalls,
    __notificationLogAddCalls: notificationLogAddCalls,
    __batchSetCalls: batchSetCalls,
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
  const mod = require("../referralLeaderboardBonus");
  return { ...mod, __sendTelegramMessageMock: sendTelegramMessageMock };
}

const WEEK_KEY = "2026-W35";

describe("processSellerLeaderboardBonus", () => {
  test("haftalik hisoblagich hujjati umuman yo'q bo'lsa - hech narsa qilmaydi", async () => {
    const db = buildMockDb({ weeklyCountsBySeller: {} });
    const { _testables } = loadModule(db);
    const result = await _testables.processSellerLeaderboardBonus({ id: "seller-1", data: () => ({}) }, WEEK_KEY);
    expect(result).toEqual({ granted: 0 });
    expect(db.__couponSetCalls.length).toBe(0);
  });

  test("bazaviy referal dasturi ATAYLAB o'chirilgan (`referralProgramEnabled: false`) bo'lsa - mukofot berilmaydi", async () => {
    const db = buildMockDb({
      weeklyCountsBySeller: { "seller-1": { counts: { A: 5 } } },
    });
    const { _testables } = loadModule(db);
    const result = await _testables.processSellerLeaderboardBonus(
      { id: "seller-1", data: () => ({ referralProgramEnabled: false }) },
      WEEK_KEY
    );
    expect(result).toEqual({ granted: 0 });
    expect(db.__couponSetCalls.length).toBe(0);
  });

  test("haftalik reyting bonusi ATAYLAB o'chirilgan (`referralLeaderboardBonusEnabled: false`) bo'lsa - mukofot berilmaydi (bazaviy dastur yoqilgan bo'lsa ham)", async () => {
    const db = buildMockDb({
      weeklyCountsBySeller: { "seller-1": { counts: { A: 5 } } },
    });
    const { _testables } = loadModule(db);
    const result = await _testables.processSellerLeaderboardBonus(
      { id: "seller-1", data: () => ({ referralLeaderboardBonusEnabled: false }) },
      WEEK_KEY
    );
    expect(result).toEqual({ granted: 0 });
    expect(db.__couponSetCalls.length).toBe(0);
  });

  test("sozlama ko'rsatilmagan bo'lsa - standart bo'yicha YOQILGAN (opt-out), mukofot beriladi", async () => {
    const db = buildMockDb({
      weeklyCountsBySeller: { "seller-1": { counts: { A: 5, B: 3, C: 1 } } },
      customBotTokensBySeller: {},
    });
    const { _testables, __sendTelegramMessageMock } = loadModule(db);
    const result = await _testables.processSellerLeaderboardBonus(
      { id: "seller-1", data: () => ({ storeName: "Zelo Do'kon" }) },
      WEEK_KEY
    );
    expect(result).toEqual({ granted: 3 });
    expect(db.__couponSetCalls.length).toBe(3);
    expect(__sendTelegramMessageMock).toHaveBeenCalledTimes(3);
  });

  test("TOP-3 g'olibga TO'G'RI foizlar (25%/15%/10%) va rank bilan promokod beradi", async () => {
    const db = buildMockDb({
      weeklyCountsBySeller: { "seller-1": { counts: { A: 5, B: 3, C: 1 } } },
    });
    const { _testables } = loadModule(db);
    await _testables.processSellerLeaderboardBonus({ id: "seller-1", data: () => ({}) }, WEEK_KEY);

    const byClient = Object.fromEntries(db.__couponSetCalls.map((c) => [c.data.rewardForClientId, c.data]));
    expect(byClient.A).toMatchObject({ discountValue: 25, referralLeaderboardRank: 1, isReferralLeaderboardBonus: true, usageLimit: 1 });
    expect(byClient.B).toMatchObject({ discountValue: 15, referralLeaderboardRank: 2 });
    expect(byClient.C).toMatchObject({ discountValue: 10, referralLeaderboardRank: 3 });
    expect(byClient.A.referralLeaderboardWeekKey).toBe(WEEK_KEY);
  });

  test("3 tadan kam ishtirokchi bo'lsa - faqat mavjudlariga beriladi", async () => {
    const db = buildMockDb({
      weeklyCountsBySeller: { "seller-1": { counts: { A: 2 } } },
    });
    const { _testables } = loadModule(db);
    const result = await _testables.processSellerLeaderboardBonus({ id: "seller-1", data: () => ({}) }, WEEK_KEY);
    expect(result).toEqual({ granted: 1 });
    expect(db.__couponSetCalls[0].data.discountValue).toBe(25); // yagona ishtirokchi ham 1-o'rin sifatida
  });

  test("hech kim do'st taklif qilmagan (bo'sh counts) bo'lsa - mukofot berilmaydi, lekin `bonusGranted` baribir belgilanadi (keyingi cron qayta tekshirmasligi uchun)", async () => {
    const db = buildMockDb({
      weeklyCountsBySeller: { "seller-1": { counts: {} } },
    });
    const { _testables } = loadModule(db);
    const result = await _testables.processSellerLeaderboardBonus({ id: "seller-1", data: () => ({}) }, WEEK_KEY);
    expect(result).toEqual({ granted: 0 });
    expect(db.__weeklySetCalls.some((c) => c.sellerId === "seller-1" && c.data.bonusGranted === true)).toBe(true);
  });

  test("TAKRORLANMASLIK: shu haftaga allaqachon mukofot berilgan bo'lsa (`bonusGranted: true`) - qayta bermaydi", async () => {
    const db = buildMockDb({
      weeklyCountsBySeller: { "seller-1": { counts: { A: 5 }, bonusGranted: true } },
    });
    const { _testables } = loadModule(db);
    const result = await _testables.processSellerLeaderboardBonus({ id: "seller-1", data: () => ({}) }, WEEK_KEY);
    expect(result).toEqual({ granted: 0 });
    expect(db.__couponSetCalls.length).toBe(0);
  });

  test("muvaffaqiyatli mukofotdan so'ng, haftalik hujjatga `bonusGranted: true` yoziladi (kelasi safar takrorlanmasligi uchun)", async () => {
    const db = buildMockDb({
      weeklyCountsBySeller: { "seller-1": { counts: { A: 5 } } },
    });
    const { _testables } = loadModule(db);
    await _testables.processSellerLeaderboardBonus({ id: "seller-1", data: () => ({}) }, WEEK_KEY);
    expect(db.__weeklySetCalls.some((c) => c.sellerId === "seller-1" && c.data.bonusGranted === true)).toBe(true);
  });

  test("sotuvchida shaxsiy bot ULANGAN bo'lsa - tabrik xabari O'SHA bot orqali yuboriladi", async () => {
    const db = buildMockDb({
      weeklyCountsBySeller: { "seller-1": { counts: { A: 5 } } },
      customBotTokensBySeller: { "seller-1": "sellers-own-bot-token" },
    });
    const { _testables, __sendTelegramMessageMock } = loadModule(db);
    await _testables.processSellerLeaderboardBonus({ id: "seller-1", data: () => ({}) }, WEEK_KEY);
    expect(__sendTelegramMessageMock.mock.calls[0][0]).toBe("sellers-own-bot-token");
  });
});

describe("backfillMissingBonusFlag (referralLeaderboardBonusEnabled maydonini xavfsiz to'ldirish)", () => {
  test("maydoni YO'Q sotuvchilarga `true` yozadi, allaqachon ANIQ belgilanganlarga (true YOKI false) TEGMAYDI", async () => {
    const db = buildMockDb({
      sellersList: [
        { id: "no-field", data: {} },
        { id: "already-true", data: { referralLeaderboardBonusEnabled: true } },
        { id: "already-false", data: { referralLeaderboardBonusEnabled: false } },
      ],
    });
    const { _testables } = loadModule(db);
    const sellersSnap = await db.collection("sellers").get();
    const count = await _testables.backfillMissingBonusFlag(sellersSnap);

    expect(count).toBe(1);
    expect(db.__batchSetCalls.length).toBe(1);
    expect(db.__batchSetCalls[0].ref.id).toBe("no-field");
    expect(db.__batchSetCalls[0].data).toEqual({ referralLeaderboardBonusEnabled: true });
    expect(db.__batchSetCalls[0].opts).toEqual({ merge: true });
  });

  test("hech kimda maydon yo'q bo'lmasa (hammasi allaqachon belgilangan) - hech qanday yozuv qilmaydi", async () => {
    const db = buildMockDb({
      sellersList: [
        { id: "a", data: { referralLeaderboardBonusEnabled: true } },
        { id: "b", data: { referralLeaderboardBonusEnabled: false } },
      ],
    });
    const { _testables } = loadModule(db);
    const sellersSnap = await db.collection("sellers").get();
    const count = await _testables.backfillMissingBonusFlag(sellersSnap);

    expect(count).toBe(0);
    expect(db.__batchSetCalls.length).toBe(0);
  });

  test("400tadan ko'p hujjat bo'lsa - Firestore to'plamli yozuv chegarasidan (500) xavfsiz, bir nechta bo'lakka bo'lib yozadi", async () => {
    const sellersList = Array.from({ length: 850 }, (_, i) => ({ id: `seller-${i}`, data: {} }));
    const db = buildMockDb({ sellersList });
    const { _testables } = loadModule(db);
    const sellersSnap = await db.collection("sellers").get();
    const count = await _testables.backfillMissingBonusFlag(sellersSnap);

    expect(count).toBe(850);
    expect(db.__batchSetCalls.length).toBe(850);
  });
});

describe("sendReferralLeaderboardBonuses (butun cron)", () => {
  test("hech qanday sotuvchi bo'lmasa - hech narsa qilmaydi, xato bermaydi", async () => {
    const db = buildMockDb({ sellersList: [] });
    const { sendReferralLeaderboardBonuses } = loadModule(db);
    await expect(sendReferralLeaderboardBonuses()).resolves.not.toThrow();
    expect(db.__couponSetCalls.length).toBe(0);
  });

  test("bir nechta sotuvchi bo'lsa - HAR BIRI mustaqil qayta ishlanadi", async () => {
    const db = buildMockDb({
      sellersList: [
        { id: "seller-1", data: { storeName: "Do'kon 1" } },
        { id: "seller-2", data: { storeName: "Do'kon 2", referralLeaderboardBonusEnabled: false } },
      ],
      weeklyCountsBySeller: {
        "seller-1": { counts: { A: 5 } },
        "seller-2": { counts: { B: 9 } },
      },
    });
    const { sendReferralLeaderboardBonuses } = loadModule(db);
    await sendReferralLeaderboardBonuses();

    // seller-1 uchun mukofot beriladi, seller-2 uchun o'chirilgani uchun YO'Q.
    expect(db.__couponSetCalls.length).toBe(1);
    expect(db.__couponSetCalls[0].sellerId).toBe("seller-1");
  });

  test("cron ishga tushganda, maydoni yo'q sotuvchilarga `referralLeaderboardBonusEnabled: true` AVTOMATIK backfill qilinadi", async () => {
    const db = buildMockDb({
      sellersList: [
        { id: "seller-1", data: { storeName: "Do'kon 1" } }, // maydon yo'q
        { id: "seller-2", data: { storeName: "Do'kon 2", referralLeaderboardBonusEnabled: false } }, // ANIQ o'chirilgan - tegilmaydi
      ],
    });
    const { sendReferralLeaderboardBonuses } = loadModule(db);
    await sendReferralLeaderboardBonuses();

    expect(db.__batchSetCalls.length).toBe(1);
    expect(db.__batchSetCalls[0].ref.id).toBe("seller-1");
    expect(db.__batchSetCalls[0].data).toEqual({ referralLeaderboardBonusEnabled: true });
  });

  test("backfill xato bersa ham, asosiy mukofot berish vazifasi TO'XTAMAYDI", async () => {
    const db = buildMockDb({
      sellersList: [{ id: "seller-1", data: { storeName: "Do'kon 1" } }],
      weeklyCountsBySeller: { "seller-1": { counts: { A: 5 } } },
    });
    // `batch()`ning o'zini xato tashlaydigan qilib almashtiramiz.
    db.batch = () => {
      throw new Error("simulyatsiya qilingan Firestore xatosi");
    };
    const { sendReferralLeaderboardBonuses } = loadModule(db);
    await expect(sendReferralLeaderboardBonuses()).resolves.not.toThrow();
    expect(db.__couponSetCalls.length).toBe(1);
  });
});
