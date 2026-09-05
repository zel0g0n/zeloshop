/**
 * `telegramBotMenu.js` — foydalanuvchi so'ragan, platforma botiga
 * qo'shilgan UCHTA yangi "menyu" tugmasi ("Yangi buyurtmalar", "AI CEO
 * hisobotlari", "AI CEO bilan mahsulot qo'shish") uchun testlar.
 */

jest.mock("../lib/sentry", () => ({
  withSentry: (fn) => fn,
  SENTRY_DSN: { value: () => null },
  Sentry: { captureException: jest.fn() },
  initSentry: jest.fn(),
}));

function buildMockDb({ sellerData = null, session = null, orders = [] } = {}) {
  const setCalls = [];
  const updateCalls = [];
  const deleteCalls = [];
  const addCalls = [];
  const db = {
    collection: (name) => {
      if (name === "sellers") {
        return {
          doc: (sellerId) => ({
            get: async () => (sellerData ? { exists: true, data: () => sellerData } : { exists: false }),
            collection: (subName) => {
              if (subName === "private") {
                return {
                  doc: (docId) => ({
                    get: async () => (session ? { exists: true, data: () => session } : { exists: false }),
                    set: async (data) => setCalls.push({ sellerId, docId, data }),
                    update: async (data) => {
                      updateCalls.push({ sellerId, docId, data });
                      // `arrayUnion`ni sodda simulyatsiya qilamiz - test
                      // ichida bevosita URL string'ini kuzatish uchun,
                      // va sessiya `mode` maydonini ham yangilaymiz.
                      if (session) {
                        if (data.photoUrls && data.photoUrls.__op === "arrayUnion") {
                          session.photoUrls = [...(session.photoUrls || []), ...data.photoUrls.values];
                        }
                        if (data.mode) session.mode = data.mode;
                      }
                    },
                    delete: async () => deleteCalls.push({ sellerId, docId }),
                  }),
                };
              }
              if (subName === "productDrafts") {
                return {
                  add: async (data) => {
                    addCalls.push({ sellerId, data });
                    return { id: "draft-1", update: async () => {} };
                  },
                };
              }
              return { doc: () => ({ get: async () => ({ exists: false }) }) };
            },
          }),
        };
      }
      if (name === "orders") {
        // Sodda so'rov-zanjiri simulyatsiyasi: FAQAT `.where().where().count().get()`
        // qo'llab-quvvatlanadi - `handleNewOrdersButton` boshqa hech
        // narsa ishlatmaydi (endi individual hujjatlarni o'qimaydi,
        // faqat sonini tekshiradi).
        const buildQuery = (filters) => ({
          where: (field, op, value) => buildQuery([...filters, { field, op, value }]),
          count: () => ({
            get: async () => {
              const results = orders.filter((o) => filters.every((f) => o[f.field] === f.value));
              return { data: () => ({ count: results.length }) };
            },
          }),
        });
        return buildQuery([]);
      }
      return { doc: () => ({ get: async () => ({ exists: false }) }) };
    },
    runTransaction: async (callback) => callback({ get: async () => ({ exists: false }), set: () => {} }),
    __setCalls: setCalls,
    __updateCalls: updateCalls,
    __deleteCalls: deleteCalls,
    __addCalls: addCalls,
  };
  return db;
}

function loadModule(db, { buildDailyReportMock } = {}) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => "MOCK_TS",
          arrayUnion: (...values) => ({ __op: "arrayUnion", values }),
        },
      },
      storage: () => ({
        bucket: () => ({
          name: "mock-bucket",
          file: () => ({ save: jest.fn(async () => undefined) }),
        }),
      }),
    },
    db,
  }));
  jest.doMock("../aiCeo", () => ({
    buildDailyReport: buildDailyReportMock || jest.fn(),
  }));
  return require("../telegramBotMenu");
}

