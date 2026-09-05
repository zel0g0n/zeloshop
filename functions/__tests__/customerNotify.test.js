/**
 * `lib/customerNotify.js` uchun testlar — v39.6 arxitekturasining
 * YURAGI: mijozga (xaridorga) yuboriladigan HAR QANDAY xabar shu
 * modul orqali o'tadi. Ikkita funksiya sinaladi:
 *   - `getSellerCustomBotToken` — sotuvchining ulangan shaxsiy bot
 *     tokenini (agar mavjud bo'lsa) `sellers/{id}/private/customerBot`
 *     dan o'qiydi, xato bo'lsa (yoki topilmasa) `null` qaytaradi.
 *   - `sendCustomerNotification` — AVVAL shaxsiy bot (agar berilgan
 *     bo'lsa) orqali yuborishga urinadi, muvaffaqiyatsiz bo'lsa (yoki
 *     umuman berilmagan bo'lsa) platforma botiga ZAXIRA sifatida
 *     o'tadi.
 */

function buildMockDb({ customerBotDoc } = {}) {
  const getCalls = [];
  return {
    collection: (name) => {
      if (name !== "sellers") throw new Error(`Kutilmagan kolleksiya: ${name}`);
      return {
        doc: (sellerId) => ({
          collection: (sub) => {
            if (sub !== "private") throw new Error(`Kutilmagan quyi kolleksiya: ${sub}`);
            return {
              doc: (docId) => ({
                get: async () => {
                  getCalls.push({ sellerId, docId });
                  if (typeof customerBotDoc === "function") return customerBotDoc(sellerId);
                  return customerBotDoc || { exists: false };
                },
              }),
            };
          },
        }),
      };
    },
    __getCalls: getCalls,
  };
}

function loadModule({ db, sendTelegramMessageMock, botTokenValue = "platform-shared-token" } = {}) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    db,
    BOT_TOKEN: { value: () => botTokenValue },
  }));
  jest.doMock("../lib/helpers", () => ({
    sendTelegramMessage: sendTelegramMessageMock || jest.fn(async () => ({ ok: true })),
  }));
  return require("../lib/customerNotify");
}

describe("getSellerCustomBotToken", () => {
  test("sellerId berilmasa — Firestore'ga so'rov YUBORMASDAN null qaytaradi", async () => {
    const db = buildMockDb({});
    const { getSellerCustomBotToken } = loadModule({ db });
    expect(await getSellerCustomBotToken(null)).toBeNull();
    expect(await getSellerCustomBotToken(undefined)).toBeNull();
    expect(db.__getCalls.length).toBe(0);
  });

  test("hujjat mavjud bo'lsa — botToken'ni qaytaradi", async () => {
    const db = buildMockDb({ customerBotDoc: { exists: true, data: () => ({ botToken: "sellers-own-bot-token" }) } });
    const { getSellerCustomBotToken } = loadModule({ db });
    expect(await getSellerCustomBotToken("seller-1")).toBe("sellers-own-bot-token");
    expect(db.__getCalls[0]).toEqual({ sellerId: "seller-1", docId: "customerBot" });
  });

  test("hujjat mavjud EMAS bo'lsa (sotuvchi shaxsiy bot ulamagan) — null qaytaradi", async () => {
    const db = buildMockDb({ customerBotDoc: { exists: false } });
    const { getSellerCustomBotToken } = loadModule({ db });
    expect(await getSellerCustomBotToken("seller-1")).toBeNull();
  });

  test("hujjat mavjud, lekin botToken maydoni yo'q/bo'sh bo'lsa — null qaytaradi", async () => {
    const db = buildMockDb({ customerBotDoc: { exists: true, data: () => ({}) } });
    const { getSellerCustomBotToken } = loadModule({ db });
    expect(await getSellerCustomBotToken("seller-1")).toBeNull();
  });

  test("Firestore o'qishda xato yuz bersa — XATO TASHLAMAYDI, null qaytaradi", async () => {
    const db = {
      collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ({ get: async () => { throw new Error("Firestore vaqtincha ishlamayapti"); } }) }) }) }),
    };
    const { getSellerCustomBotToken } = loadModule({ db });
    await expect(getSellerCustomBotToken("seller-1")).resolves.toBeNull();
  });
});

