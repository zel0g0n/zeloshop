/**
 * `carts.js`ning `sendAbandonedCartReminders`i uchun testlar.
 *
 * MUHIM: bu `onSchedule` orqali eksport qilingan - shuning uchun ICHKI
 * mantiqni sinash uchun, `onSchedule`ning ikkinchi argumentini (asosiy
 * handler funksiyani) TO'G'RIDAN-TO'G'RI CHAQIRAMIZ.
 *
 * FOYDALANUVCHI SO'ROVI BILAN QO'SHILDI (AI-shaxsiylashtirilgan savat
 * eslatmasi): asosiy e'tibor - AI YOQILGANDA/YOQILMAGANDA to'g'ri
 * xabar yuborilishi, XATO bo'lganda statik shablonga QAYTISHI, va
 * ENG MUHIMI - narx/jami summa/promokod HAR DOIM, AI ishlatilsa ham,
 * DETERMINISTIK qolishi (AI matniga aralashtirilmasligi).
 */

function buildMockDb({ cartDocs = [], sellerData = {}, customerBotToken = null } = {}) {
  const updateCalls = [];
  const couponSetCalls = [];
  // 100-seller qattiqlashtirish (`lib/batchProcess.js`): bir xil
  // sotuvchining bir nechta savati bitta ishga tushirishda qayta
  // ishlansa, sotuvchi hujjati FAQAT BIR MARTA o'qilishi kerak (guruh
  // ichida keshlanadi) - shu hisoblagich shuni tasdiqlaydi.
  let sellerDocGetCalls = 0;

  return {
    collection: (name) => {
      if (name === "carts") {
        return {
          where: () => ({
            where: () => ({
              get: async () => ({
                empty: cartDocs.length === 0,
                docs: cartDocs.map((d) => ({
                  id: d.id,
                  data: () => d.data,
                  ref: { update: async (data) => updateCalls.push({ id: d.id, data }) },
                })),
              }),
            }),
          }),
        };
      }
      if (name === "sellers") {
        return {
          doc: () => ({
            get: async () => {
              sellerDocGetCalls += 1;
              return { exists: true, data: () => sellerData };
            },
            collection: (subName) => {
              if (subName === "coupons") {
                return { doc: (code) => ({ set: async (data) => couponSetCalls.push({ code, data }) }) };
              }
              // v39.6: `getSellerCustomBotToken`ning
              // "sellers/{id}/private/customerBot" o'qishi -
              // `customerBotToken` berilmasa "ulanmagan" holatini
              // taqlid qiladi.
              if (subName === "private") {
                return {
                  doc: () => ({
                    get: async () => (
                      customerBotToken
                        ? { exists: true, data: () => ({ botToken: customerBotToken }) }
                        : { exists: false }
                    ),
                  }),
                };
              }
              return { doc: () => ({ get: async () => ({ exists: false }), set: async () => {} }) };
            },
          }),
        };
      }
      return { doc: () => ({ get: async () => ({ exists: false }) }), add: async () => ({}) };
    },
    __updateCalls: updateCalls,
    __couponSetCalls: couponSetCalls,
    get __sellerDocGetCalls() { return sellerDocGetCalls; },
  };
}

// MUHIM: `carts.js` endi `./aiCeo`ni (AI CEO shaxsiylashtirilgan savat
// eslatmasi uchun) talab qiladi - `aiCeo.js` o'zi `./lib/sentry`ni
// yuklaydi, bu esa HAQIQIY `@sentry/*` paketini talab qiladi va test
// muhitida ishlamaydi - shuning uchun SOXTALASHTIRISH kerak (hoisted
// `jest.mock`, `aiCeo.test.js`/`engagementReminders.test.js`dagi BILAN
// BIR XIL naqsh).
jest.mock("../lib/sentry", () => ({
  withSentry: (fn) => fn,
  SENTRY_DSN: { value: () => null },
  Sentry: { captureException: jest.fn() },
  initSentry: jest.fn(),
}));

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: (config, handler) => handler,
}));

function loadModule(db, { generateContentMock } = {}) {
  jest.resetModules();
  const sendTelegramMessageMock = jest.fn(async () => undefined);
  jest.doMock("../lib/admin", () => ({
    admin: {
      firestore: {
        FieldValue: { serverTimestamp: () => "MOCK_TS", increment: (n) => ({ __increment: n }) },
        Timestamp: { fromMillis: (ms) => ({ __ms: ms }) },
      },
    },
    db,
    BOT_TOKEN: { value: () => "fallback-token" },
    GEMINI_API_KEY: { value: () => "mock-gemini-key" },
  }));
  jest.doMock("../lib/helpers", () => ({ sendTelegramMessage: sendTelegramMessageMock }));
  jest.doMock("@google/genai", () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({ models: { generateContent: generateContentMock || jest.fn() } })),
  }));
  const mod = require("../carts");
  return { ...mod, __sendTelegramMessageMock: sendTelegramMessageMock };
}

const activeCart = (overrides = {}) => ({
  id: "cart-1",
  data: {
    sellerId: "s1",
    clientId: "c1",
    status: "active",
    items: [{ name: "Krem", quantity: 2, price: 50_000 }],
    ...overrides,
  },
});

