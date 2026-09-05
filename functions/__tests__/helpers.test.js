/**
 * `lib/helpers.js`dagi `parseStartParam` uchun testlar - ayniqsa
 * YANGI qo'shilgan "chuqur havola" (_p) formatini tekshirish.
 */
const {
  parseStartParam, encodeDeepLinkPath, buildDeepLink, buildSellerAppLink,
  sendTelegramLiveLocation, editTelegramLiveLocation, stopTelegramLiveLocation,
  sendTelegramMessage,
} = require("../lib/helpers");

describe("parseStartParam", () => {
  test("oddiy sellerId (hech qanday qo'shimchasiz) to'g'ri o'qiladi", () => {
    const result = parseStartParam("seller123");
    expect(result).toMatchObject({ sellerId: "seller123", referrerId: null, deepLinkPath: null });
  });

  test("referal formatini (_r) to'g'ri ajratadi", () => {
    const result = parseStartParam("seller123_r99999");
    expect(result).toMatchObject({ sellerId: "seller123", referrerId: "99999", deepLinkPath: null });
  });

  test("chuqur havola formatini (_p) to'g'ri ajratadi va yo'lni deshifrlaydi", () => {
    // "/category/Skincare" ning base64url kodlanishi
    const encoded = Buffer.from("/category/Skincare", "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
    const result = parseStartParam(`seller123_p${encoded}`);
    expect(result.sellerId).toBe("seller123");
    expect(result.referrerId).toBeNull();
    expect(result.deepLinkPath).toBe("/category/Skincare");
  });

  test("noto'g'ri/buzilgan chuqur havola kodini xato TASHLAMASDAN, null deb qaytaradi", () => {
    const result = parseStartParam("seller123_p!!!notbase64!!!");
    expect(result.sellerId).toBe("seller123");
    expect(result.deepLinkPath).toBeNull();
  });

  test("'/' bilan boshlanmaydigan deshifrlangan yo'lni RAD ETADI (xavfsizlik)", () => {
    // Tashqi manzilga (masalan "evil.com") yo'naltirishga urinishning oldini olish.
    const encoded = Buffer.from("evil.com/phishing", "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
    const result = parseStartParam(`seller123_p${encoded}`);
    expect(result.deepLinkPath).toBeNull();
  });

  // XAVFSIZLIK (P2 fix, 2026-09 audit): "//evil.com" HAM "/" bilan
  // boshlanadi, lekin bu PROTOKOLGA NISBIY URL — brauzer buni
  // "https://evil.com" deb talqin qiladi. Eskicha `startsWith("/")`
  // tekshiruvi buni NOTO'G'RI o'tkazib yuborardi, `RootEntry.jsx`dagi
  // `<Navigate to={deepLinkPath} />`ga yetib borib xavfli
  // yo'naltirish/`SecurityError`ga sabab bo'lardi.
  test("protokolga nisbiy URL'ni (\"//evil.com\") RAD ETADI", () => {
    const encoded = Buffer.from("//evil.com/phishing", "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
    const result = parseStartParam(`seller123_p${encoded}`);
    expect(result.deepLinkPath).toBeNull();
  });

  test("teskari qiya chiziq bilan boshlangan yo'lni (\"/\\\\evil.com\") RAD ETADI", () => {
    const encoded = Buffer.from("/\\evil.com/phishing", "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
    const result = parseStartParam(`seller123_p${encoded}`);
    expect(result.deepLinkPath).toBeNull();
  });

  test("HAQIQIY ICHKI yo'lni (bitta \"/\" bilan) hamon TO'G'RI qabul qiladi", () => {
    const encoded = Buffer.from("/category/Skincare", "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
    const result = parseStartParam(`seller123_p${encoded}`);
    expect(result.deepLinkPath).toBe("/category/Skincare");
  });

  test("bo'sh yoki null qiymat uchun xato bermaydi", () => {
    expect(parseStartParam(null)).toMatchObject({ sellerId: null, referrerId: null, deepLinkPath: null });
    expect(parseStartParam("")).toMatchObject({ sellerId: null, referrerId: null, deepLinkPath: null });
  });

  test("sotuvchini taklif qilish formatini (_i) to'g'ri ajratadi - sellerId ATAYLAB null bo'ladi", () => {
    const result = parseStartParam("seller123_i");
    expect(result).toMatchObject({ sellerId: null, referrerId: null, deepLinkPath: null, sellerInviterId: "seller123" });
  });
});

/**
 * `encodeDeepLinkPath`/`buildDeepLink` - `src/utils/deepLink.js` va
 * `src/utils/shareLink.js`ning SERVER TOMONI (masalan avtomatik kanal
 * posti, `productAutomation.js`, mahsulotga to'g'ridan-to'g'ri havola
 * yasashi uchun ishlatadi). MUHIM: bu ikkalasi `parseStartParam`
 * (yuqoridagi) bilan TO'LIQ round-trip mos kelishi SHART - aks holda
 * backend yasagan havola frontend'da to'g'ri ochilmaydi.
 */
describe("encodeDeepLinkPath + buildDeepLink (server tomoni)", () => {
  test("yasalgan havola `parseStartParam` orqali ORIGINAL yo'lga to'g'ri qaytariladi (round-trip)", () => {
    const link = buildDeepLink("seller123", "/product/abc-XYZ_1");
    expect(link).toMatch(/^https:\/\/t\.me\/zeloshop_bot\/shop\?startapp=seller123_p/);
    const startParam = link.split("startapp=")[1];
    const parsed = parseStartParam(startParam);
    expect(parsed).toEqual({ sellerId: "seller123", referrerId: null, deepLinkPath: "/product/abc-XYZ_1", sellerInviterId: null });
  });

  test("sellerId yoki path berilmasa, null qaytaradi", () => {
    expect(buildDeepLink(null, "/product/1")).toBeNull();
    expect(buildDeepLink("seller123", null)).toBeNull();
  });

  test("bo'sh yo'l uchun bo'sh qator qaytaradi, xato tashlamaydi", () => {
    expect(encodeDeepLinkPath("")).toBe("");
    expect(encodeDeepLinkPath(null)).toBe("");
  });
});

/**
 * `buildSellerAppLink` - `buildDeepLink`dan MUHIM FARQI: `start_param`
 * QO'SHMAYDI, shuning uchun `SessionContext.jsx` buni ODATIY
 * autentifikatsiya (sotuvchi O'Z profilida) sifatida ko'radi - "mijoz
 * rejimi"ga MAJBURLAMAYDI. `telegramBotMenu.js`dagi `web_app` tugmasi
 * (masalan "Buyurtmalarni ko'rish") uchun ishlatiladi.
 */
describe("buildSellerAppLink", () => {
  test("berilgan yo'lni to'g'ridan-to'g'ri, start_paramSIZ ilova manziliga qo'shadi", () => {
    expect(buildSellerAppLink("/seller/orders")).toBe("https://commerce-zelo.web.app/seller/orders");
  });

  test("yo'l berilmasa, ildiz manzilni qaytaradi", () => {
    expect(buildSellerAppLink()).toBe("https://commerce-zelo.web.app");
    expect(buildSellerAppLink(null)).toBe("https://commerce-zelo.web.app");
  });
});

/**
 * YANGI (v39.5): Telegramning O'ZINING jonli joylashuv (Live Location)
 * yordamchilari — `sendTelegramLiveLocation`/`editTelegramLiveLocation`/
 * `stopTelegramLiveLocation`. Haqiqiy tarmoqqa ULANMAYDI - `global.fetch`
 * taqlid qilinadi (`courierBot.test.js`dagi BIR XIL naqsh).
 */
describe("sendTelegramLiveLocation / editTelegramLiveLocation / stopTelegramLiveLocation (v39.5)", () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  test("sendTelegramLiveLocation — muvaffaqiyatli bo'lsa message_id qaytaradi, so'rov to'g'ri shakllantiriladi", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ json: async () => ({ ok: true, result: { message_id: 555 } }) });
    global.fetch = fetchMock;

    const messageId = await sendTelegramLiveLocation("tok", "chat1", 41.3, 69.2, 21600);

    expect(messageId).toBe(555);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.telegram.org/bottok/sendLocation");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ chat_id: "chat1", latitude: 41.3, longitude: 69.2, live_period: 21600 });
  });

  test("sendTelegramLiveLocation — Telegram 'ok:false' qaytarsa, null qaytaradi (xato TASHLAMAYDI)", async () => {
    global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ ok: false, description: "xato" }) });
    expect(await sendTelegramLiveLocation("tok", "chat1", 1, 2, 60)).toBeNull();
  });

  test("sendTelegramLiveLocation — tarmoq xatosi bo'lsa, null qaytaradi (xato TASHLAMAYDI)", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("tarmoq xatosi"));
    expect(await sendTelegramLiveLocation("tok", "chat1", 1, 2, 60)).toBeNull();
  });

  test("editTelegramLiveLocation — to'g'ri metod/parametrlar bilan chaqiradi", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ json: async () => ({ ok: true }) });
    global.fetch = fetchMock;
    await editTelegramLiveLocation("tok", "chat1", 555, 41.31, 69.21);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.telegram.org/bottok/editMessageLiveLocation");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ chat_id: "chat1", message_id: 555, latitude: 41.31, longitude: 69.21 });
  });

  test("editTelegramLiveLocation — tarmoq xatosi bo'lsa ham, xato TASHLAMAYDI", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("tarmoq xatosi"));
    await expect(editTelegramLiveLocation("tok", "chat1", 555, 1, 2)).resolves.toBeUndefined();
  });

  test("stopTelegramLiveLocation — to'g'ri metod/parametrlar bilan chaqiradi", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ json: async () => ({ ok: true }) });
    global.fetch = fetchMock;
    await stopTelegramLiveLocation("tok", "chat1", 555);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.telegram.org/bottok/stopMessageLiveLocation");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ chat_id: "chat1", message_id: 555 });
  });

  test("stopTelegramLiveLocation — tarmoq xatosi bo'lsa ham, xato TASHLAMAYDI", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("tarmoq xatosi"));
    await expect(stopTelegramLiveLocation("tok", "chat1", 555)).resolves.toBeUndefined();
  });
});