// Rasm yuklab olish/yuborish oqimida ishlatiladigan Telegram API
// so'rovlarini (`getFile` + fayl yuklab olish) simulyatsiya qiladi -
// `sendMessage`dan FARQLI ravishda, bular HAR BIR rasm testida
// ishlatiladi.
function mockPhotoFetch() {
  return jest.fn(async (url) => {
    if (typeof url === "string" && url.includes("/getFile")) {
      return { json: async () => ({ ok: true, result: { file_path: "photos/file_1.jpg" } }) };
    }
    if (typeof url === "string" && url.includes("/file/bot")) {
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
    }
    return { json: async () => ({ ok: true }) };
  });
}

describe("buildMainMenuKeyboard / buildPhotoCollectionKeyboard / buildConfirmationKeyboard (sof funksiyalar)", () => {
  test("asosiy menyu UCHALA tugmani ('Yangi buyurtmalar' BIRINCHI) o'z ichiga oladi", () => {
    const { buildMainMenuKeyboard, MENU_NEW_ORDERS_TEXT, MENU_REPORT_TEXT, MENU_ADD_PRODUCT_TEXT } = loadModule(buildMockDb());
    const keyboard = buildMainMenuKeyboard();
    const allTexts = keyboard.keyboard.flat().map((b) => b.text);
    expect(allTexts).toEqual([MENU_NEW_ORDERS_TEXT, MENU_REPORT_TEXT, MENU_ADD_PRODUCT_TEXT]);
    expect(keyboard.resize_keyboard).toBe(true);
  });

  test("rasm yig'ish menyusi 'Tayyor' va 'Bekor qilish' tugmalarini o'z ichiga oladi", () => {
    const { buildPhotoCollectionKeyboard, FINISH_TEXT, CANCEL_TEXT } = loadModule(buildMockDb());
    const keyboard = buildPhotoCollectionKeyboard();
    expect(keyboard.keyboard[0].map((b) => b.text)).toEqual([FINISH_TEXT, CANCEL_TEXT]);
  });

  test("tasdiqlash menyusi 'Tasdiqlash' va 'Bekor qilish' tugmalarini o'z ichiga oladi", () => {
    const { buildConfirmationKeyboard, CONFIRM_TEXT, CANCEL_TEXT } = loadModule(buildMockDb());
    const keyboard = buildConfirmationKeyboard();
    expect(keyboard.keyboard[0].map((b) => b.text)).toEqual([CONFIRM_TEXT, CANCEL_TEXT]);
  });
});

describe("pickLargestPhoto", () => {
  test("eng katta (width*height) o'lchamli rasmni tanlaydi", () => {
    const { pickLargestPhoto } = loadModule(buildMockDb());
    const sizes = [
      { file_id: "small", width: 90, height: 90 },
      { file_id: "large", width: 1280, height: 960 },
      { file_id: "medium", width: 320, height: 240 },
    ];
    expect(pickLargestPhoto(sizes).file_id).toBe("large");
  });

  test("bo'sh/null massiv uchun null qaytaradi", () => {
    const { pickLargestPhoto } = loadModule(buildMockDb());
    expect(pickLargestPhoto([])).toBeNull();
    expect(pickLargestPhoto(null)).toBeNull();
  });
});

describe("_testables.formatHourLabel", () => {
  test("standart (21) va maxsus soatlarni 'HH:00' shaklida formatlaydi", () => {
    const { _testables } = loadModule(buildMockDb());
    expect(_testables.formatHourLabel(undefined)).toBe("21:00");
    expect(_testables.formatHourLabel(9)).toBe("09:00");
    expect(_testables.formatHourLabel(20)).toBe("20:00");
  });
});

