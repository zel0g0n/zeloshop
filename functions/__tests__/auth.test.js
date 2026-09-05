/**
 * `auth.js` (verifyTelegramAuth) uchun testlar.
 *
 * MUHIM: bu testlar aynan shu turdagi xatoni ("Promise.all massivi
 * bilan uni qabul qiluvchi o'zgaruvchilar mos kelmasligi") KELAJAKDA
 * ham topish uchun yozilgan — bu, aynan production'da 500 xatosiga
 * olib kelgan haqiqiy bug edi: `isAdmin`/`store` noto'g'ri manbadan
 * kelib qolgan bo'lardi, va quyidagi testlar buni aniq ushlaydi.
 *
 * Haqiqiy Firestore/Firebase Auth'ga ULANMAYDI — barchasi taqlid
 * qilingan (mock). Shuning uchun bu testlar tez va ishonchli.
 */

/**
 * Har bir test o'zining `db`sini qura oladi. So'ralmagan
 * kolleksiyalar uchun xavfsiz "bo'sh" natija qaytariladi — shu
 * orqali `computeDashboardSummary` ichidagi qo'shimcha so'rovlar
 * (agar to'liq mos kelmasa ham) xatosiz `null` qaytarishi
 * ta'minlanadi (u allaqachon o'z ichida try/catch bilan
 * himoyalangan).
 */
function buildMockDb({ adminExists = false, sellerData = null, securityData = null, customerBotData = null } = {}) {
  const emptyQuerySnap = { docs: [], forEach: () => {} };
  const emptyCountSnap = { data: () => ({ count: 0 }) };
  const chainable = () => {
    const self = {
      where: () => self,
      limit: () => self,
      count: () => ({ get: async () => emptyCountSnap }),
      get: async () => emptyQuerySnap,
    };
    return self;
  };

  const collections = {
    admins: {
      doc: () => ({ get: async () => ({ exists: adminExists }) }),
    },
    sellers: {
      doc: (id) => ({
        get: async () =>
          sellerData ? { exists: true, id, data: () => sellerData } : { exists: false, id },
        collection: (subName) => ({
          doc: (docName) => ({
            get: async () => {
              if (subName === "private" && docName === "security") {
                return securityData ? { exists: true, data: () => securityData } : { exists: false };
              }
              if (subName === "private" && docName === "customerBot") {
                return customerBotData ? { exists: true, data: () => customerBotData } : { exists: false };
              }
              return { exists: false };
            },
          }),
        }),
      }),
      where: chainable,
    },
    clients: {
      doc: () => ({ set: async () => undefined }),
    },
    orders: { where: chainable },
    products: { where: chainable },
    visits: { where: chainable, doc: () => ({ set: async () => undefined }) },
  };

  return {
    collection: (name) => collections[name] || { doc: () => ({ get: async () => ({ exists: false }) }) },
    // `checkRateLimit` (auth.js endi ishlatadi) o'zining
    // `db.runTransaction`ini chaqiradi — bu, test uchun oddiy,
    // umumiy taqliddir: chaqiruvchi funksiyani, soxta (har doim
    // "mavjud emas" holatini qaytaradigan) transaction obyekti bilan
    // ishga tushiradi, xolos. Chegara sonini HAQIQIY hisoblash bu
    // yerda sinalmaydi — u alohida, o'zining testida tekshiriladi
    // (`rateLimit.test.js`).
    runTransaction: async (callback) => {
      const fakeTransaction = {
        get: async () => ({ exists: false }),
        set: () => {},
        update: () => {},
      };
      return callback(fakeTransaction);
    },
  };
}

/**
 * Har bir test uchun `auth.js`ni TOZA holatda ("../lib/admin" va
 * "../telegramAuth" o'sha testga mos taqlidlar bilan) qayta yuklaydi.
 * `jest.doMock` (hoisted bo'lmagan `jest.mock`dan farqli) funksiya
 * ichida xavfsiz chaqiriladi.
 */
