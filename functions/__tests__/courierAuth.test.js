/**
 * `courierAuth.js` (verifyCourierTelegramAuth) uchun testlar — kuryer
 * Mini App'ining, ASOSIY `auth.js`dan BUTUNLAY MUSTAQIL, alohida
 * autentifikatsiya yo'li.
 */

function buildMockDb({ courierData = null, sellerData = null } = {}) {
  const chainable = () => {
    const self = { where: () => self, get: async () => ({ docs: [] }) };
    return self;
  };
  return {
    collection: (name) => {
      if (name === "couriers") {
        return { doc: () => ({ get: async () => (courierData ? { exists: true, data: () => courierData } : { exists: false }) }) };
      }
      if (name === "sellers") {
        return { doc: () => ({ get: async () => (sellerData ? { exists: true, id: "s1", data: () => sellerData } : { exists: false }) }) };
      }
      return { doc: () => ({ get: async () => ({ exists: false }) }), where: chainable };
    },
    runTransaction: async (callback) => {
      const fakeTransaction = { get: async () => ({ exists: false }), set: () => {}, update: () => {} };
      return callback(fakeTransaction);
    },
  };
}

function loadCourierAuthModule({ dbOptions = {}, verifyResult, verifyError } = {}) {
  jest.resetModules();
  jest.doMock("../telegramAuth", () => ({
    verifyTelegramInitData: jest.fn(() => {
      if (verifyError) throw verifyError;
      return verifyResult;
    }),
  }));
  const mockDb = buildMockDb(dbOptions);
  jest.doMock("../lib/admin", () => ({
    admin: { auth: () => ({ createCustomToken: jest.fn().mockResolvedValue("mock-courier-token") }) },
    db: mockDb,
    COURIER_BOT_TOKEN: { value: () => "courier-bot-token" },
  }));
  return require("../courierAuth");
}

describe("verifyCourierTelegramAuth", () => {
  test("initData imzosi noto'g'ri bo'lsa — unauthenticated", async () => {
    const courierAuth = loadCourierAuthModule({ verifyError: new Error("imzo mos kelmadi") });
    await expect(
      courierAuth._testables.handleVerifyCourierTelegramAuth({ data: { initData: "yaroqsiz" } })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("kuryer hujjati topilmasa — failed-precondition (aniq xabar bilan)", async () => {
    const courierAuth = loadCourierAuthModule({
      dbOptions: { courierData: null },
      verifyResult: { user: { id: 12345, first_name: "Bek" } },
    });
    await expect(
      courierAuth._testables.handleVerifyCourierTelegramAuth({ data: { initData: "fake" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("kuryer 'inactive' bo'lsa — permission-denied", async () => {
    const courierAuth = loadCourierAuthModule({
      dbOptions: { courierData: { sellerId: "s1", status: "inactive", name: "Bek" } },
      verifyResult: { user: { id: 12345, first_name: "Bek" } },
    });
    await expect(
      courierAuth._testables.handleVerifyCourierTelegramAuth({ data: { initData: "fake" } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("faol kuryer uchun — token, kuryer va do'kon ma'lumoti to'g'ri qaytadi", async () => {
    const courierAuth = loadCourierAuthModule({
      dbOptions: {
        courierData: { sellerId: "s1", status: "active", name: "Bek" },
        sellerData: { storeName: "Go'zallik Do'koni" },
      },
      verifyResult: { user: { id: 12345, first_name: "Bek", username: "bek_courier" } },
    });

    const result = await courierAuth._testables.handleVerifyCourierTelegramAuth({ data: { initData: "fake" } });

    expect(result.token).toBe("mock-courier-token");
    expect(result.telegramUser.id).toBe("12345");
    expect(result.courier.name).toBe("Bek");
    expect(result.store.storeName).toBe("Go'zallik Do'koni");
  });
});