describe("sendCustomerNotification", () => {
  test("customBotToken berilgan VA muvaffaqiyatli bo'lsa — FAQAT shaxsiy bot orqali yuboriladi, platforma botiga murojaat qilinMAYDI", async () => {
    const sendTelegramMessageMock = jest.fn(async () => ({ ok: true }));
    const { sendCustomerNotification } = loadModule({ sendTelegramMessageMock });
    const result = await sendCustomerNotification("sellers-own-bot-token", "client-1", "Salom");
    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    expect(sendTelegramMessageMock).toHaveBeenCalledWith("sellers-own-bot-token", "client-1", "Salom");
    expect(result).toEqual({ ok: true });
  });

  test("customBotToken berilmagan (null) bo'lsa — to'g'ridan-to'g'ri platforma boti ishlatiladi", async () => {
    const sendTelegramMessageMock = jest.fn(async () => ({ ok: true }));
    const { sendCustomerNotification } = loadModule({ sendTelegramMessageMock, botTokenValue: "platform-token" });
    await sendCustomerNotification(null, "client-1", "Salom");
    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    expect(sendTelegramMessageMock).toHaveBeenCalledWith("platform-token", "client-1", "Salom");
  });

  test("shaxsiy bot orqali yuborish muvaffaqiyatsiz bo'lsa (ok:false) — platforma botiga ZAXIRA sifatida o'tiladi", async () => {
    const sendTelegramMessageMock = jest.fn()
      .mockResolvedValueOnce({ ok: false, description: "chat not found" })
      .mockResolvedValueOnce({ ok: true });
    const { sendCustomerNotification } = loadModule({ sendTelegramMessageMock, botTokenValue: "platform-token" });
    const result = await sendCustomerNotification("sellers-own-bot-token", "client-1", "Salom");
    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(2);
    expect(sendTelegramMessageMock).toHaveBeenNthCalledWith(1, "sellers-own-bot-token", "client-1", "Salom");
    expect(sendTelegramMessageMock).toHaveBeenNthCalledWith(2, "platform-token", "client-1", "Salom");
    expect(result).toEqual({ ok: true });
  });

  test("shaxsiy bot orqali yuborishda XATO tashlansa (masalan tarmoq xatosi) — xato CHAQIRUVCHIGA tarqaladi (bu yerda ushlanmaydi)", async () => {
    const sendTelegramMessageMock = jest.fn()
      .mockRejectedValueOnce(new Error("tarmoq xatosi"))
      .mockResolvedValueOnce({ ok: true });
    const { sendCustomerNotification } = loadModule({ sendTelegramMessageMock });
    // MUHIM: hozirgi amalga oshirishda `sendCustomerNotification`
    // o'zi custom bot chaqiruvini `try/catch` bilan O'RAMAYDI - u
    // FAQAT `result.ok`ni tekshiradi. Agar chaqiruv XATO tashlasa,
    // bu xato yuqoriga (chaqiruvchiga) tarqaladi - chaqiruvchilar
    // (masalan `carts.js`) buni O'ZLARI `try/catch` bilan o'raydi.
    // Shuning uchun bu test XATO KUTADI, "jim zaxira" emas.
    await expect(sendCustomerNotification("sellers-own-bot-token", "client-1", "Salom")).rejects.toThrow("tarmoq xatosi");
  });

  test("options berilsa — TO'RTINCHI argument sifatida uzatiladi", async () => {
    const sendTelegramMessageMock = jest.fn(async () => ({ ok: true }));
    const { sendCustomerNotification } = loadModule({ sendTelegramMessageMock });
    const options = { buttonText: "Ko'rish", buttonUrl: "https://example.com" };
    await sendCustomerNotification("sellers-own-bot-token", "client-1", "Salom", options);
    expect(sendTelegramMessageMock).toHaveBeenCalledWith("sellers-own-bot-token", "client-1", "Salom", options);
  });

  test("options berilmasa — sendTelegramMessage ANIQ 3 argument bilan chaqiriladi (4-chi spuriy {} EMAS)", async () => {
    const sendTelegramMessageMock = jest.fn(async () => ({ ok: true }));
    const { sendCustomerNotification } = loadModule({ sendTelegramMessageMock });
    await sendCustomerNotification(null, "client-1", "Salom");
    expect(sendTelegramMessageMock.mock.calls[0]).toHaveLength(3);
  });
});