describe("formatDailyReportForTelegram", () => {
  const baseReport = {
    date: "2026-08-25",
    financial: { todayRevenue: 450_000, yesterdayRevenue: 380_000, revenueChangePercent: 18.4, todayOrderCount: 12, todayDeliveredCount: 9 },
    productRecommendations: { discountCandidates: [], promoteCandidates: [] },
    productAdditions: { addedTodayCount: 0, salesFromNewProducts: 0 },
    crmActivity: {
      cartRemindersSent: 0, favoriteRemindersSent: 0, repurchaseRemindersSent: 0, crmMessagesSent: 0,
      convertedCount: 0, activeCustomers: 10, inactiveCustomers: 2, aiAutoActionsCount: 0, autoDiscountsIssuedCount: 0,
    },
    attentionNeeded: { vipCount: 0, churnCount: 0 },
    aiActionPlan: null,
    learningSummary: { winback: null, favorite: null },
  };

  test("asosiy moliyaviy ma'lumotni to'g'ri kiritadi", () => {
    const { formatDailyReportForTelegram } = loadModule(buildMockDb());
    const text = formatDailyReportForTelegram(baseReport, "Gulnora Cosmetics");
    expect(text).toContain("Gulnora Cosmetics");
    expect(text).toContain("450,000 so'm");
    expect(text).toContain("380,000 so'm");
    expect(text).toContain("+18%");
  });

  test("revenueChangePercent null bo'lsa, foizni EMAS, tushuntirish matnini yozadi", () => {
    const { formatDailyReportForTelegram } = loadModule(buildMockDb());
    const text = formatDailyReportForTelegram({ ...baseReport, financial: { ...baseReport.financial, revenueChangePercent: null } });
    expect(text).toContain("solishtirish uchun yetarli ma'lumot yo'q");
  });

  test("mahsulot tavsiyalari bo'sh bo'lsa, o'sha bo'limni QO'SHMAYDI", () => {
    const { formatDailyReportForTelegram } = loadModule(buildMockDb());
    const text = formatDailyReportForTelegram(baseReport);
    expect(text).not.toContain("Mahsulot tavsiyalari");
  });

  test("mahsulot tavsiyalari bo'lsa, nomlarini ko'rsatadi", () => {
    const { formatDailyReportForTelegram } = loadModule(buildMockDb());
    const report = {
      ...baseReport,
      productRecommendations: {
        discountCandidates: [{ id: "p1", name: "Krem A" }],
        promoteCandidates: [{ id: "p2", name: "Krem B", soldQty: 14 }],
      },
    };
    const text = formatDailyReportForTelegram(report);
    expect(text).toContain("Krem A");
    expect(text).toContain("Krem B (14 dona)");
  });

  test("AI harakat rejasi bo'lsa, sababini qo'shadi", () => {
    const { formatDailyReportForTelegram } = loadModule(buildMockDb());
    const text = formatDailyReportForTelegram({ ...baseReport, aiActionPlan: { order: ["vip"], reasoning: "VIP mijozlar ustuvor" } });
    expect(text).toContain("VIP mijozlar ustuvor");
  });
});

