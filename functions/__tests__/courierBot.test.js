/**
 * `courierBot.js` uchun testlar — kuryer botining `/start` orqali
 * taklif kodini redemption qilish oqimi, menyu yo'naltirish, va
 * webhook ro'yxatga olish (`registerCourierBotWebhook`).
 *
 * Haqiqiy Firestore/Telegram API'ga ULANMAYDI — barchasi taqlid
 * qilingan (mock). `applyCourierOrderAction`ning O'ZI `couriers.test.js`
 * da alohida sinaladi — bu yerda faqat MOCK qilinadi (kod
 * DUPLIKATSIYASIga yo'l qo'ymaslik uchun).
 *
 * `firebase-functions/v2/https`ni MOCK qilamiz - `onRequest(config,
 * handler)` shunchaki ICHKI handler'ning O'ZINI qaytaradi, shunda
 * quyidagi "Senty integratsiyasi" testlari `exports.courierBotWebhook`ni
 * TO'G'RIDAN-TO'G'RI (haqiqiy Cloud Function o'rovchisiz) chaqira oladi -
 * `telegramApproval.test.js`dagi bir xil naqsh.
 */
jest.mock("firebase-functions/v2/https", () => ({
  onRequest: (config, handler) => handler,
  onCall: (config, handler) => handler,
  HttpsError: class MockHttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  },
}));

// XAVFSIZLIK/MONITORING (2026-09 audit, "o'rtacha darajadagi
// kamchiliklar"): `courierBotWebhook` endi `./lib/sentry`ni ishlatadi -
// quyida `Sentry.captureException` chaqirilganini tekshiruvchi testlar
// uchun aynan shu mock kerak.
jest.mock("../lib/sentry", () => ({
  withSentry: (fn) => fn,
  initSentry: jest.fn(),
  Sentry: { captureException: jest.fn() },
  SENTRY_DSN: { value: () => null },
}));

function buildMockDb({ couriers = {}, courierInvites = {}, sellers = {}, admins = {} } = {}) {
  const courierSets = {};
  const inviteUpdates = {};
  return {
    collection: (name) => {
      if (name === "couriers") {
        return {
          doc: (id) => ({
            get: async () => (couriers[id] ? { exists: true, data: () => couriers[id] } : { exists: false }),
            set: async (data) => { courierSets[id] = data; },
          }),
        };
      }
      if (name === "sellers") {
        return {
          doc: (sellerId) => ({
            get: async () => (sellers[sellerId] ? { exists: true, data: () => sellers[sellerId] } : { exists: false }),
            collection: (sub) => {
              if (sub !== "courierInvites") throw new Error(`Kutilmagan quyi kolleksiya: ${sub}`);
              return {
                doc: (token) => ({
                  get: async () => (courierInvites[token] ? { exists: true, data: () => courierInvites[token] } : { exists: false }),
                  update: async (data) => { inviteUpdates[token] = data; },
                }),
              };
            },
          }),
        };
      }
      if (name === "admins") {
        return { doc: (id) => ({ get: async () => ({ exists: Boolean(admins[id]) }) }) };
      }
      throw new Error(`Kutilmagan kolleksiya: ${name}`);
    },
    __courierSets: courierSets,
    __inviteUpdates: inviteUpdates,
  };
}

function loadCourierBotModule({
  db, sendTelegramMessageMock, answerCallbackQueryMock, editTelegramMessageTextMock,
  applyCourierOrderActionMock, handleCourierLiveLocationUpdateMock, fetchMock,
} = {}) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: { firestore: { FieldValue: { serverTimestamp: () => "MOCK_TS" } } },
    db,
    BOT_TOKEN: { value: () => "platform-token" },
    COURIER_BOT_TOKEN: { value: () => "courier-token" },
    COURIER_TELEGRAM_WEBHOOK_SECRET: { value: () => "webhook-secret" },
  }));
  jest.doMock("../lib/helpers", () => ({
    sendTelegramMessage: sendTelegramMessageMock || jest.fn().mockResolvedValue({ ok: true }),
    answerCallbackQuery: answerCallbackQueryMock || jest.fn().mockResolvedValue(undefined),
    editTelegramMessageText: editTelegramMessageTextMock || jest.fn().mockResolvedValue(undefined),
    buildSellerAppLink: (path) => `https://commerce-zelo.web.app${path}`,
  }));
  jest.doMock("../couriers", () => ({
    applyCourierOrderAction: applyCourierOrderActionMock || jest.fn().mockResolvedValue({ success: true }),
    buildCourierActionKeyboard: (orderId) => [[{ text: "x", callback_data: `cor:picked_up:${orderId}` }]],
    COURIER_ACTION_LABELS: { picked_up: "🚴 Yo'lga chiqdi", delivered: "✅ Yetkazildi", failed: "❌ Yetkazib bo'lmadi" },
    // YANGI (v39.5): Telegramning O'ZINING jonli joylashuv relesi -
    // standart holatda muvaffaqiyatli (hech narsa qaytarmaydi) deb
    // taqlid qilinadi.
    handleCourierLiveLocationUpdate: handleCourierLiveLocationUpdateMock || jest.fn().mockResolvedValue(undefined),
  }));
  if (fetchMock) global.fetch = fetchMock;
  return require("../courierBot");
}

