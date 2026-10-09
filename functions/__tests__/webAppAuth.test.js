/**
 * `webAppAuth.js` — veb (brauzer) sotuvchi paneli uchun maxsus
 * login/parol autentifikatsiyasi + `getWebSession`.
 */

jest.mock("../lib/sentry", () => ({
  withSentry: (fn) => fn,
  SENTRY_DSN: { value: () => null },
  Sentry: { captureException: jest.fn() },
  initSentry: jest.fn(),
}));

function buildMockDb({ sellers = {}, appLogins = {}, appAuth = {}, securityDocs = {} } = {}) {
  const createCustomTokenCalls = [];
  const createCustomTokenClaims = [];

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
                    if (docId === "security") {
                      const sec = securityDocs[sellerId];
                      return { get: async () => (sec ? { exists: true, data: () => sec } : { exists: false }) };
                    }
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
    __createCustomTokenClaims: createCustomTokenClaims,
  };

  return db;
}

function loadModule(db, { checkRateLimitMock, computeDashboardSummaryMock } = {}) {
  jest.resetModules();
  // `./auth` (haqiqiy) butun Telegram/dashboard mantig'ini tortadi — bu
  // testda faqat `computeDashboardSummary` kerak.
  jest.doMock("../auth", () => ({
    _testables: { computeDashboardSummary: computeDashboardSummaryMock || jest.fn().mockResolvedValue({ ordersCount: 0 }) },
  }));
  jest.doMock("../lib/admin", () => ({
    admin: {
      firestore: {
        FieldValue: { serverTimestamp: () => "MOCK_TS" },
      },
      auth: () => ({
        createCustomToken: async (uid, claims) => {
          db.__createCustomTokenCalls.push(uid);
          db.__createCustomTokenClaims.push(claims);
          return `MOCK_CUSTOM_TOKEN_FOR_${uid}`;
        },
      }),
    },
    db,
    SENTRY_DSN: { value: () => null },
  }));
  jest.doMock("../lib/helpers", () => ({ sanitizeFirestoreData: (d) => d }));
  jest.doMock("../lib/rateLimit", () => ({ checkRateLimit: checkRateLimitMock || jest.fn().mockResolvedValue(undefined) }));
  return require("../webAppAuth");
}

describe("generateWebAppCredentials", () => {
  test("login (8 belgi) va parol (10 belgi) yaratadi, faqat ruxsat etilgan alifbodan (chalkash belgilarsiz)", async () => {
    const db = buildMockDb({ sellers: { s1: { storeName: "Do'kon" } } });
    const { generateWebAppCredentials, _testables } = loadModule(db);

    const { login, password } = await generateWebAppCredentials("s1");

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
    const { generateWebAppCredentials } = loadModule(db);

    const { login, password } = await generateWebAppCredentials("s1");

    const stored = db.__appLoginsStore[login];
    expect(stored.sellerId).toBe("s1");
    expect(stored.passwordHash).toBeDefined();
    expect(stored.passwordHash).not.toBe(password);
    expect(stored.salt).toBeDefined();
    expect(db.__appAuthStore.s1).toEqual({ login, createdAt: "MOCK_TS" });
  });

  test("qayta chaqirilsa — ESKI login/parol butunlay bekor qilinadi (appLogins'dan o'chiriladi)", async () => {
    const db = buildMockDb({ sellers: { s1: { storeName: "Do'kon" } } });
    const { generateWebAppCredentials } = loadModule(db);

    const first = await generateWebAppCredentials("s1");
    expect(db.__appLoginsStore[first.login]).toBeDefined();

    const second = await generateWebAppCredentials("s1");

    expect(second.login).not.toBe(first.login);
    expect(db.__appLoginsStore[first.login]).toBeUndefined();
    expect(db.__appLoginsStore[second.login]).toBeDefined();
  });
});

