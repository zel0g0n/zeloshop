/**
 * `telegramApproval.js` uchun testlar — AI CEO'ning Telegram orqali
 * "1-tugmali tasdiqlash" oqimi (YANGI, `onRequest` webhook + kunlik
 * tavsiya raqami).
 *
 * MUHIM: bu faylda BIRINCHI marta `onRequest` (xom HTTP so'rov)
 * ishlatilgan — testda buni ham, `onSchedule`/`onCall` kabi, ikkinchi
 * argumentini (haqiqiy handler) to'g'ridan-to'g'ri "ushlab olib"
 * sinaymiz.
 */

jest.mock("../lib/sentry", () => ({
  withSentry: (fn) => fn,
  SENTRY_DSN: { value: () => null },
  Sentry: { captureException: jest.fn() },
  initSentry: jest.fn(),
}));

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: (config, handler) => handler,
}));

class MockHttpsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

jest.mock("firebase-functions/v2/https", () => ({
  onRequest: (config, handler) => handler,
  onCall: (config, handler) => handler,
  HttpsError: MockHttpsError,
}));

function buildMockDb({ pendingAction = null, customerBotTokens = {} } = {}) {
  const updateCalls = [];
  const setCalls = [];
  return {
    collection: (name) => {
      if (name === "sellers") {
        return {
          doc: (sellerId) => ({
            collection: (subName) => {
              if (subName === "aiCeoPendingActions") {
                return {
                  doc: (actionId) => ({
                    get: async () => (pendingAction ? { exists: true, data: () => pendingAction } : { exists: false }),
                    update: async (data) => updateCalls.push({ sellerId, actionId, data }),
                    set: async (data) => setCalls.push({ sellerId, actionId, data }),
                  }),
                };
              }
              if (subName === "customers") {
                return { get: async () => ({ docs: [] }) };
              }
              // YANGI (v39.6): `getSellerCustomBotToken`ning
              // "sellers/{id}/private/customerBot" o'qishini
              // qo'llab-quvvatlash - `customerBotTokens[sellerId]`
              // berilmagan bo'lsa, "ulanmagan" holatini taqlid qiladi.
              if (subName === "private") {
                return {
                  doc: () => ({
                    get: async () => (
                      customerBotTokens[sellerId]
                        ? { exists: true, data: () => ({ botToken: customerBotTokens[sellerId] }) }
                        : { exists: false }
                    ),
                  }),
                };
              }
              return { doc: () => ({ get: async () => ({ exists: false }) }) };
            },
            get: async () => ({ exists: false }),
          }),
        };
      }
      return { doc: () => ({ get: async () => ({ exists: false }) }), add: async () => ({}) };
    },
    __updateCalls: updateCalls,
    __setCalls: setCalls,
    // `checkRateLimit` (`respondToAiCeoPendingAction` uchun) shu orqali
    // ishlaydi - standart holatda "hali chegaradan o'tmagan" holatni
    // simulyatsiya qiladi.
    runTransaction: async (callback) => callback({ get: async () => ({ exists: false }), set: () => {} }),
  };
}

