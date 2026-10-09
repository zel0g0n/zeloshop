/**
 * `mobileAppAuth.js` — React Native mobil ilova uchun maxsus
 * login/parol autentifikatsiyasi (2026-09-26).
 */

jest.mock("../lib/sentry", () => ({
  withSentry: (fn) => fn,
  SENTRY_DSN: { value: () => null },
  Sentry: { captureException: jest.fn() },
  initSentry: jest.fn(),
}));

function buildMockDb({ sellers = {}, appLogins = {}, appAuth = {} } = {}) {
  const createCustomTokenCalls = [];

  const appLoginsStore = { ...appLogins };
  const appAuthStore = { ...appAuth };

  const db = {
    collection: (name) => {
      if (name === "sellers") {
        return {
          doc: (sellerId) => ({
            get: async () => (sellers[sellerId] ? { exists: true, data: () => sellers[sellerId] } : { exists: false }),
            collection: (subName) => {
              if (subName === "private") {
                return {
                  doc: (docId) => {
                    if (docId !== "appAuth") return { get: async () => ({ exists: false }) };
                    return {
                      get: async () => (appAuthStore[sellerId] ? { exists: true, data: () => appAuthStore[sellerId] } : { exists: false }),
                      set: async (data) => {
                        appAuthStore[sellerId] = data;
                      },
                    };
                  },
                };
              }
              return { doc: () => ({ get: async () => ({ exists: false }) }) };
            },
          }),
        };
      }
      if (name === "appLogins") {
        return {
          doc: (login) => ({
            get: async () => (appLoginsStore[login] ? { exists: true, data: () => appLoginsStore[login] } : { exists: false }),
            set: async (data) => {
              appLoginsStore[login] = data;
            },
            delete: async () => {
              delete appLoginsStore[login];
            },
          }),
        };
      }
      return { doc: () => ({ get: async () => ({ exists: false }) }) };
    },
    __appLoginsStore: appLoginsStore,
    __appAuthStore: appAuthStore,
    __createCustomTokenCalls: createCustomTokenCalls,
  };

  return db;
}

function loadModule(db, { checkRateLimitMock } = {}) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: {
      firestore: {
        FieldValue: { serverTimestamp: () => "MOCK_TS" },
      },
      auth: () => ({
        createCustomToken: async (uid) => {
          db.__createCustomTokenCalls.push(uid);
          return `MOCK_CUSTOM_TOKEN_FOR_${uid}`;
        },
      }),
    },
    db,
    SENTRY_DSN: { value: () => null },
  }));
  jest.doMock("../lib/rateLimit", () => ({ checkRateLimit: checkRateLimitMock || jest.fn().mockResolvedValue(undefined) }));
  return require("../mobileAppAuth");
}

describe("generateMobileAppCredentials", () => {
  test("login (8 belgi) va parol (10 belgi) yaratadi, faqat ruxsat etilgan alifbodan (chalkash belgilarsiz)", async () => {
    const db = buildMockDb({ sellers: { s1: { storeName: "Do'kon" } } });
    const { generateMobileAppCredentials, _testables } = loadModule(db);

    const { login, password } = await generateMobileAppCredentials("s1");

    expect(login).toHaveLength(_testables.LOGIN_LENGTH);
    expect(password).toHaveLength(_testables.PASSWORD_LENGTH);
    const charsetPattern = new RegExp(`^[${_testables.CODE_CHARSET}]+$`);
    expect(login).toMatch(charsetPattern);
    expect(password).toMatch(charsetPattern);
    // Chalkash belgilar umuman ishlatilmasligi kerak.
    expect(login).not.toMatch(/[01OIL]/);
    expect(password).not.toMatch(/[01OIL]/);
  });

  test("parolni HECH QACHON ochiq saqlamaydi — faqat hash + salt", async () => {
    const db = buildMockDb({ sellers: { s1: { storeName: "Do'kon" } } });
    const { generateMobileAppCredentials } = loadModule(db);

    const { login, password } = await generateMobileAppCredentials("s1");

    const stored = db.__appLoginsStore[login];
    expect(stored.sellerId).toBe("s1");
    expect(stored.passwordHash).toBeDefined();
    expect(stored.passwordHash).not.toBe(password);
    expect(stored.salt).toBeDefined();
    expect(db.__appAuthStore.s1).toEqual({ login, createdAt: "MOCK_TS" });
  });

  test("qayta chaqirilsa — ESKI login/parol butunlay bekor qilinadi (appLogins'dan o'chiriladi)", async () => {
    const db = buildMockDb({ sellers: { s1: { storeName: "Do'kon" } } });
    const { generateMobileAppCredentials } = loadModule(db);

    const first = await generateMobileAppCredentials("s1");
    expect(db.__appLoginsStore[first.login]).toBeDefined();

    const second = await generateMobileAppCredentials("s1");

    expect(second.login).not.toBe(first.login);
    expect(db.__appLoginsStore[first.login]).toBeUndefined();
    expect(db.__appLoginsStore[second.login]).toBeDefined();
  });
});

