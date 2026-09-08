/**
 * `customBotWebhook.js` uchun testlar — sotuvchining shaxsiy boti
 * `/start` orqali ochilganda, haqiqiy Mini App tugmasi bilan javob
 * berishi (2026-09, foydalanuvchi so'roviga ko'ra qo'shildi: "Sotib
 * olish" tugmasi ZeloShop umumiy boti emas, sellerning O'Z boti orqali
 * ochilishi kerak).
 *
 * `staffBot.test.js`/`courierBot.test.js` bilan BIR XIL naqsh: asosiy
 * mantiq (`handleCustomBotStartMessage`) Express `req`/`res`dan MUSTAQIL
 * ravishda, TO'G'RIDAN-TO'G'RI sinaladi — webhook konvertidagi (`handleCustomBotWebhook`)
 * `req.get`/`res.status` mock qilinmaydi.
 */

function buildMockDb({ sellers = {}, customBots = {} } = {}) {
  return {
    collection: (name) => {
      if (name !== "sellers") throw new Error(`Kutilmagan kolleksiya: ${name}`);
      return {
        doc: (sellerId) => ({
          get: async () => (sellers[sellerId] ? { exists: true, data: () => sellers[sellerId] } : { exists: false }),
          collection: (sub) => {
            if (sub !== "private") throw new Error(`Kutilmagan quyi kolleksiya: ${sub}`);
            return {
              doc: () => ({
                get: async () => (customBots[sellerId] ? { exists: true, data: () => customBots[sellerId] } : { exists: false }),
              }),
            };
          },
        }),
      };
    },
  };
}

function loadModule({ db, fetchMock, isDuplicateUpdateMock } = {}) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    db: db || buildMockDb(),
    CUSTOM_BOT_WEBHOOK_SECRET: { value: () => "mock-secret" },
  }));
  jest.doMock("../lib/sentry", () => ({
    SENTRY_DSN: { value: () => "mock-dsn" },
    initSentry: jest.fn(),
    Sentry: { captureException: jest.fn() },
  }));
  // `isDuplicateUpdate`ning O'ZI `webhookDedup.test.js`da alohida
  // sinaladi - bu yerda doim "dublikat EMAS" deb taqlid qilinadi,
  // shu orqali bu fayl FAQAT o'ziga tegishli mantiqni sinaydi.
  jest.doMock("../lib/webhookDedup", () => ({
    isDuplicateUpdate: isDuplicateUpdateMock || jest.fn().mockResolvedValue(false),
  }));
  global.fetch = fetchMock || jest.fn().mockResolvedValue({ json: async () => ({ ok: true }) });
  return require("../customBotWebhook");
}