function loadModule(db, { collectAttentionSegmentClientIdsMock, craftCrmCampaignMock, handleTelegramMessageMock } = {}) {
  jest.resetModules();
  const sendTelegramMessageMock = jest.fn(async () => ({ ok: true }));
  const answerCallbackQueryMock = jest.fn(async () => undefined);
  const editTelegramMessageTextMock = jest.fn(async () => undefined);
  const handleTelegramMessageFn = handleTelegramMessageMock || jest.fn(async () => undefined);
  jest.doMock("../lib/admin", () => ({
    admin: { firestore: { FieldValue: { serverTimestamp: () => "MOCK_TS" } } },
    db,
    BOT_TOKEN: { value: () => "mock-bot-token" },
    GEMINI_API_KEY: { value: () => "mock-gemini-key" },
    TELEGRAM_WEBHOOK_SECRET: { value: () => "mock-webhook-secret" },
  }));
  jest.doMock("../lib/helpers", () => ({
    sendTelegramMessage: sendTelegramMessageMock,
    answerCallbackQuery: answerCallbackQueryMock,
    editTelegramMessageText: editTelegramMessageTextMock,
  }));
  jest.doMock("../lib/dailyStats", () => ({
    todayDocId: () => "2026-08-23",
    trackCrmMessageRecipients: jest.fn(async () => undefined),
    logNotification: jest.fn(async () => undefined),
  }));
  jest.doMock("../aiCeo", () => ({
    collectAttentionSegmentClientIds: collectAttentionSegmentClientIdsMock || jest.fn(() => ({ vipClientIds: [], churnClientIds: [] })),
    craftCrmCampaign: craftCrmCampaignMock || jest.fn(),
  }));
  jest.doMock("../telegramBotMenu", () => ({
    handleTelegramMessage: handleTelegramMessageFn,
  }));
  const mod = require("../telegramApproval");
  return {
    ...mod,
    __sendTelegramMessageMock: sendTelegramMessageMock,
    __answerCallbackQueryMock: answerCallbackQueryMock,
    __editTelegramMessageTextMock: editTelegramMessageTextMock,
    __handleTelegramMessageMock: handleTelegramMessageFn,
  };
}

function fakeRes() {
  const res = { statusCode: null, body: null };
  res.status = jest.fn((code) => { res.statusCode = code; return res; });
  res.send = jest.fn((body) => { res.body = body; return res; });
  return res;
}

describe("buildApprovalMessage / parseCallbackData (sof funksiyalar)", () => {
  test("buildApprovalMessage - matn va inline tugmalarni to'g'ri tuzadi", () => {
    const { _testables } = loadModule(buildMockDb());
    const { text, inlineKeyboard } = _testables.buildApprovalMessage({
      segment: "vip", segmentCount: 5, title: "Sarlavha", message: "Xabar matni", reasoning: "Sabab", dateId: "2026-08-23",
    });
    expect(text).toContain("Sarlavha");
    expect(text).toContain("Xabar matni");
    expect(text).toContain("Sabab");
    expect(inlineKeyboard).toEqual([[
      { text: "✅ Tasdiqlash va yuborish", callback_data: "a:vip:2026-08-23" },
      { text: "❌ Bekor qilish", callback_data: "x:vip:2026-08-23" },
    ]]);
  });

  test("parseCallbackData - to'g'ri formatni ajratadi", () => {
    const { _testables } = loadModule(buildMockDb());
    expect(_testables.parseCallbackData("a:vip:2026-08-23")).toEqual({
      approve: true, segment: "vip", dateId: "2026-08-23", actionId: "crm_vip_2026-08-23",
    });
    expect(_testables.parseCallbackData("x:churn:2026-08-23")).toEqual({
      approve: false, segment: "churn", dateId: "2026-08-23", actionId: "crm_churn_2026-08-23",
    });
  });

  test("parseCallbackData - noto'g'ri formatda null qaytaradi", () => {
    const { _testables } = loadModule(buildMockDb());
    expect(_testables.parseCallbackData("noto'g'ri")).toBeNull();
    expect(_testables.parseCallbackData("a:noma'lum-segment:2026-08-23")).toBeNull();
    expect(_testables.parseCallbackData(null)).toBeNull();
  });
});