function loadAuthModule({ dbOptions = {}, verifyResult, verifyError, verifyByToken } = {}) {
  jest.resetModules();

  jest.doMock("../telegramAuth", () => ({
    verifyTelegramInitData: jest.fn((initData, token) => {
      if (verifyByToken) {
        const outcome = verifyByToken[token];
        if (!outcome) throw new Error("mos kelmadi (test uchun standart xato)");
        if (outcome instanceof Error) throw outcome;
        return outcome;
      }
      if (verifyError) throw verifyError;
      return verifyResult;
    }),
    peekStartParamUnsafe: jest.fn(() => {
      if (verifyByToken) {
        // Test'da qaysi token muvaffaqiyatli bo'lishidan qat'i nazar,
        // ularning barchasi BIR XIL start_param'ga ega bo'ladi deb
        // faraz qilamiz (haqiqiy hayotda ham shunday — bu shunchaki
        // "qaysi tokenni sinash kerak" degan taxmin).
        const firstResult = Object.values(verifyByToken).find((v) => !(v instanceof Error));
        return firstResult ? firstResult.startParam : null;
      }
      return verifyResult ? verifyResult.startParam : null;
    }),
  }));

  const mockDb = buildMockDb(dbOptions);
  jest.doMock("../lib/admin", () => {
    const firestoreFn = jest.fn(() => mockDb);
    firestoreFn.Timestamp = { fromDate: (d) => ({ __isTimestamp: true, date: d }) };
    firestoreFn.FieldValue = {
      serverTimestamp: () => "SERVER_TIMESTAMP",
      increment: (n) => ({ __increment: n }),
    };
    firestoreFn.FieldPath = { documentId: () => "__name__" };
    return {
      admin: {
        auth: () => ({ createCustomToken: jest.fn().mockResolvedValue("mock-custom-token") }),
        firestore: firestoreFn,
      },
      db: mockDb,
      BOT_TOKEN: { value: () => "shared-platform-token" },
      GEMINI_API_KEY: { value: () => "mock-gemini-key" },
    };
  });

  return require("../auth");
}