/**
 * 4-BOT EKOTIZIM AUDITI (P1) — `sendTelegramMessage`ning TRANZIT
 * (429/5xx) xatoliklar uchun qayta urinish (retry + backoff) mantig'i.
 * Doimiy xatoliklar (400 kabi) uchun qayta URINILMASLIGI, va cheksiz
 * qayta urinish YO'QLIGI (aniq maksimal chegara) alohida tekshiriladi.
 */
describe("sendTelegramMessage — tranzit xatoliklar uchun qayta urinish (retry)", () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  test("birinchi urinish muvaffaqiyatli bo'lsa, FAQAT bitta so'rov yuboriladi (qayta urinish yo'q)", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ status: 200, json: async () => ({ ok: true }) });
    global.fetch = fetchMock;

    const result = await sendTelegramMessage("tok", "chat1", "Salom");

    expect(result).toEqual({ chatId: "chat1", ok: true, description: undefined });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("429 (Too Many Requests) — \"Retry-After\"ga muvofiq kutib, qayta urinadi va muvaffaqiyatli tugaydi", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ status: 429, json: async () => ({ ok: false, description: "Too Many Requests", parameters: { retry_after: 0 } }) })
      .mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true }) });
    global.fetch = fetchMock;

    const result = await sendTelegramMessage("tok", "chat1", "Salom");

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("5xx (server xatosi) — qayta urinadi va oxir-oqibat muvaffaqiyatli tugaydi", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ status: 502, json: async () => ({ ok: false, description: "Bad Gateway" }) })
      .mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true }) });
    global.fetch = fetchMock;

    const result = await sendTelegramMessage("tok", "chat1", "Salom");

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("DOIMIY xatolik (400 — masalan \"chat not found\") uchun QAYTA URINILMAYDI", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ status: 400, json: async () => ({ ok: false, description: "Bad Request: chat not found" }) });
    global.fetch = fetchMock;

    const result = await sendTelegramMessage("tok", "chat1", "Salom");

    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1); // qayta urinish YO'Q — doimiy xatolik
  });

  test("tranzit xatolik DOIMIY davom etsa ham, CHEKSIZ qayta urinilmaydi — aniq maksimal urinishdan keyin muvaffaqiyatsiz natija qaytariladi", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ status: 500, json: async () => ({ ok: false, description: "Internal Server Error" }) });
    global.fetch = fetchMock;

    const result = await sendTelegramMessage("tok", "chat1", "Salom");

    expect(result.ok).toBe(false);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(3); // jami ko'pi bilan 3 marta (1 + 2 qayta urinish)
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  }, 10000);

  test("Markdown format xatosi (\"parse\") — oddiy matn bilan bitta marta qayta uriniladi, TRANZIT hisoblanmaydi", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ status: 400, json: async () => ({ ok: false, description: "can't parse entities" }) })
      .mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true }) });
    global.fetch = fetchMock;

    const result = await sendTelegramMessage("tok", "chat1", "Salom *buzuq");

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Ikkinchi urinishda `parse_mode` YO'QLIGINI tekshiramiz.
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(secondBody.parse_mode).toBeUndefined();
  });
});