describe("SOF funksiyalar", () => {
  const bot = loadCourierBotModule({ db: buildMockDb({}) });

  test("parseInvitePayload — sellerId prefiksini to'g'ri ajratadi", () => {
    expect(bot._testables.parseInvitePayload("seller1_abcdef")).toEqual({ sellerId: "seller1", token: "seller1_abcdef" });
  });
  test("parseInvitePayload — '_' bo'lmasa null", () => {
    expect(bot._testables.parseInvitePayload("notoken")).toBeNull();
  });
  test("parseInvitePayload — bo'sh/noto'g'ri qiymatlar uchun null", () => {
    expect(bot._testables.parseInvitePayload(null)).toBeNull();
    expect(bot._testables.parseInvitePayload("")).toBeNull();
    expect(bot._testables.parseInvitePayload("_onlyunderscoreatstart")).toBeNull();
  });

  test("parseCourierCallbackData — to'g'ri ajratadi", () => {
    expect(bot._testables.parseCourierCallbackData("cor:delivered:abc123")).toEqual({ action: "delivered", orderId: "abc123" });
  });
  test("parseCourierCallbackData — noto'g'ri prefiks bo'lsa null", () => {
    expect(bot._testables.parseCourierCallbackData("a:vip:2026-08-23")).toBeNull();
  });
  test("parseCourierCallbackData — bo'sh/to'liqsiz bo'lsa null", () => {
    expect(bot._testables.parseCourierCallbackData(null)).toBeNull();
    expect(bot._testables.parseCourierCallbackData("cor:delivered")).toBeNull();
  });

  test("buildCourierMenuKeyboard — bitta tugmali reply keyboard", () => {
    const keyboard = bot._testables.buildCourierMenuKeyboard();
    expect(keyboard.keyboard[0][0].text).toBe(bot._testables.MENU_MY_DELIVERIES_TEXT);
    expect(keyboard.resize_keyboard).toBe(true);
  });
});

describe("handleCourierLiveLocationMessage (v39.5) — Telegramning O'ZINING jonli joylashuv relesi", () => {
  test("to'g'ri koordinatalar bilan — couriers.js'ning handleCourierLiveLocationUpdate'iga yo'naltiradi", async () => {
    const handleCourierLiveLocationUpdateMock = jest.fn().mockResolvedValue(undefined);
    const bot = loadCourierBotModule({ db: buildMockDb({}), handleCourierLiveLocationUpdateMock });
    await bot._testables.handleCourierLiveLocationMessage(123, { latitude: 41.3, longitude: 69.2, live_period: 900 });
    expect(handleCourierLiveLocationUpdateMock).toHaveBeenCalledWith({ courierId: "123", lat: 41.3, lng: 69.2 });
  });

  test("location yo'q yoki noto'g'ri turdagi koordinatalar bo'lsa — chaqirilmaydi", async () => {
    const handleCourierLiveLocationUpdateMock = jest.fn();
    const bot = loadCourierBotModule({ db: buildMockDb({}), handleCourierLiveLocationUpdateMock });
    await bot._testables.handleCourierLiveLocationMessage(123, null);
    await bot._testables.handleCourierLiveLocationMessage(123, { latitude: "41.3", longitude: 69.2 });
    await bot._testables.handleCourierLiveLocationMessage(null, { latitude: 41.3, longitude: 69.2 });
    expect(handleCourierLiveLocationUpdateMock).not.toHaveBeenCalled();
  });
});