describe("processSellerApprovalDigest", () => {
  test("aiCeoEnabled=false bo'lsa - HECH NARSA qilmaydi (Gemini chaqirilmaydi)", async () => {
    const craftCrmCampaignMock = jest.fn();
    const { _testables } = loadModule(buildMockDb(), { craftCrmCampaignMock });
    await _testables.processSellerApprovalDigest({ id: "s1", data: () => ({ aiCeoEnabled: false }) });
    expect(craftCrmCampaignMock).not.toHaveBeenCalled();
  });

  test("aiCeoEnabled=true, lekin aiCeoTelegramApprovalEnabled YOQILMAGAN bo'lsa - ishlamaydi (opt-in)", async () => {
    const craftCrmCampaignMock = jest.fn();
    const { _testables } = loadModule(buildMockDb(), { craftCrmCampaignMock });
    await _testables.processSellerApprovalDigest({ id: "s1", data: () => ({ aiCeoEnabled: true }) });
    expect(craftCrmCampaignMock).not.toHaveBeenCalled();
  });

  test("ikkalasi ham yoqilgan, VIP segmentda mijoz bo'lsa - kampaniya yaratadi, pending action yozadi va Telegram'ga yuboradi", async () => {
    const craftCrmCampaignMock = jest.fn().mockResolvedValue({ title: "Sarlavha", message: "Xabar", reasoning: "Sabab" });
    const collectAttentionSegmentClientIdsMock = jest.fn(() => ({ vipClientIds: ["c1", "c2"], churnClientIds: [] }));
    const db = buildMockDb();
    const { _testables, __sendTelegramMessageMock } = loadModule(db, { craftCrmCampaignMock, collectAttentionSegmentClientIdsMock });
    await _testables.processSellerApprovalDigest({ id: "s1", data: () => ({ aiCeoEnabled: true, aiCeoTelegramApprovalEnabled: true, storeName: "Zelo" }) });

    expect(craftCrmCampaignMock).toHaveBeenCalledWith("vip", 2, "Zelo", null);
    expect(db.__setCalls.length).toBe(1);
    expect(db.__setCalls[0].data.status).toBe("pending");
    expect(db.__setCalls[0].data.targetClientIds).toEqual(["c1", "c2"]);
    expect(__sendTelegramMessageMock).toHaveBeenCalledWith(
      expect.any(String), "s1", expect.stringContaining("Sarlavha"), expect.objectContaining({ inlineKeyboard: expect.any(Array) })
    );
  });

  test("VIP ham, uxlab qolgan ham bo'sh bo'lsa - Gemini UMUMAN chaqirilmaydi", async () => {
    const craftCrmCampaignMock = jest.fn();
    const collectAttentionSegmentClientIdsMock = jest.fn(() => ({ vipClientIds: [], churnClientIds: [] }));
    const { _testables } = loadModule(buildMockDb(), { craftCrmCampaignMock, collectAttentionSegmentClientIdsMock });
    await _testables.processSellerApprovalDigest({ id: "s1", data: () => ({ aiCeoEnabled: true, aiCeoTelegramApprovalEnabled: true }) });
    expect(craftCrmCampaignMock).not.toHaveBeenCalled();
  });
});

describe("executeCrmCampaignSend", () => {
  test("faqat MUVAFFAQIYATLI yetkazilgan mijozlarni hisoblaydi", async () => {
    const db = buildMockDb();
    const { _testables, __sendTelegramMessageMock } = loadModule(db);
    __sendTelegramMessageMock
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, description: "chat not found" });

    const result = await _testables.executeCrmCampaignSend({
      sellerId: "s1", targetClientIds: ["c1", "c2"], title: "Sarlavha", message: "Xabar",
    });
    expect(result).toEqual({ sent: 1, total: 2 });
  });

  test("sotuvchida shaxsiy bot ULANGAN bo'lsa, xabar BIRINCHI NAVBATDA o'sha bot orqali yuboriladi (v39.6)", async () => {
    const db = buildMockDb({ customerBotTokens: { s1: "sellers-own-bot-token" } });
    const { _testables, __sendTelegramMessageMock } = loadModule(db);
    __sendTelegramMessageMock.mockResolvedValue({ ok: true });

    const result = await _testables.executeCrmCampaignSend({
      sellerId: "s1", targetClientIds: ["c1"], title: "Sarlavha", message: "Xabar",
    });

    expect(result).toEqual({ sent: 1, total: 1 });
    expect(__sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    expect(__sendTelegramMessageMock.mock.calls[0][0]).toBe("sellers-own-bot-token");
  });

  test("shaxsiy bot orqali yuborish muvaffaqiyatsiz bo'lsa, platforma botiga ZAXIRA sifatida o'tiladi (mijoz hisoblanadi)", async () => {
    const db = buildMockDb({ customerBotTokens: { s1: "sellers-own-bot-token" } });
    const { _testables, __sendTelegramMessageMock } = loadModule(db);
    __sendTelegramMessageMock
      .mockResolvedValueOnce({ ok: false, description: "chat not found" }) // shaxsiy bot
      .mockResolvedValueOnce({ ok: true }); // platforma boti - zaxira

    const result = await _testables.executeCrmCampaignSend({
      sellerId: "s1", targetClientIds: ["c1"], title: "Sarlavha", message: "Xabar",
    });

    expect(result).toEqual({ sent: 1, total: 1 });
    expect(__sendTelegramMessageMock).toHaveBeenCalledTimes(2);
    expect(__sendTelegramMessageMock.mock.calls[0][0]).toBe("sellers-own-bot-token");
    expect(__sendTelegramMessageMock.mock.calls[1][0]).toBe("mock-bot-token");
  });
});

