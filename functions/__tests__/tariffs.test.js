/**
 * `tariffs.js` — Z-Tariflar (Z-Start/Z-Pro/Z-Biznes) sinov (trial)
 * mexanizmi va hisoblagich (counter) migratsiyasi uchun testlar.
 *
 * ASOSIY E'TIBOR: (1) sinov faqat bir marta, faqat KEYINGI tarif
 * uchun boshlanishi mumkinligi, (2) AI CEO sinxronizatsiyasi FAQAT
 * o'zi yoqqan holatga tegishi (referal/admin grantiga tegmasligi),
 * (3) muddati tugagan sinovlarning to'g'ri qaytarilishi.
 */

function buildMockDb({ sellers = {}, productsCount = 0, couponsCount = 0 } = {}) {
  const updateCalls = [];
  const setCalls = [];

  function sellerDocRef(id) {
    return {
      id,
      get: async () => (sellers[id] ? { exists: true, id, data: () => sellers[id] } : { exists: false, id }),
      update: async (data) => {
        updateCalls.push({ id, data });
        sellers[id] = { ...(sellers[id] || {}), ...data };
      },
      set: async (data, opts) => {
        setCalls.push({ id, data, opts });
        sellers[id] = opts?.merge ? { ...(sellers[id] || {}), ...data } : data;
      },
      collection: (subName) => {
        if (subName === "coupons") {
          return {
            count: () => ({ get: async () => ({ data: () => ({ count: couponsCount }) }) }),
          };
        }
        return { doc: () => ({ get: async () => ({ exists: false }) }) };
      },
    };
  }

  const productsQuery = {
    where: () => productsQuery,
    count: () => ({ get: async () => ({ data: () => ({ count: productsCount }) }) }),
  };

  return {
    __updateCalls: updateCalls,
    __setCalls: setCalls,
    __sellers: sellers,
    collection: (name) => {
      if (name === "sellers") return { doc: sellerDocRef };
      if (name === "products") return productsQuery;
      throw new Error(`Kutilmagan kolleksiya: ${name}`);
    },
  };
}

function loadModule(db, { checkRateLimitMock, sendTelegramMessageMock } = {}) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => "SERVER_TIMESTAMP",
          arrayUnion: (v) => ({ __arrayUnion: v }),
          delete: () => ({ __delete: true }),
        },
        Timestamp: {
          now: () => ({ toMillis: () => Date.now() }),
          fromMillis: (ms) => ({ toMillis: () => ms }),
        },
      },
    },
    db,
    BOT_TOKEN: { value: () => "mock-bot-token" },
  }));
  jest.doMock("../lib/helpers", () => ({
    sendTelegramMessage: sendTelegramMessageMock || jest.fn().mockResolvedValue({ ok: true }),
  }));
  jest.doMock("../lib/rateLimit", () => ({ checkRateLimit: checkRateLimitMock || jest.fn().mockResolvedValue(undefined) }));
  return require("../tariffs");
}