describe("handleStartCommand", () => {
  test("allaqachon ulangan kuryer uchun — menyuni qayta ko'rsatadi", async () => {
    const db = buildMockDb({ couriers: { c1: { name: "Aziz", sellerId: "s1", status: "active" } } });
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const bot = loadCourierBotModule({ db, sendTelegramMessageMock });
    await bot._testables.handleStartCommand("courier-token", "c1", 111, null);
    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    expect(sendTelegramMessageMock.mock.calls[0][2]).toContain("Aziz");
  });

  test("payload yo'q, ulanmagan bo'lsa — taklif havolasi kerakligini aytadi", async () => {
    const db = buildMockDb({});
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const bot = loadCourierBotModule({ db, sendTelegramMessageMock });
    await bot._testables.handleStartCommand("courier-token", "c1", 111, null);
    expect(sendTelegramMessageMock.mock.calls[0][2]).toContain("TAKLIF HAVOLASI");
  });

  test("noto'g'ri formatdagi payload ('_' yo'q) — xuddi shu xabar", async () => {
    const db = buildMockDb({});
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const bot = loadCourierBotModule({ db, sendTelegramMessageMock });
    await bot._testables.handleStartCommand("courier-token", "c1", 111, "notoken");
    expect(sendTelegramMessageMock.mock.calls[0][2]).toContain("TAKLIF HAVOLASI");
  });

  test("taklif topilmasa yoki allaqachon ishlatilgan bo'lsa — yaroqsiz xabari", async () => {
    const db = buildMockDb({
      courierInvites: { s1_abc: { used: true, name: "Vali" } },
      sellers: { s1: { storeName: "Do'kon" } },
    });
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const bot = loadCourierBotModule({ db, sendTelegramMessageMock });
    await bot._testables.handleStartCommand("courier-token", "c1", 111, "s1_abc");
    expect(sendTelegramMessageMock.mock.calls[0][2]).toContain("yaroqsiz");
  });

  test("muvaffaqiyatli redemptsiya — kuryer hujjati yaratiladi, taklif ISHLATILGAN deb belgilanadi", async () => {
    const db = buildMockDb({
      courierInvites: { s1_abc: { used: false, name: "Vali", phone: "+998" } },
      sellers: { s1: { storeName: "Go'zallik Do'koni" } },
    });
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const bot = loadCourierBotModule({ db, sendTelegramMessageMock });
    await bot._testables.handleStartCommand("courier-token", "c1", 111, "s1_abc");

    expect(db.__courierSets.c1.sellerId).toBe("s1");
    expect(db.__courierSets.c1.name).toBe("Vali");
    expect(db.__courierSets.c1.status).toBe("active");
    expect(db.__inviteUpdates.s1_abc.used).toBe(true);
    expect(db.__inviteUpdates.s1_abc.courierId).toBe("c1");
    expect(sendTelegramMessageMock.mock.calls[0][2]).toContain("Vali");
    expect(sendTelegramMessageMock.mock.calls[0][2]).toContain("Go'zallik Do'koni");
  });
});

describe("handleCourierTelegramMessage — yo'naltirish", () => {
  test("'/start' matni — handleStartCommand chaqiriladi", async () => {
    const db = buildMockDb({ couriers: { 123: { name: "Aziz" } } });
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const bot = loadCourierBotModule({ db, sendTelegramMessageMock });
    await bot._testables.handleCourierTelegramMessage("courier-token", { from: { id: 123 }, chat: { id: 999 }, text: "/start" });
    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
  });

  test("menyu tugmasi bosilsa — Mini App havolasi bilan javob beradi", async () => {
    const db = buildMockDb({});
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const bot = loadCourierBotModule({ db, sendTelegramMessageMock });
    await bot._testables.handleCourierTelegramMessage("courier-token", {
      from: { id: 123 }, chat: { id: 999 }, text: bot._testables.MENU_MY_DELIVERIES_TEXT,
    });
    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    const opts = sendTelegramMessageMock.mock.calls[0][3];
    expect(opts.inlineKeyboard[0][0].web_app.url).toBe("https://commerce-zelo.web.app/courier");
  });

  test("noma'lum matn — faqat ULANGAN kuryerga menyuni eslatadi, ulanmaganga JIM qoladi", async () => {
    const dbLinked = buildMockDb({ couriers: { 123: { name: "Aziz" } } });
    const sendTelegramMessageMockLinked = jest.fn().mockResolvedValue({ ok: true });
    const botLinked = loadCourierBotModule({ db: dbLinked, sendTelegramMessageMock: sendTelegramMessageMockLinked });
    await botLinked._testables.handleCourierTelegramMessage("courier-token", { from: { id: 123 }, chat: { id: 999 }, text: "salom" });
    expect(sendTelegramMessageMockLinked).toHaveBeenCalledTimes(1);

    const dbUnlinked = buildMockDb({});
    const sendTelegramMessageMockUnlinked = jest.fn().mockResolvedValue({ ok: true });
    const botUnlinked = loadCourierBotModule({ db: dbUnlinked, sendTelegramMessageMock: sendTelegramMessageMockUnlinked });
    await botUnlinked._testables.handleCourierTelegramMessage("courier-token", { from: { id: 456 }, chat: { id: 999 }, text: "salom" });
    expect(sendTelegramMessageMockUnlinked).not.toHaveBeenCalled();
  });
});