describe("telegramCallbackWebhook", () => {
  test("noto'g'ri (yoki yo'q) maxfiy token bilan 401 qaytaradi", async () => {
    const { telegramCallbackWebhook } = loadModule(buildMockDb());
    const req = { get: () => "noto'g'ri-token", body: {} };
    const res = fakeRes();
    await telegramCallbackWebhook(req, res);
    expect(res.statusCode).toBe(401);
  });

  test("callback_query HAM, message HAM bo'lmagan yangilanishni e'tiborsiz qoldirib, 200 qaytaradi", async () => {
    const { telegramCallbackWebhook } = loadModule(buildMockDb());
    const req = { get: () => "mock-webhook-secret", body: { some_other_update: {} } };
    const res = fakeRes();
    await telegramCallbackWebhook(req, res);
    expect(res.statusCode).toBe(200);
  });

  // YANGI: `message` turidagi yangilanish endi e'tiborsiz QOLDIRILMAYDI -
  // `telegramBotMenu.js`ga (bot "menyu" tugmalari/rasm yig'ish oqimi)
  // DELEGATSIYA qilinadi.
  test("`message` turidagi yangilanishni `telegramBotMenu`ga delegatsiya qiladi va 200 qaytaradi", async () => {
    const handleTelegramMessageMock = jest.fn(async () => undefined);
    const { telegramCallbackWebhook, __handleTelegramMessageMock } = loadModule(buildMockDb(), { handleTelegramMessageMock });
    const message = { text: "salom", from: { id: 555 }, chat: { id: 555 } };
    const req = { get: () => "mock-webhook-secret", body: { message } };
    const res = fakeRes();
    await telegramCallbackWebhook(req, res);
    expect(res.statusCode).toBe(200);
    expect(__handleTelegramMessageMock).toHaveBeenCalledWith("mock-bot-token", message);
  });

  test("`telegramBotMenu` xato tashlasa ham, webhook HAMON 200 qaytaradi (Telegram qayta urinmasligi uchun)", async () => {
    const handleTelegramMessageMock = jest.fn(async () => { throw new Error("kutilmagan xato"); });
    const { telegramCallbackWebhook } = loadModule(buildMockDb(), { handleTelegramMessageMock });
    const req = { get: () => "mock-webhook-secret", body: { message: { text: "salom", from: { id: 555 }, chat: { id: 555 } } } };
    const res = fakeRes();
    await telegramCallbackWebhook(req, res);
    expect(res.statusCode).toBe(200);
  });

  test("mavjud bo'lmagan (yoki eskirgan) pending action uchun mos javob beradi", async () => {
    const db = buildMockDb({ pendingAction: null });
    const { telegramCallbackWebhook, __answerCallbackQueryMock } = loadModule(db);
    const req = {
      get: () => "mock-webhook-secret",
      body: { callback_query: { id: "cbq-1", from: { id: 555 }, message: { chat: { id: 555 }, message_id: 10 }, data: "a:vip:2026-08-23" } },
    };
    const res = fakeRes();
    await telegramCallbackWebhook(req, res);
    expect(res.statusCode).toBe(200);
    expect(__answerCallbackQueryMock).toHaveBeenCalledWith(expect.any(String), "cbq-1", expect.stringContaining("amal qilmaydi"));
  });

  test("TASDIQLASH ('a:') - kampaniyani yuboradi, holatni 'executed'ga o'zgartiradi", async () => {
    const db = buildMockDb({
      pendingAction: { status: "pending", title: "Sarlavha", message: "Xabar", targetClientIds: ["c1", "c2"] },
    });
    const { telegramCallbackWebhook, __sendTelegramMessageMock, __answerCallbackQueryMock } = loadModule(db);
    const req = {
      get: () => "mock-webhook-secret",
      body: { callback_query: { id: "cbq-1", from: { id: 555 }, message: { chat: { id: 555 }, message_id: 10 }, data: "a:vip:2026-08-23" } },
    };
    const res = fakeRes();
    await telegramCallbackWebhook(req, res);

    expect(res.statusCode).toBe(200);
    expect(__sendTelegramMessageMock).toHaveBeenCalledTimes(2); // c1 va c2ga
    expect(db.__updateCalls[0].data.status).toBe("executed");
    expect(__answerCallbackQueryMock).toHaveBeenCalledWith(expect.any(String), "cbq-1", expect.stringContaining("✅"));
  });

  test("BEKOR QILISH ('x:') - HECH NARSA yubormaydi, holatni 'rejected'ga o'zgartiradi", async () => {
    const db = buildMockDb({
      pendingAction: { status: "pending", title: "Sarlavha", message: "Xabar", targetClientIds: ["c1"] },
    });
    const { telegramCallbackWebhook, __sendTelegramMessageMock, __answerCallbackQueryMock } = loadModule(db);
    const req = {
      get: () => "mock-webhook-secret",
      body: { callback_query: { id: "cbq-1", from: { id: 555 }, message: { chat: { id: 555 }, message_id: 10 }, data: "x:vip:2026-08-23" } },
    };
    const res = fakeRes();
    await telegramCallbackWebhook(req, res);

    expect(res.statusCode).toBe(200);
    expect(__sendTelegramMessageMock).not.toHaveBeenCalled();
    expect(db.__updateCalls[0].data.status).toBe("rejected");
    expect(__answerCallbackQueryMock).toHaveBeenCalledWith(expect.any(String), "cbq-1", expect.stringContaining("❌"));
  });

  test("allaqachon bajarilgan ('executed') action uchun QAYTA yubormaydi", async () => {
    const db = buildMockDb({
      pendingAction: { status: "executed", title: "Sarlavha", message: "Xabar", targetClientIds: ["c1"] },
    });
    const { telegramCallbackWebhook, __sendTelegramMessageMock } = loadModule(db);
    const req = {
      get: () => "mock-webhook-secret",
      body: { callback_query: { id: "cbq-1", from: { id: 555 }, message: { chat: { id: 555 }, message_id: 10 }, data: "a:vip:2026-08-23" } },
    };
    const res = fakeRes();
    await telegramCallbackWebhook(req, res);
    expect(__sendTelegramMessageMock).not.toHaveBeenCalled();
  });
});