describe("handleWebAppLogin", () => {
  async function seedCredentials(db, sellerId) {
    const { generateWebAppCredentials } = loadModule(db);
    return generateWebAppCredentials(sellerId);
  }

  test("to'g'ri login+parol — Firebase custom token qaytaradi (sellerId bilan)", async () => {
    const db = buildMockDb({ sellers: { s1: { storeName: "Mening do'konim" } } });
    const { login, password } = await seedCredentials(db, "s1");

    const { _testables } = loadModule(db);
    const result = await _testables.handleWebAppLogin({ data: { login, password } });

    expect(result.sellerId).toBe("s1");
    expect(result.storeName).toBe("Mening do'konim");
    expect(result.customToken).toBe("MOCK_CUSTOM_TOKEN_FOR_s1");
    expect(db.__createCustomTokenCalls).toEqual(["s1"]);
  });

  test("login/parol katta-kichik harfdan qat'i nazar ishlaydi (register muhim emas)", async () => {
    const db = buildMockDb({ sellers: { s1: { storeName: "Do'kon" } } });
    const { login, password } = await seedCredentials(db, "s1");

    const { _testables } = loadModule(db);
    const result = await _testables.handleWebAppLogin({
      data: { login: login.toLowerCase(), password: password.toLowerCase() },
    });

    expect(result.sellerId).toBe("s1");
  });

  test("noto'g'ri parol — 'permission-denied' xatosi (login mavjudligini oshkor qilmaydi)", async () => {
    const db = buildMockDb({ sellers: { s1: { storeName: "Do'kon" } } });
    const { login } = await seedCredentials(db, "s1");

    const { _testables } = loadModule(db);
    await expect(_testables.handleWebAppLogin({ data: { login, password: "NOTOGRIPAROL9" } }))
      .rejects.toMatchObject({ code: "permission-denied" });
  });

  test("mavjud bo'lmagan login — 'permission-denied' xatosi", async () => {
    const db = buildMockDb({ sellers: { s1: { storeName: "Do'kon" } } });
    const { _testables } = loadModule(db);

    await expect(_testables.handleWebAppLogin({ data: { login: "NOSUCHLG", password: "PAROLPAROL" } }))
      .rejects.toMatchObject({ code: "permission-denied" });
  });

  test("login/parol berilmasa — 'invalid-argument' xatosi", async () => {
    const db = buildMockDb();
    const { _testables } = loadModule(db);

    await expect(_testables.handleWebAppLogin({ data: {} }))
      .rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("sotuvchi hujjati topilmasa (o'chirilgan) — 'not-found' xatosi", async () => {
    const db = buildMockDb({ sellers: {} });
    const { login, password } = await seedCredentials(db, "ghost-seller");

    const { _testables } = loadModule(db);
    await expect(_testables.handleWebAppLogin({ data: { login, password } }))
      .rejects.toMatchObject({ code: "not-found" });
  });

  test("qo'pol kuch himoyasi: login bo'yicha checkRateLimit chaqiriladi", async () => {
    const db = buildMockDb({ sellers: { s1: { storeName: "Do'kon" } } });
    const { login, password } = await seedCredentials(db, "s1");

    const checkRateLimitMock = jest.fn().mockResolvedValue(undefined);
    const { _testables } = loadModule(db, { checkRateLimitMock });
    await _testables.handleWebAppLogin({ data: { login, password } });

    expect(checkRateLimitMock).toHaveBeenCalledWith(`webAppLogin:${login.toUpperCase()}`, 10, 3600);
  });

  test("chegaradan oshgan urinish — checkRateLimit tashlagan xato tarqaladi", async () => {
    const db = buildMockDb({ sellers: { s1: { storeName: "Do'kon" } } });
    const { login, password } = await seedCredentials(db, "s1");

    const checkRateLimitMock = jest.fn().mockRejectedValue(
      Object.assign(new Error("Juda ko'p urinish."), { code: "resource-exhausted" })
    );
    const { _testables } = loadModule(db, { checkRateLimitMock });

    await expect(_testables.handleWebAppLogin({ data: { login, password } }))
      .rejects.toMatchObject({ code: "resource-exhausted" });
  });
});

describe("webAppLogin — kuchaytirilgan xavfsizlik", () => {
  test("token `loginMethod: password` da'vosi bilan yaratiladi (admin huquqini bloklash uchun)", async () => {
    const db = buildMockDb({ sellers: { s1: { storeName: "Do'kon" } } });
    const { generateWebAppCredentials } = loadModule(db);
    const { login, password } = await generateWebAppCredentials("s1");
    const { _testables } = loadModule(db);
    await _testables.handleWebAppLogin({ data: { login, password } });
    expect(db.__createCustomTokenClaims[0]).toEqual({ loginMethod: "password" });
  });

  test("IP manzil bo'yicha ham checkRateLimit chaqiriladi (30/soat)", async () => {
    const db = buildMockDb({ sellers: { s1: { storeName: "Do'kon" } } });
    const { generateWebAppCredentials } = loadModule(db);
    const { login, password } = await generateWebAppCredentials("s1");
    const checkRateLimitMock = jest.fn().mockResolvedValue(undefined);
    const { _testables } = loadModule(db, { checkRateLimitMock });
    await _testables.handleWebAppLogin({ data: { login, password }, rawRequest: { ip: "1.2.3.4" } });
    expect(checkRateLimitMock).toHaveBeenCalledWith("webAppLogin:ip:1.2.3.4", 30, 3600);
  });

  test("juda uzun login/parol rad etiladi (Firestore/scrypt'ga yetib bormaydi)", async () => {
    const db = buildMockDb();
    const { _testables } = loadModule(db);
    await expect(_testables.handleWebAppLogin({ data: { login: "A".repeat(65), password: "B" } }))
      .rejects.toMatchObject({ code: "invalid-argument" });
  });
});

describe("getWebSession", () => {
  const passwordAuth = (uid) => ({ uid, token: { loginMethod: "password" } });

  test("autentifikatsiyasiz chaqirilsa — unauthenticated", async () => {
    const { _testables } = loadModule(buildMockDb());
    await expect(_testables.handleGetWebSession({})).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("Telegram sessiyasi (loginMethod yo'q) — permission-denied", async () => {
    const { _testables } = loadModule(buildMockDb({ sellers: { s1: { storeName: "D" } } }));
    await expect(_testables.handleGetWebSession({ auth: { uid: "s1", token: {} } }))
      .rejects.toMatchObject({ code: "permission-denied" });
  });

  test("do'kon, xavfsizlik va dashboard xulosasini FAQAT auth.uid uchun qaytaradi", async () => {
    const db = buildMockDb({
      sellers: { s1: { storeName: "Do'kon 1" }, s2: { storeName: "Boshqa" } },
      securityDocs: { s1: { pinLockEnabled: true } },
    });
    const computeDashboardSummaryMock = jest.fn().mockResolvedValue({ ordersCount: 7 });
    const { _testables } = loadModule(db, { computeDashboardSummaryMock });

    // `data.sellerId` yuborilsa ham E'TIBORGA OLINMAYDI
    const result = await _testables.handleGetWebSession({ auth: passwordAuth("s1"), data: { sellerId: "s2" } });

    expect(result.sellerId).toBe("s1");
    expect(result.store.storeName).toBe("Do'kon 1");
    expect(result.security).toEqual({ pinLockEnabled: true });
    expect(result.dashboardSummary).toEqual({ ordersCount: 7 });
    expect(computeDashboardSummaryMock).toHaveBeenCalledWith("s1");
  });

  test("do'kon o'chirilgan bo'lsa — not-found", async () => {
    const { _testables } = loadModule(buildMockDb());
    await expect(_testables.handleGetWebSession({ auth: passwordAuth("ghost") }))
      .rejects.toMatchObject({ code: "not-found" });
  });
});
