/**
 * `staffAuth.js` (verifyStaffTelegramAuth) uchun testlar — xodim Mini
 * App'ining, ASOSIY `auth.js`dan VA kuryer autentifikatsiyasidan
 * (`courierAuth.js`) BUTUNLAY MUSTAQIL, alohida autentifikatsiya
 * yo'li. `courierAuth.test.js` bilan bir xil naqsh.
 */

function buildMockDb({ staffData = null, sellerData = null } = {}) {
  const chainable = () => {
    const self = { where: () => self, get: async () => ({ docs: [] }) };
    return self;
  };
  return {
    collection: (name) => {
      if (name === "staff") {
        return { doc: () => ({ get: async () => (staffData ? { exists: true, data: () => staffData } : { exists: false }) }) };
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

function loadStaffAuthModule({ dbOptions = {}, verifyResult, verifyError } = {}) {
  jest.resetModules();
  jest.doMock("../telegramAuth", () => ({
    verifyTelegramInitData: jest.fn(() => {
      if (verifyError) throw verifyError;
      return verifyResult;
    }),
  }));
  const mockDb = buildMockDb(dbOptions);
  jest.doMock("../lib/admin", () => ({
    admin: { auth: () => ({ createCustomToken: jest.fn().mockResolvedValue("mock-staff-token") }) },
    db: mockDb,
    STAFF_BOT_TOKEN: { value: () => "staff-bot-token" },
  }));
  return require("../staffAuth");
}

describe("verifyStaffTelegramAuth", () => {
  test("initData imzosi noto'g'ri bo'lsa — unauthenticated", async () => {
    const staffAuth = loadStaffAuthModule({ verifyError: new Error("imzo mos kelmadi") });
    await expect(
      staffAuth._testables.handleVerifyStaffTelegramAuth({ data: { initData: "yaroqsiz" } })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("xodim hujjati topilmasa — failed-precondition (aniq xabar bilan)", async () => {
    const staffAuth = loadStaffAuthModule({
      dbOptions: { staffData: null },
      verifyResult: { user: { id: 12345, first_name: "Vali" } },
    });
    await expect(
      staffAuth._testables.handleVerifyStaffTelegramAuth({ data: { initData: "fake" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("xodim 'inactive' bo'lsa — permission-denied", async () => {
    const staffAuth = loadStaffAuthModule({
      dbOptions: { staffData: { sellerId: "s1", status: "inactive", name: "Vali", permissions: { manageOrders: true } } },
      verifyResult: { user: { id: 12345, first_name: "Vali" } },
    });
    await expect(
      staffAuth._testables.handleVerifyStaffTelegramAuth({ data: { initData: "fake" } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("faol xodim uchun — token, xodim va do'kon ma'lumoti (ruxsatlari bilan) to'g'ri qaytadi", async () => {
    const staffAuth = loadStaffAuthModule({
      dbOptions: {
        staffData: { sellerId: "s1", status: "active", name: "Vali", permissions: { manageProducts: true, manageOrders: false } },
        sellerData: { storeName: "Go'zallik Do'koni" },
      },
      verifyResult: { user: { id: 12345, first_name: "Vali", username: "vali_staff" } },
    });

    const result = await staffAuth._testables.handleVerifyStaffTelegramAuth({ data: { initData: "fake" } });

    expect(result.token).toBe("mock-staff-token");
    expect(result.telegramUser.id).toBe("12345");
    expect(result.staff.name).toBe("Vali");
    expect(result.staff.permissions).toEqual({ manageProducts: true, manageOrders: false });
    expect(result.store.storeName).toBe("Go'zallik Do'koni");
  });
});