describe("handleMobileAppLogin", () => {
  async function seedCredentials(db, sellerId) {
    const { generateMobileAppCredentials } = loadModule(db);
    return generateMobileAppCredentials(sellerId);
  }

  test("to'g'ri login+parol — Firebase custom token qaytaradi (sellerId bilan)", async () => {
    const db = buildMockDb({ sellers: { s1: { storeName: "Mening do'konim" } } });
    const { login, password } = await seedCredentials(db, "s1");

    const { _testables } = loadModule(db);
    const result = await _testables.handleMobileAppLogin({ data: { login, password } });

    expect(result.sellerId).toBe("s1");
    expect(result.storeName).toBe("Mening do'konim");
    expect(result.customToken).toBe("MOCK_CUSTOM_TOKEN_FOR_s1");
    expect(db.__createCustomTokenCalls).toEqual(["s1"]);
  });

  test("login/parol katta-kichik harfdan qat'i nazar ishlaydi (register muhim emas)", async () => {
    const db = buildMockDb({ sellers: { s1: { storeName: "Do'kon" } } });
    const { login, password } = await seedCredentials(db, "s1");

    const { _testables } = loadModule(db);
    const result = await _testables.handleMobileAppLogin({
      data: { login: login.toLowerCase(), password: password.toLowerCase() },
    });

    expect(result.sellerId).toBe("s1");
  });

  test("noto'g'ri parol — 'permission-denied' xatosi (login mavjudligini oshkor qilmaydi)", async () => {
    const db = buildMockDb({ sellers: { s1: { storeName: "Do'kon" } } });
    const { login } = await seedCredentials(db, "s1");

    const { _testables } = loadModule(db);
    await expect(_testables.handleMobileAppLogin({ data: { login, password: "NOTOGRIPAROL9" } }))
      .rejects.toMatchObject({ code: "permission-denied" });
  });

  test("mavjud bo'lmagan login — 'permission-denied' xatosi", async () => {
    const db = buildMockDb({ sellers: { s1: { storeName: "Do'kon" } } });
    const { _testables } = loadModule(db);

    await expect(_testables.handleMobileAppLogin({ data: { login: "NOSUCHLG", password: "PAROLPAROL" } }))
      .rejects.toMatchObject({ code: "permission-denied" });
  });

  test("login/parol berilmasa — 'invalid-argument' xatosi", async () => {
    const db = buildMockDb();
    const { _testables } = loadModule(db);

    await expect(_testables.handleMobileAppLogin({ data: {} }))
      .rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("sotuvchi hujjati topilmasa (o'chirilgan) — 'not-found' xatosi", async () => {
    const db = buildMockDb({ sellers: {} });
    const { login, password } = await seedCredentials(db, "ghost-seller");

    const { _testables } = loadModule(db);
    await expect(_testables.handleMobileAppLogin({ data: { login, password } }))
      .rejects.toMatchObject({ code: "not-found" });
  });

  test("qo'pol kuch himoyasi: login bo'yicha checkRateLimit chaqiriladi", async () => {
    const db = buildMockDb({ sellers: { s1: { storeName: "Do'kon" } } });
    const { login, password } = await seedCredentials(db, "s1");

    const checkRateLimitMock = jest.fn().mockResolvedValue(undefined);
    const { _testables } = loadModule(db, { checkRateLimitMock });
    await _testables.handleMobileAppLogin({ data: { login, password } });

    expect(checkRateLimitMock).toHaveBeenCalledWith(`mobileAppLogin:${login.toUpperCase()}`, 10, 3600);
  });

  test("chegaradan oshgan urinish — checkRateLimit tashlagan xato tarqaladi", async () => {
    const db = buildMockDb({ sellers: { s1: { storeName: "Do'kon" } } });
    const { login, password } = await seedCredentials(db, "s1");

    const checkRateLimitMock = jest.fn().mockRejectedValue(
      Object.assign(new Error("Juda ko'p urinish."), { code: "resource-exhausted" })
    );
    const { _testables } = loadModule(db, { checkRateLimitMock });

    await expect(_testables.handleMobileAppLogin({ data: { login, password } }))
      .rejects.toMatchObject({ code: "resource-exhausted" });
  });
});