describe("handleTelegramMessage - hisobot va mahsulot qo'shish marshrutlash", () => {
  test("aiCeoEnabled bo'lmagan sotuvchi 'hisobot' tugmasini bossa, premium xabarini oladi, Gemini chaqirilmaydi", async () => {
    const buildDailyReportMock = jest.fn();
    const db = buildMockDb({ sellerData: { aiCeoEnabled: false } });
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ json: async () => ({ ok: true }) }));
    try {
      const { handleTelegramMessage, MENU_REPORT_TEXT } = loadModule(db, { buildDailyReportMock });
      await handleTelegramMessage("mock-token", { text: MENU_REPORT_TEXT, from: { id: 555 }, chat: { id: 555 } });
      expect(buildDailyReportMock).not.toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/sendMessage"),
        expect.objectContaining({ body: expect.stringContaining("premium") })
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("aiCeoEnabled sotuvchi 'hisobot' tugmasini bossa, buildDailyReport chaqiriladi va natija yuboriladi", async () => {
    const buildDailyReportMock = jest.fn(async () => ({
      date: "2026-08-25",
      financial: { todayRevenue: 100, yesterdayRevenue: 50, revenueChangePercent: 100, todayOrderCount: 1, todayDeliveredCount: 1 },
      productRecommendations: { discountCandidates: [], promoteCandidates: [] },
      productAdditions: { addedTodayCount: 0, salesFromNewProducts: 0 },
      crmActivity: { cartRemindersSent: 0, favoriteRemindersSent: 0, repurchaseRemindersSent: 0, crmMessagesSent: 0, convertedCount: 0, activeCustomers: 0, inactiveCustomers: 0, aiAutoActionsCount: 0, autoDiscountsIssuedCount: 0 },
      attentionNeeded: { vipCount: 0, churnCount: 0 },
      aiActionPlan: null,
      learningSummary: { winback: null, favorite: null },
    }));
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true, storeName: "Zelo" } });
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ json: async () => ({ ok: true }) }));
    try {
      const { handleTelegramMessage, MENU_REPORT_TEXT } = loadModule(db, { buildDailyReportMock });
      await handleTelegramMessage("mock-token", { text: MENU_REPORT_TEXT, from: { id: 555 }, chat: { id: 555 } });
      expect(buildDailyReportMock).toHaveBeenCalledWith("555", { aiCeoEnabled: true, storeName: "Zelo" });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/sendMessage"),
        expect.objectContaining({ body: expect.stringContaining("Zelo") })
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("'mahsulot qo'shish' tugmasi bosilsa, sessiya 'awaiting_photos' rejimida, sotuvchining sozlangan soati bilan boshlanadi", async () => {
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true, aiCeoDraftProcessHour: 20 } });
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ json: async () => ({ ok: true }) }));
    try {
      const { handleTelegramMessage, MENU_ADD_PRODUCT_TEXT } = loadModule(db, {});
      await handleTelegramMessage("mock-token", { text: MENU_ADD_PRODUCT_TEXT, from: { id: 555 }, chat: { id: 555 } });
      expect(db.__setCalls).toHaveLength(1);
      expect(db.__setCalls[0].data.mode).toBe("awaiting_photos");
      expect(db.__setCalls[0].data.photoUrls).toEqual([]);
      expect(db.__setCalls[0].data.preferredHour).toBe(20);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("'mahsulot qo'shish' tugmasi bosilsa va sotuvchi soat sozlamagan bo'lsa, standart 21 ishlatiladi", async () => {
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true } });
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ json: async () => ({ ok: true }) }));
    try {
      const { handleTelegramMessage, MENU_ADD_PRODUCT_TEXT } = loadModule(db, {});
      await handleTelegramMessage("mock-token", { text: MENU_ADD_PRODUCT_TEXT, from: { id: 555 }, chat: { id: 555 } });
      expect(db.__setCalls[0].data.preferredHour).toBe(21);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("rasm kelganda, sessiya bo'lmasa - HECH NARSA qilmaydi (jim e'tiborsiz)", async () => {
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true }, session: null });
    const originalFetch = global.fetch;
    global.fetch = mockPhotoFetch();
    try {
      const { handleTelegramMessage } = loadModule(db, {});
      await handleTelegramMessage("mock-token", {
        photo: [{ file_id: "f1", width: 100, height: 100 }],
        from: { id: 555 }, chat: { id: 555 },
      });
      expect(global.fetch.mock.calls.some(([url]) => url.includes("/sendMessage"))).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("1-3 rasm yuborilganda, HECH QANDAY 'qabul qilindi' xabari YUBORILMAYDI (foydalanuvchi so'ragan o'zgarish)", async () => {
    const session = { mode: "awaiting_photos", photoUrls: [], preferredHour: 20 };
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true }, session });
    const originalFetch = global.fetch;
    global.fetch = mockPhotoFetch();
    try {
      const { handleTelegramMessage } = loadModule(db, {});
      await handleTelegramMessage("mock-token", {
        photo: [{ file_id: "f1", width: 800, height: 600 }],
        from: { id: 555 }, chat: { id: 555 },
      });
      // Faqat Telegram fayl API'lari chaqirildi - sendMessage YO'Q.
      expect(global.fetch.mock.calls.some(([url]) => url.includes("/sendMessage"))).toBe(false);
      expect(session.photoUrls).toHaveLength(1);
      expect(session.mode).toBe("awaiting_photos"); // hali tasdiqlash bosqichiga o'tmagan
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("4-rasm (MAX_PHOTOS) yuborilganda, sessiya 'awaiting_confirmation'ga o'tadi va BIR MARTA tasdiqlash so'raladi", async () => {
    const session = { mode: "awaiting_photos", photoUrls: ["a.jpg", "b.jpg", "c.jpg"], preferredHour: 20 };
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true }, session });
    const originalFetch = global.fetch;
    global.fetch = mockPhotoFetch();
    try {
      const { handleTelegramMessage } = loadModule(db, {});
      await handleTelegramMessage("mock-token", {
        photo: [{ file_id: "f4", width: 800, height: 600 }],
        from: { id: 555 }, chat: { id: 555 },
      });
      expect(session.mode).toBe("awaiting_confirmation");
      const sendCalls = global.fetch.mock.calls.filter(([url]) => url.includes("/sendMessage"));
      expect(sendCalls).toHaveLength(1); // FAQAT bitta, yakuniy tasdiqlash xabari
      const body = JSON.parse(sendCalls[0][1].body);
      expect(body.text).toContain("4 ta rasm");
      expect(body.text).toContain("20:00"); // sozlangan soat ko'rsatilgan
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("'Tayyor' bosilganda, rasm YO'Q bo'lsa - kamida bitta rasm so'raladi, tasdiqlash bosqichiga O'TMAYDI", async () => {
    const session = { mode: "awaiting_photos", photoUrls: [], preferredHour: 21 };
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true }, session });
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ json: async () => ({ ok: true }) }));
    try {
      const { handleTelegramMessage, FINISH_TEXT } = loadModule(db, {});
      await handleTelegramMessage("mock-token", { text: FINISH_TEXT, from: { id: 555 }, chat: { id: 555 } });
      expect(session.mode).toBe("awaiting_photos");
      expect(db.__addCalls).toHaveLength(0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("'Tayyor' bosilganda, rasm(lar) bor bo'lsa - tasdiqlash so'raladi, draft HALI YARATILMAYDI", async () => {
    const session = { mode: "awaiting_photos", photoUrls: ["https://example.com/1.jpg"], preferredHour: 21 };
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true }, session });
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ json: async () => ({ ok: true }) }));
    try {
      const { handleTelegramMessage, FINISH_TEXT } = loadModule(db, {});
      await handleTelegramMessage("mock-token", { text: FINISH_TEXT, from: { id: 555 }, chat: { id: 555 } });
      expect(session.mode).toBe("awaiting_confirmation");
      expect(db.__addCalls).toHaveLength(0); // hali tasdiqlanmagan
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("'Tasdiqlash' bosilganda ('awaiting_confirmation' bosqichida) - draft 'queued' holatda yaratiladi, sessiya o'chiriladi, belgilangan soat aytiladi", async () => {
    const session = { mode: "awaiting_confirmation", photoUrls: ["https://example.com/1.jpg"], preferredHour: 20 };
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true }, session });
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ json: async () => ({ ok: true }) }));
    try {
      const { handleTelegramMessage, CONFIRM_TEXT } = loadModule(db, {});
      await handleTelegramMessage("mock-token", { text: CONFIRM_TEXT, from: { id: 555 }, chat: { id: 555 } });
      expect(db.__addCalls).toHaveLength(1);
      expect(db.__addCalls[0].data).toMatchObject({ imageUrls: ["https://example.com/1.jpg"], status: "queued" });
      expect(db.__deleteCalls).toHaveLength(1); // sessiya tozalandi
      const sendCalls = global.fetch.mock.calls.filter(([url]) => url.includes("/sendMessage"));
      expect(JSON.parse(sendCalls[0][1].body).text).toContain("20:00");
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("'Tasdiqlash' bosilganda, hali 'awaiting_photos' bosqichida bo'lsa (erta bosish) - HECH NARSA qilmaydi", async () => {
    const session = { mode: "awaiting_photos", photoUrls: ["https://example.com/1.jpg"], preferredHour: 21 };
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true }, session });
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ json: async () => ({ ok: true }) }));
    try {
      const { handleTelegramMessage, CONFIRM_TEXT } = loadModule(db, {});
      await handleTelegramMessage("mock-token", { text: CONFIRM_TEXT, from: { id: 555 }, chat: { id: 555 } });
      expect(db.__addCalls).toHaveLength(0);
      expect(db.__deleteCalls).toHaveLength(0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("kunlik 4 ta mahsulot chegarasidan oshsa, tasdiqlashda draft YARATILMAYDI", async () => {
    const session = { mode: "awaiting_confirmation", photoUrls: ["https://example.com/1.jpg"], preferredHour: 21 };
    const rateLimitDb = buildMockDb({ sellerData: { aiCeoEnabled: true }, session });
    // `checkRateLimit` haqiqiy Firestore transaction orqali ishlaydi -
    // shu sababli `rateLimits` kolleksiyasini ALLAQACHON chegaraga
    // yetgan holatda simulyatsiya qilamiz.
    const originalCollection = rateLimitDb.collection;
    rateLimitDb.collection = (name) => {
      if (name === "rateLimits") {
        return { doc: () => ({}) };
      }
      return originalCollection(name);
    };
    rateLimitDb.runTransaction = async (callback) => callback({
      get: async () => ({ exists: true, data: () => ({ windowStart: Date.now(), count: 4 }) }),
      set: () => {},
    });

    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ json: async () => ({ ok: true }) }));
    try {
      const { handleTelegramMessage, CONFIRM_TEXT } = loadModule(rateLimitDb, {});
      await handleTelegramMessage("mock-token", { text: CONFIRM_TEXT, from: { id: 555 }, chat: { id: 555 } });
      expect(rateLimitDb.__addCalls).toHaveLength(0);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/sendMessage"),
        expect.objectContaining({ body: expect.stringContaining("Kunlik chegara") })
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("'Bekor qilish' bosilganda, sessiya o'chiriladi (tasdiqlash bosqichida ham ishlaydi)", async () => {
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true }, session: { mode: "awaiting_confirmation", photoUrls: ["x.jpg"] } });
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ json: async () => ({ ok: true }) }));
    try {
      const { handleTelegramMessage, CANCEL_TEXT } = loadModule(db, {});
      await handleTelegramMessage("mock-token", { text: CANCEL_TEXT, from: { id: 555 }, chat: { id: 555 } });
      expect(db.__deleteCalls).toHaveLength(1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("sellerId/chatId bo'lmasa, hech narsa qilmaydi (xato tashlamaydi)", async () => {
    const { handleTelegramMessage } = loadModule(buildMockDb());
    await expect(handleTelegramMessage("mock-token", {})).resolves.toBeUndefined();
  });
});