describe("handleRespondToAiCeoPendingAction (Mini App'dan tasdiqlash - 'Universal Inbox' MVP)", () => {
  test("tizimga kirmagan foydalanuvchini rad etadi", async () => {
    const { _testables } = loadModule(buildMockDb());
    await expect(_testables.handleRespondToAiCeoPendingAction({ auth: null, data: {} })).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  test("actionId yoki approve noto'g'ri bo'lsa - invalid-argument", async () => {
    const { _testables } = loadModule(buildMockDb());
    await expect(
      _testables.handleRespondToAiCeoPendingAction({ auth: { uid: "555" }, data: { approve: true } })
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(
      _testables.handleRespondToAiCeoPendingAction({ auth: { uid: "555" }, data: { actionId: "crm_vip_2026-08-23" } })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("mavjud bo'lmagan/eskirgan action uchun failed-precondition", async () => {
    const { _testables } = loadModule(buildMockDb({ pendingAction: null }));
    await expect(
      _testables.handleRespondToAiCeoPendingAction({
        auth: { uid: "555" }, data: { actionId: "crm_vip_2026-08-23", approve: true },
      })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("TASDIQLASH - webhook bilan BIR XIL `resolvePendingAction` orqali kampaniyani yuboradi", async () => {
    const db = buildMockDb({ pendingAction: { status: "pending", title: "Sarlavha", message: "Xabar", targetClientIds: ["c1", "c2"] } });
    const { _testables } = loadModule(db);
    const result = await _testables.handleRespondToAiCeoPendingAction({
      auth: { uid: "555" }, data: { actionId: "crm_vip_2026-08-23", approve: true },
    });
    expect(result).toEqual({ executed: true, sent: 2, total: 2 });
    expect(db.__updateCalls[0].data.status).toBe("executed");
  });

  test("BEKOR QILISH - hech narsa yubormasdan 'rejected'ga o'zgartiradi", async () => {
    const db = buildMockDb({ pendingAction: { status: "pending", title: "Sarlavha", message: "Xabar", targetClientIds: ["c1"] } });
    const { _testables, __sendTelegramMessageMock } = loadModule(db);
    const result = await _testables.handleRespondToAiCeoPendingAction({
      auth: { uid: "555" }, data: { actionId: "crm_vip_2026-08-23", approve: false },
    });
    expect(result).toEqual({ executed: false, sent: undefined, total: undefined });
    expect(db.__updateCalls[0].data.status).toBe("rejected");
    expect(__sendTelegramMessageMock).not.toHaveBeenCalled();
  });
});

describe("handleRegisterTelegramWebhook (bir martalik, admin-gated sozlash)", () => {
  function buildAdminMockDb({ isAdmin }) {
    return {
      collection: (name) => {
        if (name === "admins") {
          return { doc: () => ({ get: async () => ({ exists: isAdmin }) }) };
        }
        return { doc: () => ({ get: async () => ({ exists: false }) }) };
      },
    };
  }

  test("tizimga kirmagan foydalanuvchini rad etadi", async () => {
    const { _testables } = loadModule(buildAdminMockDb({ isAdmin: false }));
    await expect(_testables.handleRegisterTelegramWebhook({ auth: null })).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("admin BO'LMAGAN foydalanuvchini rad etadi", async () => {
    const { _testables } = loadModule(buildAdminMockDb({ isAdmin: false }));
    await expect(
      _testables.handleRegisterTelegramWebhook({ auth: { uid: "not-admin-1" } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("admin uchun Telegram setWebhook'ni TO'G'RI parametrlar bilan chaqiradi", async () => {
    const originalFetch = global.fetch;
    const originalProjectId = process.env.GCLOUD_PROJECT;
    process.env.GCLOUD_PROJECT = "zeloshop-test";
    global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ ok: true }) });

    try {
      const { _testables } = loadModule(buildAdminMockDb({ isAdmin: true }));
      const result = await _testables.handleRegisterTelegramWebhook({ auth: { uid: "admin-1" } });

      expect(result.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/setWebhook"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("telegramCallbackWebhook"),
        })
      );
      // YANGI: "message" endi ham so'ralishi SHART - aks holda bot
      // "menyu" tugmalari/rasm yig'ish oqimi UMUMAN ishlamaydi.
      const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(requestBody.allowed_updates).toEqual(["callback_query", "message"]);
    } finally {
      global.fetch = originalFetch;
      process.env.GCLOUD_PROJECT = originalProjectId;
    }
  });
});