describe("sendAbandonedCartReminders", () => {
  test("eskirgan faol savat bo'lmasa, hech narsa qilmaydi", async () => {
    const db = buildMockDb({ cartDocs: [] });
    const { sendAbandonedCartReminders } = loadModule(db);
    await expect(sendAbandonedCartReminders()).resolves.not.toThrow();
  });

  test("aiCeoEnabled=false bo'lsa (standart holat) - AI CHAQIRILMAYDI, oddiy shablon yuboriladi, jami summa to'g'ri", async () => {
    const generateContentMock = jest.fn();
    const db = buildMockDb({ cartDocs: [activeCart()], sellerData: {} });
    const { sendAbandonedCartReminders, __sendTelegramMessageMock } = loadModule(db, { generateContentMock });
    await sendAbandonedCartReminders();
    expect(generateContentMock).not.toHaveBeenCalled();
    expect(__sendTelegramMessageMock).toHaveBeenCalledWith(
      expect.any(String), "c1", expect.stringContaining("Savatingizda mahsulotlar kutmoqda!")
    );
    const sentText = __sendTelegramMessageMock.mock.calls[0][2];
    expect(sentText).toContain("100,000 so'm"); // 2 x 50 000
    expect(db.__updateCalls[0].data.status).toBe("reminded");
  });

  test("aiCeoEnabled=true bo'lsa - AI matnini KIRISH sifatida ishlatadi, lekin jami summa BARIBIR deterministik qo'shiladi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({ text: "AI CEO yozgan savat eslatmasi." });
    const db = buildMockDb({ cartDocs: [activeCart()], sellerData: { aiCeoEnabled: true, storeName: "Zelo" } });
    const { sendAbandonedCartReminders, __sendTelegramMessageMock } = loadModule(db, { generateContentMock });
    await sendAbandonedCartReminders();
    expect(generateContentMock).toHaveBeenCalledTimes(1);
    const sentText = __sendTelegramMessageMock.mock.calls[0][2];
    expect(sentText).toContain("AI CEO yozgan savat eslatmasi.");
    expect(sentText).toContain("100,000 so'm"); // AI narxni O'YLAB TOPMAYDI - kod qo'shadi
  });

  test("AI xato bersa - JIM QOLADI va oddiy shablon bilan baribir yuboradi", async () => {
    const generateContentMock = jest.fn().mockRejectedValue(new Error("Gemini vaqtincha ishlamayapti"));
    const db = buildMockDb({ cartDocs: [activeCart()], sellerData: { aiCeoEnabled: true } });
    const { sendAbandonedCartReminders, __sendTelegramMessageMock } = loadModule(db, { generateContentMock });
    await expect(sendAbandonedCartReminders()).resolves.not.toThrow();
    expect(__sendTelegramMessageMock).toHaveBeenCalledWith(
      expect.any(String), "c1", expect.stringContaining("Savatingizda mahsulotlar kutmoqda!")
    );
  });

  test("qaytarish chegirmasi yoqilgan bo'lsa, promokod HAR DOIM koddan (AI matnidan emas) qo'shiladi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({ text: "AI CEO yozgan savat eslatmasi." });
    const db = buildMockDb({
      cartDocs: [activeCart()],
      sellerData: { aiCeoEnabled: true, cartReminderDiscountPercent: 15 },
    });
    const { sendAbandonedCartReminders, __sendTelegramMessageMock } = loadModule(db, { generateContentMock });
    await sendAbandonedCartReminders();
    const sentText = __sendTelegramMessageMock.mock.calls[0][2];
    expect(sentText).toContain("15% chegirma");
    expect(sentText).toContain("Promokod:");
    expect(db.__couponSetCalls.length).toBe(1);
  });

  test("sotuvchida shaxsiy bot ULANGAN bo'lsa, eslatma BIRINCHI NAVBATDA o'sha bot orqali yuboriladi (v39.6)", async () => {
    const db = buildMockDb({ cartDocs: [activeCart()], sellerData: {}, customerBotToken: "sellers-own-bot-token" });
    const { sendAbandonedCartReminders, __sendTelegramMessageMock } = loadModule(db);
    await sendAbandonedCartReminders();
    expect(__sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    expect(__sendTelegramMessageMock.mock.calls[0][0]).toBe("sellers-own-bot-token");
  });

  test("sotuvchida shaxsiy bot bo'lmasa, platforma (zaxira) tokeni ishlatiladi", async () => {
    const db = buildMockDb({ cartDocs: [activeCart()], sellerData: {} });
    const { sendAbandonedCartReminders, __sendTelegramMessageMock } = loadModule(db);
    await sendAbandonedCartReminders();
    expect(__sendTelegramMessageMock.mock.calls[0][0]).toBe("fallback-token");
  });

  // 100-seller qattiqlashtirish (`lib/batchProcess.js`): bir xil
  // sotuvchining BIR NECHTA savati bo'lsa - guruhlash refaktoringi
  // ikkalasini ham to'g'ri ishlashini, LEKIN sotuvchi hujjatini FAQAT
  // BIR MARTA o'qishini tasdiqlaydi.
  test("bir xil sotuvchining IKKITA savati bo'lsa - HAR IKKALASI ham ishlanadi, sotuvchi hujjati FAQAT BIR MARTA o'qiladi", async () => {
    const db = buildMockDb({
      cartDocs: [
        { id: "cart-1", data: { sellerId: "s1", clientId: "c1", status: "active", items: [{ name: "Krem", quantity: 2, price: 50_000 }] } },
        { id: "cart-2", data: { sellerId: "s1", clientId: "c2", status: "active", items: [{ name: "Sovun", quantity: 1, price: 10_000 }] } },
      ],
      sellerData: {},
    });
    const { sendAbandonedCartReminders, __sendTelegramMessageMock } = loadModule(db);
    await sendAbandonedCartReminders();
    expect(db.__sellerDocGetCalls).toBe(1);
    expect(__sendTelegramMessageMock).toHaveBeenCalledTimes(2);
    expect(db.__updateCalls.filter((c) => c.data.status === "reminded")).toHaveLength(2);
  });
});