describe("handleNewOrdersButton ('🆕 Yangi buyurtmalar' tugmasi)", () => {
  test("'new' holatdagi buyurtma yo'q bo'lsa, tegishli xabar yuboradi", async () => {
    const db = buildMockDb({ orders: [] });
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ json: async () => ({ ok: true }) }));
    try {
      const { handleTelegramMessage, MENU_NEW_ORDERS_TEXT } = loadModule(db, {});
      await handleTelegramMessage("mock-token", { text: MENU_NEW_ORDERS_TEXT, from: { id: 555 }, chat: { id: 555 } });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/sendMessage"),
        expect.objectContaining({ body: expect.stringContaining("yo'q") })
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("buyurtma(lar) mavjud bo'lsa, sonini aytadi va ilovani '/seller/orders'ga ochadigan web_app tugma yuboradi", async () => {
    const db = buildMockDb({
      orders: [
        { id: "o1", sellerId: "555", status: "new" },
        { id: "o2", sellerId: "555", status: "new" },
        { id: "o3", sellerId: "999", status: "new" }, // boshqa sotuvchi - hisoblanmasligi kerak
        { id: "o4", sellerId: "555", status: "delivered" }, // boshqa holat - hisoblanmasligi kerak
      ],
    });
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ json: async () => ({ ok: true }) }));
    try {
      const { handleTelegramMessage, MENU_NEW_ORDERS_TEXT } = loadModule(db, {});
      await handleTelegramMessage("mock-token", { text: MENU_NEW_ORDERS_TEXT, from: { id: 555 }, chat: { id: 555 } });
      const sendCalls = global.fetch.mock.calls.filter(([url]) => url.includes("/sendMessage"));
      expect(sendCalls).toHaveLength(1);
      const body = JSON.parse(sendCalls[0][1].body);
      expect(body.text).toContain("2 ta yangi buyurtma");
      const button = body.reply_markup.inline_keyboard[0][0];
      expect(button.web_app.url).toBe("https://commerce-zelo.web.app/seller/orders");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