describe("handleRegisterCourierBotWebhook", () => {
  test("auth yo'q bo'lsa unauthenticated", async () => {
    const bot = loadCourierBotModule({ db: buildMockDb({}) });
    await expect(bot._testables.handleRegisterCourierBotWebhook({})).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("admin bo'lmasa permission-denied", async () => {
    const db = buildMockDb({ admins: {} });
    const bot = loadCourierBotModule({ db });
    await expect(bot._testables.handleRegisterCourierBotWebhook({ auth: { uid: "u1" } })).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("admin bo'lsa — Telegram setWebhook chaqiriladi va webhookUrl qaytadi", async () => {
    const db = buildMockDb({ admins: { u1: true } });
    process.env.GCLOUD_PROJECT = "commerce-zelo";
    const fetchMock = jest.fn().mockResolvedValue({ json: async () => ({ ok: true }) });
    const bot = loadCourierBotModule({ db, fetchMock });
    const result = await bot._testables.handleRegisterCourierBotWebhook({ auth: { uid: "u1" } });
    expect(result.ok).toBe(true);
    expect(result.webhookUrl).toContain("courierBotWebhook");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("YANGI (v39.5): allowed_updates ro'yxatiga 'edited_message' QO'SHILGAN — bo'lmasa, Telegram jonli joylashuv yangilanishlarini UMUMAN yubormaydi", async () => {
    const db = buildMockDb({ admins: { u1: true } });
    process.env.GCLOUD_PROJECT = "commerce-zelo";
    const fetchMock = jest.fn().mockResolvedValue({ json: async () => ({ ok: true }) });
    const bot = loadCourierBotModule({ db, fetchMock });
    await bot._testables.handleRegisterCourierBotWebhook({ auth: { uid: "u1" } });
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.allowed_updates).toEqual(["callback_query", "message", "edited_message"]);
  });
});

function fakeRes() {
  const res = { statusCode: null, body: null };
  res.status = jest.fn((code) => { res.statusCode = code; return res; });
  res.send = jest.fn((body) => { res.body = body; return res; });
  return res;
}

describe("courierBotWebhook — Sentry integratsiyasi (2026-09 audit, 'o'rtacha darajadagi kamchiliklar')", () => {
  test("noto'g'ri maxfiy token bilan 401 qaytaradi (Sentry chaqirilmaydi)", async () => {
    const bot = loadCourierBotModule({ db: buildMockDb({}) });
    const { Sentry } = require("../lib/sentry");
    const req = { get: () => "noto'g'ri-token", body: {} };
    const res = fakeRes();
    await bot.courierBotWebhook(req, res);
    expect(res.statusCode).toBe(401);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  test("xabarni qayta ishlashda kutilmagan xato — Sentry.captureException chaqiriladi, javob baribir 200", async () => {
    const handleErr = new Error("kutilmagan DB xatosi");
    // `db.collection("couriers").doc(id).get()` xato tashlashi uchun -
    // `handleCourierTelegramMessage` shu orqali chaqiriladi ("salom"
    // matni, ulangan bo'lmagan yo'lda emas, balki to'g'ridan-to'g'ri
    // ICHKI DB xatosini simulyatsiya qilish uchun eng oddiy usul -
    // `db` o'rniga xato tashlaydigan versiya beramiz).
    const throwingDb = {
      collection: () => ({ doc: () => ({ get: async () => { throw handleErr; } }) }),
    };
    const bot = loadCourierBotModule({ db: throwingDb });
    const { Sentry } = require("../lib/sentry");
    const req = {
      get: () => "webhook-secret",
      body: { message: { from: { id: 123 }, chat: { id: 999 }, text: "salom" } },
    };
    const res = fakeRes();
    await bot.courierBotWebhook(req, res);
    expect(res.statusCode).toBe(200);
    expect(Sentry.captureException).toHaveBeenCalledWith(handleErr);
  });

  test("callback_query'da kutilmagan xato — Sentry.captureException chaqiriladi, javob baribir 200", async () => {
    const actionErr = new Error("amalni bajarib bo'lmadi");
    const applyCourierOrderActionMock = jest.fn().mockRejectedValue(actionErr);
    const bot = loadCourierBotModule({ db: buildMockDb({}), applyCourierOrderActionMock });
    const { Sentry } = require("../lib/sentry");
    const req = {
      get: () => "webhook-secret",
      body: { callback_query: { id: "cbq-1", from: { id: 123 }, message: { chat: { id: 999 }, message_id: 5 }, data: "cor:picked_up:order1" } },
    };
    const res = fakeRes();
    await bot.courierBotWebhook(req, res);
    expect(res.statusCode).toBe(200);
    expect(Sentry.captureException).toHaveBeenCalledWith(actionErr);
  });
});