describe("handleStartTariffTrial", () => {
  test("tizimga kirmagan foydalanuvchi rad etiladi", async () => {
    const { _testables } = loadModule(buildMockDb());
    await expect(_testables.handleStartTariffTrial({ auth: null, data: {} })).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("sotuvchi hujjati topilmasa rad etiladi", async () => {
    const { _testables } = loadModule(buildMockDb());
    await expect(_testables.handleStartTariffTrial({ auth: { uid: "s1" }, data: {} })).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("Z-Start sotuvchi uchun Z-Pro sinovini boshlaydi VA AI CEO'ni yoqadi", async () => {
    const db = buildMockDb({ sellers: { s1: { tariffPlan: "start" } } });
    const { _testables } = loadModule(db);
    const result = await _testables.handleStartTariffTrial({ auth: { uid: "s1" }, data: {} });

    expect(result.trialPlan).toBe("pro");
    expect(db.__sellers.s1.tariffTrialActive).toBe(true);
    expect(db.__sellers.s1.tariffTrialPlan).toBe("pro");
    expect(db.__sellers.s1.aiCeoEnabled).toBe(true);
    expect(db.__sellers.s1.aiCeoGrantedViaTariff).toBe(true);
  });

  test("Z-Pro sotuvchi uchun Z-Biznes sinovini boshlaydi - AI CEO ALLAQACHON yoqilgan bo'lsa qayta bayroq QO'YMAYDI", async () => {
    const db = buildMockDb({ sellers: { s1: { tariffPlan: "pro", aiCeoEnabled: true } } });
    const { _testables } = loadModule(db);
    const result = await _testables.handleStartTariffTrial({ auth: { uid: "s1" }, data: {} });

    expect(result.trialPlan).toBe("biznes");
    expect(db.__sellers.s1.aiCeoGrantedViaTariff).toBeUndefined();
  });

  test("Z-Biznes sotuvchi uchun (keyingi tarif yo'q) rad etiladi", async () => {
    const db = buildMockDb({ sellers: { s1: { tariffPlan: "biznes" } } });
    const { _testables } = loadModule(db);
    await expect(_testables.handleStartTariffTrial({ auth: { uid: "s1" }, data: {} })).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("allaqachon FAOL sinov bo'lsa rad etiladi", async () => {
    const db = buildMockDb({ sellers: { s1: { tariffPlan: "start", tariffTrialActive: true, tariffTrialPlan: "pro", tariffTrialExpiresAt: { toMillis: () => Date.now() + 100000 } } } });
    const { _testables } = loadModule(db);
    await expect(_testables.handleStartTariffTrial({ auth: { uid: "s1" }, data: {} })).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("bu tarif ALLAQACHON sinab ko'rilgan bo'lsa (bir martalik) rad etiladi", async () => {
    const db = buildMockDb({ sellers: { s1: { tariffPlan: "start", tariffTrialsUsed: ["pro"] } } });
    const { _testables } = loadModule(db);
    await expect(_testables.handleStartTariffTrial({ auth: { uid: "s1" }, data: {} })).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("rate-limit tekshiruvini to'g'ri chaqiradi", async () => {
    const checkRateLimitMock = jest.fn().mockResolvedValue(undefined);
    const db = buildMockDb({ sellers: { s1: { tariffPlan: "start" } } });
    const { _testables } = loadModule(db, { checkRateLimitMock });
    await _testables.handleStartTariffTrial({ auth: { uid: "s1" }, data: {} });
    expect(checkRateLimitMock).toHaveBeenCalledWith("startTariffTrial:s1", 5, 3600);
  });
});

describe("handleExpireTariffTrials", () => {
  test("muddati tugagan sinovni qaytaradi, sinov TUFAYLI yoqilgan AI CEO'ni o'chiradi", async () => {
    const db = buildMockDb();
    // `where().where().limit().get()` zanjirini qo'lda taqlid qilamiz.
    db.collection = (name) => {
      if (name === "sellers") {
        const query = {
          where: () => query,
          limit: () => query,
          get: async () => ({
            docs: [
              {
                id: "s1",
                data: () => ({ aiCeoGrantedViaTariff: true }),
                ref: { update: async (data) => { db.__updateCalls.push({ id: "s1", data }); } },
              },
            ],
          }),
        };
        return query;
      }
      throw new Error(`Kutilmagan: ${name}`);
    };
    const { _testables } = loadModule(db);
    await _testables.handleExpireTariffTrials();

    expect(db.__updateCalls).toHaveLength(1);
    const update = db.__updateCalls[0].data;
    expect(update.tariffTrialActive).toBe(false);
    expect(update.aiCeoEnabled).toBe(false);
    expect(update.aiCeoGrantedViaTariff).toBe(false);
  });

  test("REFERAL/ADMIN orqali yoqilgan AI CEO'ga TEGMAYDI (`aiCeoGrantedViaTariff` yo'q bo'lsa)", async () => {
    const db = buildMockDb();
    db.collection = (name) => {
      if (name === "sellers") {
        const query = {
          where: () => query,
          limit: () => query,
          get: async () => ({
            docs: [
              {
                id: "s2",
                data: () => ({ aiCeoGrantedViaReferral: true }), // sinov TUFAYLI EMAS
                ref: { update: async (data) => { db.__updateCalls.push({ id: "s2", data }); } },
              },
            ],
          }),
        };
        return query;
      }
      throw new Error(`Kutilmagan: ${name}`);
    };
    const { _testables } = loadModule(db);
    await _testables.handleExpireTariffTrials();

    const update = db.__updateCalls[0].data;
    expect(update.aiCeoEnabled).toBeUndefined();
    expect(update.tariffTrialActive).toBe(false);
  });
});

describe("handleBackfillTariffCounters", () => {
  test("tizimga kirmagan foydalanuvchi rad etiladi", async () => {
    const { _testables } = loadModule(buildMockDb());
    await expect(_testables.handleBackfillTariffCounters({ auth: null, data: {} })).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("boshqa sotuvchi uchun ishga tushirish rad etiladi", async () => {
    const { _testables } = loadModule(buildMockDb());
    await expect(
      _testables.handleBackfillTariffCounters({ auth: { uid: "s1" }, data: { sellerId: "s2" } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("mahsulot/promokod sonlarini to'g'ri hisoblab, sotuvchi hujjatiga yozadi", async () => {
    const db = buildMockDb({ sellers: { s1: {} }, productsCount: 2, couponsCount: 3 });
    const { _testables } = loadModule(db);
    const result = await _testables.handleBackfillTariffCounters({ auth: { uid: "s1" }, data: { sellerId: "s1" } });

    expect(result).toEqual({ activeDiscountCount: 2, couponCount: 3 });
    expect(db.__sellers.s1.activeDiscountCount).toBe(2);
    expect(db.__sellers.s1.couponCount).toBe(3);
    expect(db.__sellers.s1.tariffCountersBackfilledAt).toBe("SERVER_TIMESTAMP");
  });
});