describe("handleCustomBotStartMessage", () => {
  test("bot ulanmagan bo'lsa (customerBot hujjati yo'q) - hech narsa yubormaydi", async () => {
    const fetchMock = jest.fn();
    const { _testables: t } = loadModule({ db: buildMockDb({ sellers: { s1: { storeName: "Do'kon" } } }), fetchMock });
    await t.handleCustomBotStartMessage("s1", { text: "/start", chat: { id: 999 } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("chat yo'q yoki matn '/start' bilan boshlanmasa - hech narsa yubormaydi", async () => {
    const fetchMock = jest.fn();
    const { _testables: t } = loadModule({ fetchMock });
    await t.handleCustomBotStartMessage("s1", { text: "salom", chat: { id: 999 } });
    await t.handleCustomBotStartMessage("s1", { text: "/start" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("payloadsiz oddiy '/start' - do'kon BOSH sahifasiga ochiladigan umumiy xush kelibsiz xabari yuboradi", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ json: async () => ({ ok: true }) });
    const db = buildMockDb({
      sellers: { s1: { storeName: "Zelo Cosmetics" } },
      customBots: { s1: { botToken: "bot-tok-1" } },
    });
    const { _testables: t } = loadModule({ db, fetchMock });

    await t.handleCustomBotStartMessage("s1", { text: "/start", chat: { id: 555 } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bot" + "bot-tok-1" + "/sendMessage");
    const body = JSON.parse(opts.body);
    expect(body.chat_id).toBe(555);
    expect(body.text).toContain("Zelo Cosmetics");
    const button = body.reply_markup.inline_keyboard[0][0];
    expect(button.web_app.url).toBe("https://commerce-zelo.web.app/?ownerSellerId=s1");
  });

  test("mahsulotga chuqur havola payloadi bilan '/start' - deepLinkPath'li Mini App tugmasini yuboradi", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ json: async () => ({ ok: true }) });
    const db = buildMockDb({
      sellers: { s1: { storeName: "Zelo Cosmetics" } },
      customBots: { s1: { botToken: "bot-tok-1" } },
    });
    const { _testables: t } = loadModule({ db, fetchMock });

    // "/product/abc1" ning base64url kodi (`lib/helpers.js`dagi
    // `encodeDeepLinkPath` bilan BIR XIL kodlash).
    const encoded = Buffer.from("/product/abc1", "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    await t.handleCustomBotStartMessage("s1", { text: `/start p${encoded}`, chat: { id: 555 } });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const button = body.reply_markup.inline_keyboard[0][0];
    expect(button.web_app.url).toBe(`https://commerce-zelo.web.app/?ownerSellerId=s1&deepLinkPath=${encodeURIComponent("/product/abc1")}`);
  });

  test("buzilgan/noto'g'ri payload - xato tashlamaydi, oddiy (do'kon boshiga) xabar yuboradi", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ json: async () => ({ ok: true }) });
    const db = buildMockDb({ sellers: { s1: {} }, customBots: { s1: { botToken: "bot-tok-1" } } });
    const { _testables: t } = loadModule({ db, fetchMock });

    await t.handleCustomBotStartMessage("s1", { text: "/start p!!!notbase64!!!", chat: { id: 555 } });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const button = body.reply_markup.inline_keyboard[0][0];
    expect(button.web_app.url).toBe("https://commerce-zelo.web.app/?ownerSellerId=s1");
  });
});

describe("handleCustomBotWebhook", () => {
  function makeReqRes({ path = "/s1", secret = "mock-secret", body = {} } = {}) {
    const res = { statusCode: null, sentBody: null, status(code) { this.statusCode = code; return this; }, send(body) { this.sentBody = body; return this; } };
    const req = { path, body, get: (header) => (header === "X-Telegram-Bot-Api-Secret-Token" ? secret : undefined) };
    return { req, res };
  }

  test("noto'g'ri maxfiy token bilan so'rov 401 bilan rad etiladi", async () => {
    const { _testables: t } = loadModule();
    const { req, res } = makeReqRes({ secret: "wrong" });
    await t.handleCustomBotWebhook(req, res);
    expect(res.statusCode).toBe(401);
  });

  test("sellerId'siz yo'l (noto'g'ri ro'yxatga olingan webhook) - baribir 200 qaytaradi", async () => {
    const { _testables: t } = loadModule();
    const { req, res } = makeReqRes({ path: "/" });
    await t.handleCustomBotWebhook(req, res);
    expect(res.statusCode).toBe(200);
  });

  test("to'g'ri so'rov - 200 qaytaradi va Telegram'ga xabar yuboradi", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ json: async () => ({ ok: true }) });
    const db = buildMockDb({ sellers: { s1: { storeName: "Do'kon" } }, customBots: { s1: { botToken: "tok" } } });
    const { _testables: t } = loadModule({ db, fetchMock });
    const { req, res } = makeReqRes({ path: "/s1", body: { update_id: 1, message: { text: "/start", chat: { id: 42 } } } });

    await t.handleCustomBotWebhook(req, res);

    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("ichki xatolik bo'lsa ham 200 qaytaradi (Telegram cheksiz qayta urinishining oldini olish uchun)", async () => {
    const db = {
      collection: () => { throw new Error("Firestore vaqtincha ishlamayapti"); },
    };
    const { _testables: t } = loadModule({ db });
    const { req, res } = makeReqRes({ path: "/s1", body: { update_id: 1, message: { text: "/start", chat: { id: 42 } } } });

    await t.handleCustomBotWebhook(req, res);

    expect(res.statusCode).toBe(200);
  });
});
