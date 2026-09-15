/**
 * `carts.js`ning `sendAbandonedCartReminders`i uchun testlar.
 *
 * MUHIM: bu `onSchedule` orqali eksport qilingan - shuning uchun ICHKI
 * mantiqni sinash uchun, `onSchedule`ning ikkinchi argumentini (asosiy
 * handler funksiyani) TO'G'RIDAN-TO'G'RI CHAQIRAMIZ.
 *
 * 2026-09: 4-BOSQICHLI ketma-ketlikka kengaytirildi (avval bitta,
 * 2 soatdan keyingi xabar edi). Diqqat markazida ikki narsa: (1)
 * `computeDueCartStage` sof funksiyasi - vaqt/anchor mantig'ining
 * TO'G'RILIGI (bosqichlar TO'G'RI tartibda, mijoz savatni qayta
 * o'zgartirsa YANGI epizod sifatida qaraladi); (2) to'liq handler -
 * har bir bosqichning o'z matni, faqat 1-bosqichda AI, faqat
 * 3-bosqichda chegirma, va narx/jami summa/promokod HAR DOIM
 * deterministik qolishi (AI matniga aralashtirilmasligi).
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

const MIN = 60 * 1000;
const msAgo = (minutes) => {
  const ms = Date.now() - minutes * MIN;
  return { toMillis: () => ms, __ms: ms };
};

// `overrides.ago` (daqiqa) - savat oxirgi marta qachon o'zgartirilgan.
// `overrides.reminderStage`/`reminderStageAnchorAgo` - oldingi
// bosqich holatini simulyatsiya qilish uchun (reaktivatsiya testlari).
const activeCart = ({ ago = 50, reminderStage = 0, reminderStageAnchorAgo = null, ...overrides } = {}) => {
  const updatedAt = msAgo(ago);
  return {
    id: "cart-1",
    data: {
      sellerId: "s1",
      clientId: "c1",
      status: "active",
      items: [{ name: "Krem", quantity: 2, price: 50_000 }],
      updatedAt,
      reminderStage,
      // Anchor berilmasa - default holda JORIY `updatedAt`ga TENG
      // qilib qo'yamiz (ya'ni "bu bosqich shu epizodga tegishli"),
      // faqat reaktivatsiya testlarida ATAYLAB boshqacha beriladi.
      reminderStageAnchorAt: reminderStageAnchorAgo === null ? updatedAt : msAgo(reminderStageAnchorAgo),
      ...overrides,
    },
  };
};

describe("computeDueCartStage (sof funksiya)", () => {
  let computeDueCartStage;
  beforeAll(() => {
    const db = buildMockDb({});
    ({ computeDueCartStage } = loadModule(db)._testables);
  });

  test("45 daqiqadan kam bo'lsa - hech qanday bosqich yetilmagan (0)", () => {
    expect(computeDueCartStage({ updatedAtMs: Date.now() - 30 * MIN, reminderStage: 0, reminderStageAnchorMs: null }, Date.now())).toBe(0);
  });

  test("45 daqiqadan ko'p, hali hech narsa yuborilmagan - 1-bosqich", () => {
    expect(computeDueCartStage({ updatedAtMs: Date.now() - 50 * MIN, reminderStage: 0, reminderStageAnchorMs: null }, Date.now())).toBe(1);
  });

  test("5 soatdan ko'p, 1-bosqich allaqachon yuborilgan (bir xil epizod) - 2-bosqich", () => {
    const updatedAtMs = Date.now() - 6 * 60 * MIN;
    expect(computeDueCartStage({ updatedAtMs, reminderStage: 1, reminderStageAnchorMs: updatedAtMs }, Date.now())).toBe(2);
  });

  test("1-bosqich ALLAQACHON yuborilgan bo'lsa, 5 soat o'tmaguncha 2-bosqich YETILMAYDI", () => {
    const updatedAtMs = Date.now() - 60 * MIN; // 1 soat - 1-bosqichdan keyin, 2-bosqichgacha hali erta
    expect(computeDueCartStage({ updatedAtMs, reminderStage: 1, reminderStageAnchorMs: updatedAtMs }, Date.now())).toBe(0);
  });

  test("24 soatdan ko'p, 2-bosqichgacha yuborilgan - 3-bosqich", () => {
    const updatedAtMs = Date.now() - 25 * 60 * MIN;
    expect(computeDueCartStage({ updatedAtMs, reminderStage: 2, reminderStageAnchorMs: updatedAtMs }, Date.now())).toBe(3);
  });

  test("60 soatdan ko'p, 3-bosqichgacha yuborilgan - 4-bosqich (yakuniy)", () => {
    const updatedAtMs = Date.now() - 61 * 60 * MIN;
    expect(computeDueCartStage({ updatedAtMs, reminderStage: 3, reminderStageAnchorMs: updatedAtMs }, Date.now())).toBe(4);
  });

  test("4-bosqich ALLAQACHON yuborilgan bo'lsa - boshqa hech narsa yuborilmaydi (0)", () => {
    const updatedAtMs = Date.now() - 200 * 60 * MIN; // juda uzoq vaqt o'tgan bo'lsa ham
    expect(computeDueCartStage({ updatedAtMs, reminderStage: 4, reminderStageAnchorMs: updatedAtMs }, Date.now())).toBe(0);
  });

  test("REAKTIVATSIYA: anchor joriy updatedAt bilan MOS KELMASA (mijoz savatni qayta o'zgartirgan) - epizod 0dan qayta boshlanadi", () => {
    const oldAnchorMs = Date.now() - 1000 * 60 * MIN; // eski epizod
    const newUpdatedAtMs = Date.now() - 50 * MIN; // YANGI faollik, 45 daqiqadan ko'p o'tgan
    // reminderStage=4 (eski epizodda tugagan) bo'lsa ham, anchor mos
    // kelmagani uchun 1-bosqich QAYTA yuboriladi.
    expect(computeDueCartStage({ updatedAtMs: newUpdatedAtMs, reminderStage: 4, reminderStageAnchorMs: oldAnchorMs }, Date.now())).toBe(1);
  });

  test("bir nechta bosqich 'o'tkazib yuborilgan' bo'lsa (masalan cron uzoq ishlamagan) - ENG YUQORI yetilgan bosqich tanlanadi, ketma-ket emas", () => {
    const updatedAtMs = Date.now() - 70 * 60 * MIN; // 70 soat - 4-bosqich ham allaqachon yetilgan
    expect(computeDueCartStage({ updatedAtMs, reminderStage: 0, reminderStageAnchorMs: null }, Date.now())).toBe(4);
  });
});

describe("sendAbandonedCartReminders", () => {
  test("eskirgan faol savat bo'lmasa, hech narsa qilmaydi", async () => {
    const db = buildMockDb({ cartDocs: [] });
    const { sendAbandonedCartReminders } = loadModule(db);
    await expect(sendAbandonedCartReminders()).resolves.not.toThrow();
  });

  test("hali hech qaysi bosqich vaqti kelmagan savatni O'TKAZIB YUBORADI (yangilanish yo'q)", async () => {
    const db = buildMockDb({ cartDocs: [activeCart({ ago: 20 })] }); // 45 daqiqadan kam
    const { sendAbandonedCartReminders } = loadModule(db);
    await sendAbandonedCartReminders();
    expect(db.__updateCalls.length).toBe(0);
  });

  test("1-BOSQICH: aiCeoEnabled=false bo'lsa - AI CHAQIRILMAYDI, oddiy shablon yuboriladi, jami summa to'g'ri, savat 'active' qoladi", async () => {
    const generateContentMock = jest.fn();
    const db = buildMockDb({ cartDocs: [activeCart({ ago: 50 })], sellerData: {} });
    const { sendAbandonedCartReminders, __sendTelegramMessageMock } = loadModule(db, { generateContentMock });
    await sendAbandonedCartReminders();
    expect(generateContentMock).not.toHaveBeenCalled();
    expect(__sendTelegramMessageMock).toHaveBeenCalledWith(
      expect.any(String), "c1", expect.stringContaining("Savatingizda mahsulotlar kutmoqda!")
    );
    const sentText = __sendTelegramMessageMock.mock.calls[0][2];
    expect(sentText).toContain("100,000 so'm"); // 2 x 50 000
    expect(db.__updateCalls[0].data.status).toBe("active"); // 1-bosqichdan keyin hali YAKUNLANMAGAN
    expect(db.__updateCalls[0].data.reminderStage).toBe(1);
  });

  test("1-BOSQICH: aiCeoEnabled=true bo'lsa - AI matnini KIRISH sifatida ishlatadi, lekin jami summa BARIBIR deterministik qo'shiladi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({ text: "AI CEO yozgan savat eslatmasi." });
    const db = buildMockDb({ cartDocs: [activeCart({ ago: 50 })], sellerData: { aiCeoEnabled: true, storeName: "Zelo" } });
    const { sendAbandonedCartReminders, __sendTelegramMessageMock } = loadModule(db, { generateContentMock });
    await sendAbandonedCartReminders();
    expect(generateContentMock).toHaveBeenCalledTimes(1);
    const sentText = __sendTelegramMessageMock.mock.calls[0][2];
    expect(sentText).toContain("AI CEO yozgan savat eslatmasi.");
    expect(sentText).toContain("100,000 so'm"); // AI narxni O'YLAB TOPMAYDI - kod qo'shadi
  });

  test("1-BOSQICH: AI xato bersa - JIM QOLADI va oddiy shablon bilan baribir yuboradi", async () => {
    const generateContentMock = jest.fn().mockRejectedValue(new Error("Gemini vaqtincha ishlamayapti"));
    const db = buildMockDb({ cartDocs: [activeCart({ ago: 50 })], sellerData: { aiCeoEnabled: true } });
    const { sendAbandonedCartReminders, __sendTelegramMessageMock } = loadModule(db, { generateContentMock });
    await expect(sendAbandonedCartReminders()).resolves.not.toThrow();
    expect(__sendTelegramMessageMock).toHaveBeenCalledWith(
      expect.any(String), "c1", expect.stringContaining("Savatingizda mahsulotlar kutmoqda!")
    );
  });

  test("1-BOSQICHDA promokod YO'Q, hatto chegirma yoqilgan bo'lsa ham (endi 3-bosqichgacha kechiktiriladi)", async () => {
    const db = buildMockDb({
      cartDocs: [activeCart({ ago: 50 })],
      sellerData: { cartReminderDiscountPercent: 15 },
    });
    const { sendAbandonedCartReminders, __sendTelegramMessageMock } = loadModule(db);
    await sendAbandonedCartReminders();
    const sentText = __sendTelegramMessageMock.mock.calls[0][2];
    expect(sentText).not.toContain("chegirma");
    expect(db.__couponSetCalls.length).toBe(0);
  });

  test("2-BOSQICH: 1-bosqichdan keyin, 5 soat o'tgach - IKKINCHI, boshqa matnli xabar, AI CHAQIRILMAYDI (aiCeoEnabled=true bo'lsa ham)", async () => {
    const generateContentMock = jest.fn();
    const db = buildMockDb({
      cartDocs: [activeCart({ ago: 6 * 60, reminderStage: 1 })], // 6 soat, 1-bosqich allaqachon yuborilgan
      sellerData: { aiCeoEnabled: true },
    });
    const { sendAbandonedCartReminders, __sendTelegramMessageMock } = loadModule(db, { generateContentMock });
    await sendAbandonedCartReminders();
    expect(generateContentMock).not.toHaveBeenCalled(); // faqat 1-bosqichda AI ishlatiladi
    const sentText = __sendTelegramMessageMock.mock.calls[0][2];
    expect(sentText).toContain("Hali xarid qilishni yakunlamadingiz");
    expect(db.__updateCalls[0].data.reminderStage).toBe(2);
    expect(db.__updateCalls[0].data.status).toBe("active");
  });

  test("3-BOSQICH: 24 soatdan keyin, chegirma yoqilgan bo'lsa - HAQIQIY promokod SHU YERDA (kod orqali, AI matnidan emas) qo'shiladi", async () => {
    const db = buildMockDb({
      cartDocs: [activeCart({ ago: 25 * 60, reminderStage: 2 })],
      sellerData: { cartReminderDiscountPercent: 15 },
    });
    const { sendAbandonedCartReminders, __sendTelegramMessageMock } = loadModule(db);
    await sendAbandonedCartReminders();
    const sentText = __sendTelegramMessageMock.mock.calls[0][2];
    expect(sentText).toContain("15% chegirma");
    expect(sentText).toContain("Promokod:");
    expect(db.__couponSetCalls.length).toBe(1);
    expect(db.__updateCalls[0].data.reminderStage).toBe(3);
  });

  test("3-BOSQICH: chegirma YOQILMAGAN bo'lsa - promokodsiz, lekin baribir alohida matnli xabar yuboriladi", async () => {
    const db = buildMockDb({
      cartDocs: [activeCart({ ago: 25 * 60, reminderStage: 2 })],
      sellerData: {},
    });
    const { sendAbandonedCartReminders, __sendTelegramMessageMock } = loadModule(db);
    await sendAbandonedCartReminders();
    const sentText = __sendTelegramMessageMock.mock.calls[0][2];
    expect(sentText).not.toContain("Promokod:");
    expect(db.__couponSetCalls.length).toBe(0);
  });

  test("4-BOSQICH (YAKUNIY): 60 soatdan keyin - oxirgi, bosimsiz xabar, savat 'reminded'ga o'tadi (tsikl tugaydi)", async () => {
    const db = buildMockDb({
      cartDocs: [activeCart({ ago: 61 * 60, reminderStage: 3 })],
      sellerData: {},
    });
    const { sendAbandonedCartReminders, __sendTelegramMessageMock } = loadModule(db);
    await sendAbandonedCartReminders();
    const sentText = __sendTelegramMessageMock.mock.calls[0][2];
    expect(sentText).toContain("oxirgi eslatmamiz");
    expect(db.__updateCalls[0].data.status).toBe("reminded");
    expect(db.__updateCalls[0].data.reminderStage).toBe(4);
  });

  test("REAKTIVATSIYA: mijoz savatni qayta o'zgartirgach (anchor eskisi bilan mos kelmaydi) - 1-bosqich QAYTA yuboriladi", async () => {
    const db = buildMockDb({
      // Joriy `updatedAt` 50 daqiqa oldin, lekin saqlangan anchor
      // BUTUNLAY BOSHQA (juda eski) qiymat - demak bu YANGI epizod.
      cartDocs: [activeCart({ ago: 50, reminderStage: 4, reminderStageAnchorAgo: 5000 })],
      sellerData: {},
    });
    const { sendAbandonedCartReminders, __sendTelegramMessageMock } = loadModule(db);
    await sendAbandonedCartReminders();
    const sentText = __sendTelegramMessageMock.mock.calls[0][2];
    expect(sentText).toContain("Savatingizda mahsulotlar kutmoqda!");
    expect(db.__updateCalls[0].data.reminderStage).toBe(1);
    expect(db.__updateCalls[0].data.status).toBe("active");
  });

  test("sotuvchi bu funksiyani o'chirib qo'ygan bo'lsa, xabar yubormaydi", async () => {
    const db = buildMockDb({
      cartDocs: [activeCart({ ago: 50 })],
      sellerData: { cartReminderEnabled: false },
    });
    const { sendAbandonedCartReminders, __sendTelegramMessageMock } = loadModule(db);
    await sendAbandonedCartReminders();
    expect(__sendTelegramMessageMock).not.toHaveBeenCalled();
  });

  test("sotuvchida shaxsiy bot ULANGAN bo'lsa, eslatma BIRINCHI NAVBATDA o'sha bot orqali yuboriladi (v39.6)", async () => {
    const db = buildMockDb({ cartDocs: [activeCart({ ago: 50 })], sellerData: {}, customerBotToken: "sellers-own-bot-token" });
    const { sendAbandonedCartReminders, __sendTelegramMessageMock } = loadModule(db);
    await sendAbandonedCartReminders();
    expect(__sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    expect(__sendTelegramMessageMock.mock.calls[0][0]).toBe("sellers-own-bot-token");
  });

  test("sotuvchida shaxsiy bot bo'lmasa, platforma (zaxira) tokeni ishlatiladi", async () => {
    const db = buildMockDb({ cartDocs: [activeCart({ ago: 50 })], sellerData: {} });
    const { sendAbandonedCartReminders, __sendTelegramMessageMock } = loadModule(db);
    await sendAbandonedCartReminders();
    expect(__sendTelegramMessageMock.mock.calls[0][0]).toBe("fallback-token");
  });

  // 100-seller qattiqlashtirish (`lib/batchProcess.js`): bir xil
  // sotuvchining bir nechta savati bo'lsa - guruhlash refaktoringi
  // ikkalasini ham to'g'ri ishlashini, LEKIN sotuvchi hujjatini FAQAT
  // BIR MARTA o'qishini tasdiqlaydi.
  test("bir xil sotuvchining IKKITA savati bo'lsa - HAR IKKALASI ham ishlanadi, sotuvchi hujjati FAQAT BIR MARTA o'qiladi", async () => {
    const db = buildMockDb({
      cartDocs: [
        activeCart({ ago: 50 }),
        { id: "cart-2", data: { ...activeCart({ ago: 50 }).data, clientId: "c2", items: [{ name: "Sovun", quantity: 1, price: 10_000 }] } },
      ],
      sellerData: {},
    });
    const { sendAbandonedCartReminders, __sendTelegramMessageMock } = loadModule(db);
    await sendAbandonedCartReminders();
    expect(db.__sellerDocGetCalls).toBe(1);
    expect(__sendTelegramMessageMock).toHaveBeenCalledTimes(2);
    expect(db.__updateCalls.filter((c) => c.data.reminderStage === 1)).toHaveLength(2);
  });
});