describe("verifyTelegramAuth", () => {
  test("sotuvchi (do'koni bor) uchun to'g'ri natija qaytaradi — isAdmin va store HAQIQIY manbadan kelishi kerak", async () => {
    const authModule = loadAuthModule({
      dbOptions: {
        adminExists: false, // bu odam ADMIN EMAS
        sellerData: { storeName: "Test Do'kon", status: "active" }, // lekin SOTUVCHI (do'koni bor)
      },
      verifyResult: { user: { id: 12345, first_name: "Ali" }, startParam: null },
    });

    const result = await authModule._testables.handleVerifyTelegramAuth({ data: { initData: "fake" } });

    // MUHIM TEKSHIRUV: bu — aynan destrukturizatsiya xatosi tufayli
    // NOTO'G'RI bo'lib qolishi mumkin bo'lgan ikkita maydon.
    expect(result.isAdmin).toBe(false); // admin hujjati mavjud emas edi
    expect(result.store).not.toBeNull(); // do'kon hujjati mavjud edi
    expect(result.store.storeName).toBe("Test Do'kon");
    expect(result.token).toBe("mock-custom-token");
    expect(result.telegramUser.id).toBe("12345");
  });

  test("admin uchun isAdmin=true va store=null qaytarishi kerak", async () => {
    const authModule = loadAuthModule({
      dbOptions: { adminExists: true, sellerData: null },
      verifyResult: { user: { id: 99999, first_name: "Admin" }, startParam: null },
    });

    const result = await authModule._testables.handleVerifyTelegramAuth({ data: { initData: "fake" } });

    expect(result.isAdmin).toBe(true);
    expect(result.store).toBeNull();
  });

  test("initData imzosi noto'g'ri bo'lsa, 'unauthenticated' xatosi bilan rad etishi kerak", async () => {
    const authModule = loadAuthModule({
      dbOptions: {},
      verifyError: new Error("imzo noto'g'ri"),
    });

    await expect(
      authModule._testables.handleVerifyTelegramAuth({ data: { initData: "yaroqsiz" } })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("mijoz (start_param bor) uchun, xavfsizlik ma'lumoti HECH QACHON qaytmasligi kerak", async () => {
    const authModule = loadAuthModule({
      dbOptions: {
        sellerData: { storeName: "Boshqa Do'kon" },
        securityData: { pinLockEnabled: true, pinCode: "1234" }, // sotuvchining o'z PIN kodi
      },
      verifyResult: { user: { id: 55555, first_name: "Mijoz" }, startParam: "seller-owner-uid" },
    });

    const result = await authModule._testables.handleVerifyTelegramAuth({ data: { initData: "fake" } });

    // Mijoz — sotuvchining PIN kodini HECH QACHON ko'rmasligi kerak.
    expect(result.security).toBeNull();
  });

  test("sotuvchini taklif qilish havolasi (_i) orqali ochilsa - `store` FAQAT o'ziniki (mavjud bo'lmagan) bo'ladi, `sellerInviterId` esa qaytariladi", async () => {
    const authModule = loadAuthModule({
      dbOptions: { sellerData: null }, // bu odam hali sotuvchi EMAS - do'koni yo'q
      verifyResult: { user: { id: 66666, first_name: "Yangi sotuvchi" }, startParam: "inviter-seller-id_i" },
    });

    const result = await authModule._testables.handleVerifyTelegramAuth({ data: { initData: "fake" } });

    // MUHIM: bu havola "sotuvchi X ning do'konini ko'rish" DEGANI EMAS -
    // shuning uchun `startParam`/`store` ODDIY "hech qanday havolasiz"
    // holatdagidek ishlaydi (o'z xavfsizlik/dashboard ma'lumoti bilan).
    expect(result.startParam).toBeNull();
    expect(result.store).toBeNull();
    expect(result.sellerInviterId).toBe("inviter-seller-id");
  });

  test("oddiy (havolasiz) kirishda `sellerInviterId` har doim null bo'ladi", async () => {
    const authModule = loadAuthModule({
      dbOptions: { sellerData: { storeName: "Test Do'kon" } },
      verifyResult: { user: { id: 12345, first_name: "Ali" }, startParam: null },
    });

    const result = await authModule._testables.handleVerifyTelegramAuth({ data: { initData: "fake" } });

    expect(result.sellerInviterId).toBeNull();
  });

  test("sotuvchining shaxsiy (xaridor) boti orqali tasdiqlansa, HAR DOIM mijoz sifatida ko'rilishi va admin/xavfsizlik/Dashboard so'rovlari o'tkazib yuborilishi kerak", async () => {
    const authModule = loadAuthModule({
      dbOptions: {
        sellerData: { storeName: "Shaxsiy Bot Do'koni" },
        customerBotData: { botToken: "custom-bot-token-123", botUsername: "mydokonbot" },
      },
      verifyByToken: {
        // Shaxsiy bot tokeni bilan MUVAFFAQIYATLI tasdiqlanadi.
        "custom-bot-token-123": { user: { id: 77777, first_name: "Xaridor" }, startParam: "seller-abc" },
        // Umumiy (platforma) token bu ssenariyda SINALMASLIGI kerak —
        // agar sinalsa va shu xato tashlansa, test aniq bilib oladi.
        "shared-platform-token": new Error("bu holatda umumiy token ishlatilmasligi kerak edi"),
      },
    });

    const result = await authModule._testables.handleVerifyTelegramAuth({ data: { initData: "fake" } });

    expect(result.startParam).toBe("seller-abc");
    expect(result.isAdmin).toBe(false);
    expect(result.security).toBeNull(); // shaxsiy bot orqali — xavfsizlik ma'lumoti HECH QACHON qaytmaydi
    expect(result.dashboardSummary).toBeNull(); // Dashboard statistikasi ham kerak emas (bu — mijoz oqimi)
    expect(result.store).not.toBeNull();
    expect(result.store.storeName).toBe("Shaxsiy Bot Do'koni");
  });

  test("initData'da start_param bo'lmasa ham (oddiy \"Start\" bilan ochilganda), lekin frontend URL orqali ownerSellerId yuborilgan bo'lsa — shaxsiy bot tokeni baribir to'g'ri sinaladi", async () => {
    const authModule = loadAuthModule({
      dbOptions: {
        sellerData: { storeName: "To'g'ridan-to'g'ri Ochiladigan Do'kon" },
        customerBotData: { botToken: "direct-bot-token-999", botUsername: "directshopbot" },
      },
      verifyByToken: {
        // initData'ning o'zida start_param YO'Q (oddiy "Start" holati) —
        // shunga qaramay, quyida `ownerSellerId` request orqali
        // ALOHIDA yuboriladi.
        "direct-bot-token-999": { user: { id: 55555, first_name: "Xaridor" }, startParam: null },
      },
    });

    const result = await authModule._testables.handleVerifyTelegramAuth({
      data: { initData: "fake", ownerSellerId: "seller-direct-999" },
    });

    expect(result.startParam).toBe("seller-direct-999");
    expect(result.security).toBeNull();
    expect(result.store.storeName).toBe("To'g'ridan-to'g'ri Ochiladigan Do'kon");
  });

  test("shaxsiy bot tokeni topilmasa (yoki mos kelmasa), umumiy platforma tokeniga muvaffaqiyatli qaytishi kerak", async () => {
    const authModule = loadAuthModule({
      dbOptions: {
        sellerData: { storeName: "Oddiy Do'kon" },
        customerBotData: null, // bu sotuvchida shaxsiy bot yo'q
      },
      verifyResult: { user: { id: 12345, first_name: "Ali" }, startParam: null },
    });

    const result = await authModule._testables.handleVerifyTelegramAuth({ data: { initData: "fake" } });

    expect(result.telegramUser.id).toBe("12345");
    expect(result.store.storeName).toBe("Oddiy Do'kon");
  });
});

describe("computeDashboardSummary — Konversiya hisob-kitobi", () => {
  /**
   * Bu yerda `buildMockDb`dagi umumiy (har doim 0 qaytaradigan)
   * `chainable()`dan farqli, HAQIQIY sonlarni qaytaradigan maxsus
   * mock ishlatiladi — Konversiya (buyurtmalar/tashriflar) formulasi
   * to'g'ri hisoblanishini tasdiqlash uchun.
   */
  function loadAuthWithVisitorCount({ ordersCount, visitorCount }) {
    jest.resetModules();
    jest.doMock("../telegramAuth", () => ({
      verifyTelegramInitData: jest.fn(),
      peekStartParamUnsafe: jest.fn(() => null),
    }));

    const makeOrderDoc = (i) => ({
      id: `order-${i}`,
      data: () => ({ status: "delivered", totalAmount: 10000, createdAt: { toMillis: () => Date.now() } }),
    });

    const mockDb = {
      collection: (name) => {
        if (name === "orders") {
          return {
            where: () => ({
              where: () => ({
                limit: () => ({
                  get: async () => ({
                    docs: Array.from({ length: ordersCount }, (_, i) => makeOrderDoc(i)),
                  }),
                }),
              }),
              // MUHIM: `computeDashboardSummary` ichida "onboarding
              // checklist" uchun qo'shilgan `hasEverOrdered` so'rovi -
              // `db.collection("orders").where("sellerId","==",sellerId)
              // .count().get()` - BITTA `.where()`dan KEYIN to'g'ridan-
              // to'g'ri `.count()` chaqiradi, yuqoridagi ikki qavatli
              // `.where().where()` zanjiridan FARQLI. Bu metod avval
              // shu yerda YO'Q edi - shuning uchun test "count is not
              // a function" xatosi bilan buzilardi.
              count: () => ({ get: async () => ({ data: () => ({ count: ordersCount }) }) }),
            }),
          };
        }
        if (name === "products") {
          return {
            where: () => ({
              count: () => ({ get: async () => ({ data: () => ({ count: 0 }) }) }),
              where: () => ({ count: () => ({ get: async () => ({ data: () => ({ count: 0 }) }) }) }),
            }),
          };
        }
        if (name === "visits") {
          return {
            where: () => ({
              where: () => ({ count: () => ({ get: async () => ({ data: () => ({ count: visitorCount }) }) }) }),
            }),
          };
        }
        return { doc: () => ({ get: async () => ({ exists: false }) }) };
      },
    };

    jest.doMock("../lib/admin", () => {
      const firestoreFn = jest.fn(() => mockDb);
      firestoreFn.Timestamp = { fromDate: (d) => ({ __isTimestamp: true, date: d }) };
      firestoreFn.FieldValue = { serverTimestamp: () => "SERVER_TIMESTAMP", increment: (n) => ({ __increment: n }) };
      firestoreFn.FieldPath = { documentId: () => "__name__" };
      return {
        admin: { auth: () => ({}), firestore: firestoreFn },
        db: mockDb,
        BOT_TOKEN: { value: () => "mock" },
        GEMINI_API_KEY: { value: () => "mock" },
      };
    });

    return require("../auth");
  }

  test("10 ta buyurtma, 200 ta tashrif → 5% konversiya", async () => {
    const authModule = loadAuthWithVisitorCount({ ordersCount: 10, visitorCount: 200 });
    const summary = await authModule._testables.computeDashboardSummary("seller-1");
    expect(summary.visitorCount).toBe(200);
    expect(summary.conversionRate).toBe(5);
  });

  test("tashrif 0 bo'lsa, konversiya 0 (bo'linishga urinib NaN/Infinity chiqmaydi)", async () => {
    const authModule = loadAuthWithVisitorCount({ ordersCount: 3, visitorCount: 0 });
    const summary = await authModule._testables.computeDashboardSummary("seller-1");
    expect(summary.visitorCount).toBe(0);
    expect(summary.conversionRate).toBe(0);
  });

  // XAVFSIZLIK (P2 fix, 2026-09 audit): "bugungi buyurtmalar" so'rovi
  // oldin `.limit()`siz edi — bir marta tasdiqlangan Telegram
  // `initData` 24 soatgacha qayta ishlatilishi mumkinligi bilan
  // birlashganda, bu Firestore o'qish xarajatini cheksiz oshirish
  // vektori edi. Endi `.limit(1000)` qo'yilgani HAQIQIY chaqiruv
  // zanjirida ishlashini tasdiqlaymiz (avvalgi testlar mock orqali
  // buni "yashirgan" bo'lardi, agar `.limit` chaqirilmagan mock ham
  // xato bermay ishlab ketaverishi mumkin edi).
  test("'bugungi buyurtmalar' so'rovi `.limit()` bilan chaqirilishini talab qiladi (mock `.limit` bo'lmasa xato beradi)", async () => {
    jest.resetModules();
    jest.doMock("../telegramAuth", () => ({
      verifyTelegramInitData: jest.fn(),
      peekStartParamUnsafe: jest.fn(() => null),
    }));
    const mockDb = {
      collection: (name) => {
        if (name === "orders") {
          return {
            where: () => ({
              // ATAYLAB `.limit` METODI YO'Q — agar kod `.limit()`ni
              // chaqirmasa, bu mock TypeError tashlamaydi va test
              // (noto'g'ri) o'tib ketardi; shuning uchun bu yerda
              // ANIQ shart: `.where()`ning o'zi ikkinchi marta
              // chaqirilganda hosil bo'lgan obyektda FAQAT `limit`
              // mavjud, `get` esa YO'Q — kod `.get()`ni to'g'ridan-
              // to'g'ri (limit'siz) chaqirsa, aynan shu yerda
              // "get is not a function" bilan aniq muvaffaqiyatsiz
              // bo'ladi.
              where: () => ({
                limit: (n) => {
                  if (n !== 1000) throw new Error(`Kutilmagan limit qiymati: ${n}`);
                  return { get: async () => ({ docs: [] }) };
                },
              }),
              count: () => ({ get: async () => ({ data: () => ({ count: 0 }) }) }),
            }),
          };
        }
        if (name === "products") {
          return {
            where: () => ({
              count: () => ({ get: async () => ({ data: () => ({ count: 0 }) }) }),
              where: () => ({ count: () => ({ get: async () => ({ data: () => ({ count: 0 }) }) }) }),
            }),
          };
        }
        if (name === "visits") {
          return { where: () => ({ where: () => ({ count: () => ({ get: async () => ({ data: () => ({ count: 0 }) }) }) }) }) };
        }
        return { doc: () => ({ get: async () => ({ exists: false }) }) };
      },
    };
    jest.doMock("../lib/admin", () => {
      const firestoreFn = jest.fn(() => mockDb);
      firestoreFn.Timestamp = { fromDate: (d) => ({ __isTimestamp: true, date: d }) };
      firestoreFn.FieldValue = { serverTimestamp: () => "SERVER_TIMESTAMP", increment: (n) => ({ __increment: n }) };
      firestoreFn.FieldPath = { documentId: () => "__name__" };
      return { admin: { auth: () => ({}), firestore: firestoreFn }, db: mockDb, BOT_TOKEN: { value: () => "mock" }, GEMINI_API_KEY: { value: () => "mock" } };
    });
    const authModule = require("../auth");
    const summary = await authModule._testables.computeDashboardSummary("seller-1");
    expect(summary.totalSales).toBe(0);
  });
});
