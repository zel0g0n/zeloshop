/**
 * `engagementReminders.js` uchun testlar.
 *
 * MUHIM: bu ikkala funksiya ham `onSchedule` orqali eksport qilingan
 * (to'g'ridan-to'g'ri chaqirilmaydigan) - shuning uchun ICHKI mantiqni
 * sinash uchun, `onSchedule`ning ikkinchi argumentini (asosiy handler
 * funksiyani) TO'G'RIDAN-TO'G'RI CHAQIRAMIZ - Firebase Scheduler'ning
 * o'zini ishga tushirishga hojat yo'q.
 */

function buildMockDb({ favoriteDocs = [], orderDocs = [], newerOrderExists = false, sellerData = {}, customBotData = null, learningSummaryData = null } = {}) {
  const updateCalls = [];
  const outcomeAddCalls = [];
  const learningSetCalls = [];
  // YANGI (8-BOSQICH): AI CEO avtomatik chegirmasi HAQIQIY promokod
  // hujjatini `sellers/{id}/coupons/{code}`ga yozadi -
  // `aiCeoAutoDiscount.js` shu yozuvni kuzatib borish uchun.
  const couponSetCalls = [];
  // YANGI (100-seller qattiqlashtirish): bir xil sotuvchining bir
  // nechta elementi (savat/sevimli/buyurtma) BIR ISHGA TUSHIRISHDA
  // qayta ishlansa, sotuvchi hujjati FAQAT BIR MARTA o'qilishi kerak
  // (guruh ichida keshlanadi) - shu hisoblagich shuni tasdiqlaydi.
  let sellerDocGetCalls = 0;

  return {
    collection: (name) => {
      if (name === "favorites") {
        return {
          where: () => ({
            limit: () => ({
              get: async () => ({
                empty: favoriteDocs.length === 0,
                docs: favoriteDocs.map((d) => ({
                  id: d.id,
                  data: () => d.data,
                  ref: { update: async (data) => updateCalls.push({ id: d.id, data }) },
                })),
              }),
            }),
          }),
        };
      }
      if (name === "orders") {
        return {
          where: () => {
            // Ikki xil so'rovni farqlaymiz: (1) asosiy "delivered +
            // vaqt oynasi" so'rovi (`.limit(200)` bilan tugaydi), (2)
            // "qayta buyurtma bergani" tekshiruvi (`.limit(1)` bilan
            // tugaydi) - ikkalasi ham ENDI `.limit()`ga tugaydi, shuning
            // uchun `.limit()`ga UZATILGAN QIYMAT orqali farqlaymiz.
            const chain = {
              where: () => chain,
              limit: (n) => ({
                get: async () => {
                  if (n === 1) {
                    // Sub-so'rov: "qayta buyurtma bergani" tekshiruvi.
                    return { empty: !newerOrderExists, docs: newerOrderExists ? [{ id: "newer-order" }] : [] };
                  }
                  // Asosiy so'rov.
                  return {
                    empty: orderDocs.length === 0,
                    docs: orderDocs.map((d) => ({
                      id: d.id,
                      data: () => d.data,
                      ref: { update: async (data) => updateCalls.push({ id: d.id, data }) },
                    })),
                  };
                },
              }),
            };
            return chain;
          },
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
              // YANGI (7-BOSQICH): AI CEO "natija kuzatuvi" uchun ikkita
              // yangi quyi kolleksiya - `aiCeoOutcomes` (yozish) va
              // `aiCeoLearning` (o'qish/yozish) - nom bo'yicha farqlanadi,
              // qolgan barcha nomlar (masalan "private") ESKI, umumiy
              // xatti-harakatga tushadi.
              if (subName === "aiCeoOutcomes") {
                return { add: async (data) => { outcomeAddCalls.push(data); } };
              }
              if (subName === "aiCeoLearning") {
                return {
                  doc: () => ({
                    get: async () => (learningSummaryData ? { exists: true, data: () => learningSummaryData } : { exists: false }),
                    set: async (data) => { learningSetCalls.push(data); },
                  }),
                };
              }
              if (subName === "coupons") {
                return {
                  doc: (code) => ({
                    set: async (data) => { couponSetCalls.push({ code, data }); },
                  }),
                };
              }
              return {
                doc: () => ({
                  get: async () => (customBotData ? { exists: true, data: () => customBotData } : { exists: false }),
                }),
              };
            },
          }),
        };
      }
      // MUHIM: `logNotification` (bildirishnoma jurnali) `.add(...)`
      // chaqiradi - "notificationLogs" kolleksiyasi uchun ham,
      // umumiy holat sifatida, buni qo'llab-quvvatlaymiz.
      return { doc: () => ({ get: async () => ({ exists: false }) }), add: async () => ({}) };
    },
    __updateCalls: updateCalls,
    __outcomeAddCalls: outcomeAddCalls,
    __learningSetCalls: learningSetCalls,
    __couponSetCalls: couponSetCalls,
    get __sellerDocGetCalls() { return sellerDocGetCalls; },
  };
}

// MUHIM: `engagementReminders.js` endi `./aiCeo`ni (AI CEO Tier-1
// avtomatik qaytarish xabari uchun) talab qiladi - `aiCeo.js` o'zi
// `./lib/sentry`ni yuklaydi, bu esa HAQIQIY `@sentry/*` paketini
// talab qiladi va test muhitida ishlamaydi - shuning uchun
// `aiCeo.test.js`dagi BILAN BIR XIL, SOXTALASHTIRISH kerak (hoisted
// `jest.mock`, butun fayl uchun doimiy).
jest.mock("../lib/sentry", () => ({
  withSentry: (fn) => fn,
  SENTRY_DSN: { value: () => null },
  Sentry: { captureException: jest.fn() },
  initSentry: jest.fn(),
}));

function loadModule(db, { generateContentMock } = {}) {
  jest.resetModules();
  const sendTelegramMessageMock = jest.fn(async () => undefined);
  jest.doMock("../lib/admin", () => ({
    admin: { firestore: { FieldValue: { serverTimestamp: () => "MOCK_TS", increment: (n) => ({ __increment: n }) }, Timestamp: { fromMillis: (ms) => ({ __ms: ms }) } } },
    db,
    BOT_TOKEN: { value: () => "fallback-token" },
    GEMINI_API_KEY: { value: () => "mock-gemini-key" },
  }));
  jest.doMock("../lib/helpers", () => ({ sendTelegramMessage: sendTelegramMessageMock }));
  jest.doMock("@google/genai", () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({ models: { generateContent: generateContentMock || jest.fn() } })),
  }));
  const mod = require("../engagementReminders");
  return { ...mod, __sendTelegramMessageMock: sendTelegramMessageMock };
}

// `onSchedule(config, handler)` - ikkinchi argument HAQIQIY handler.
// Modul export qilgan narsa - Firebase'ning o'ralgan (wrapped)
// funksiyasi, shuning uchun mock orqali HAQIQIY handlerni to'g'ridan
// to'g'ri "ushlab olamiz".
jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: (config, handler) => handler,
}));

describe("sendFavoriteReminders", () => {
  test("hech qanday eskirgan sevimlilar bo'lmasa, hech narsa qilmaydi", async () => {
    const db = buildMockDb({ favoriteDocs: [] });
    const { sendFavoriteReminders } = loadModule(db);
    await expect(sendFavoriteReminders()).resolves.not.toThrow();
  });

  test("'reminded' holatidagi hujjatlarni O'TKAZIB YUBORADI (qayta xabar yubormaydi)", async () => {
    const db = buildMockDb({
      favoriteDocs: [{ id: "fav-1", data: { status: "reminded", sellerId: "s1", clientId: "c1", items: [{ name: "Krem", price: 10000 }] } }],
    });
    const { sendFavoriteReminders } = loadModule(db);
    await sendFavoriteReminders();
    expect(db.__updateCalls.length).toBe(0);
  });

  test("sotuvchi bu bildirishnomani o'chirib qo'ygan bo'lsa, xabar yubormaydi", async () => {
    const db = buildMockDb({
      favoriteDocs: [{ id: "fav-1", data: { sellerId: "s1", clientId: "c1", items: [{ name: "Krem", price: 10000 }] } }],
      sellerData: { favoriteReminderEnabled: false },
    });
    const { sendFavoriteReminders } = loadModule(db);
    await sendFavoriteReminders();
    expect(db.__updateCalls.length).toBe(0);
  });

  test("haqiqiy, eslatma yuborilishi kerak bo'lgan holatda - xabar yuboradi va 'reminded' deb belgilaydi", async () => {
    const db = buildMockDb({
      favoriteDocs: [{ id: "fav-1", data: { sellerId: "s1", clientId: "c1", items: [{ name: "Krem", price: 10000 }] } }],
      sellerData: {},
    });
    const { sendFavoriteReminders } = loadModule(db);
    await sendFavoriteReminders();
    expect(db.__updateCalls.length).toBe(1);
    expect(db.__updateCalls[0].data.status).toBe("reminded");
  });

  test("sotuvchida shaxsiy bot ULANGAN bo'lsa, eslatma BIRINCHI NAVBATDA o'sha bot orqali yuboriladi (v39.6)", async () => {
    const db = buildMockDb({
      favoriteDocs: [{ id: "fav-1", data: { sellerId: "s1", clientId: "c1", items: [{ name: "Krem", price: 10000 }] } }],
      sellerData: {},
      customBotData: { botToken: "sellers-own-bot-token" },
    });
    const { sendFavoriteReminders, __sendTelegramMessageMock } = loadModule(db);
    await sendFavoriteReminders();
    expect(__sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    expect(__sendTelegramMessageMock.mock.calls[0][0]).toBe("sellers-own-bot-token");
  });

  test("sotuvchida shaxsiy bot bo'lmasa, platforma (zaxira) tokeni ishlatiladi", async () => {
    const db = buildMockDb({
      favoriteDocs: [{ id: "fav-1", data: { sellerId: "s1", clientId: "c1", items: [{ name: "Krem", price: 10000 }] } }],
      sellerData: {},
    });
    const { sendFavoriteReminders, __sendTelegramMessageMock } = loadModule(db);
    await sendFavoriteReminders();
    expect(__sendTelegramMessageMock.mock.calls[0][0]).toBe("fallback-token");
  });

  // AI CEO — TIER-1 "ISHONCH ZINAPOYASI" (KENGAYTIRISH): xuddi
  // `sendRepurchaseReminders`dagi bilan BIR XIL to'rtta test - endi
  // sevimlilar eslatmasi uchun.
  test("aiCeoEnabled=false bo'lsa (standart holat) - AI CHAQIRILMAYDI, oddiy shablon yuboriladi", async () => {
    const generateContentMock = jest.fn();
    const db = buildMockDb({
      favoriteDocs: [{ id: "fav-1", data: { sellerId: "s1", clientId: "c1", items: [{ name: "Krem", price: 10000 }] } }],
      sellerData: {},
    });
    const { sendFavoriteReminders, __sendTelegramMessageMock } = loadModule(db, { generateContentMock });
    await sendFavoriteReminders();
    expect(generateContentMock).not.toHaveBeenCalled();
    expect(__sendTelegramMessageMock).toHaveBeenCalledWith(
      expect.any(String), "c1", expect.stringContaining("Sevimlilaringizda")
    );
  });

  test("aiCeoEnabled=true, lekin aiCeoAutoFavoriteEnabled YOQILMAGAN bo'lsa - AI baribir chaqirilmaydi (opt-in, opt-out EMAS)", async () => {
    const generateContentMock = jest.fn();
    const db = buildMockDb({
      favoriteDocs: [{ id: "fav-1", data: { sellerId: "s1", clientId: "c1", items: [{ name: "Krem", price: 10000 }] } }],
      sellerData: { aiCeoEnabled: true }, // aiCeoAutoFavoriteEnabled ATAYLAB yo'q
    });
    const { sendFavoriteReminders } = loadModule(db, { generateContentMock });
    await sendFavoriteReminders();
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  test("aiCeoEnabled=true VA aiCeoAutoFavoriteEnabled=true bo'lsa - AI matnini ishlatadi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({ text: "AI CEO yozgan sevimlilar eslatmasi." });
    const db = buildMockDb({
      favoriteDocs: [{ id: "fav-1", data: { sellerId: "s1", clientId: "c1", items: [{ name: "Krem", price: 10000 }] } }],
      sellerData: { aiCeoEnabled: true, aiCeoAutoFavoriteEnabled: true, storeName: "Zelo" },
    });
    const { sendFavoriteReminders, __sendTelegramMessageMock } = loadModule(db, { generateContentMock });
    await sendFavoriteReminders();
    expect(generateContentMock).toHaveBeenCalledTimes(1);
    expect(__sendTelegramMessageMock).toHaveBeenCalledWith(
      expect.any(String), "c1", "AI CEO yozgan sevimlilar eslatmasi."
    );
  });

  test("AI xato bersa - JIM QOLADI va oddiy shablon bilan baribir yuboradi", async () => {
    const generateContentMock = jest.fn().mockRejectedValue(new Error("Gemini vaqtincha ishlamayapti"));
    const db = buildMockDb({
      favoriteDocs: [{ id: "fav-1", data: { sellerId: "s1", clientId: "c1", items: [{ name: "Krem", price: 10000 }] } }],
      sellerData: { aiCeoEnabled: true, aiCeoAutoFavoriteEnabled: true },
    });
    const { sendFavoriteReminders, __sendTelegramMessageMock } = loadModule(db, { generateContentMock });
    await expect(sendFavoriteReminders()).resolves.not.toThrow();
    expect(__sendTelegramMessageMock).toHaveBeenCalledWith(
      expect.any(String), "c1", expect.stringContaining("Sevimlilaringizda")
    );
  });

  // AI CEO — 7-BOSQICH ("natija kuzatuvi va o'rganish"): xabar
  // yuborilgach, HAQIQIY natijani keyinroq tekshirish uchun kuzatuvga
  // olinishini tasdiqlaydi (batafsil izoh: `aiCeoLearning.js`).
  test("aiCeoEnabled=true bo'lsa - natija kuzatuvga OLINADI (AI o'chiq bo'lsa ham, aiGenerated:false bilan)", async () => {
    const db = buildMockDb({
      favoriteDocs: [{ id: "fav-1", data: { sellerId: "s1", clientId: "c1", items: [{ name: "Krem", price: 10000 }] } }],
      sellerData: { aiCeoEnabled: true },
    });
    const { sendFavoriteReminders } = loadModule(db);
    await sendFavoriteReminders();
    expect(db.__outcomeAddCalls).toHaveLength(1);
    expect(db.__outcomeAddCalls[0]).toMatchObject({ type: "favorite", clientId: "c1", aiGenerated: false, status: "pending" });
  });

  test("aiCeoEnabled=false (standart holat) bo'lsa - natija kuzatuvga UMUMAN OLINMAYDI", async () => {
    const db = buildMockDb({
      favoriteDocs: [{ id: "fav-1", data: { sellerId: "s1", clientId: "c1", items: [{ name: "Krem", price: 10000 }] } }],
      sellerData: {},
    });
    const { sendFavoriteReminders } = loadModule(db);
    await sendFavoriteReminders();
    expect(db.__outcomeAddCalls).toHaveLength(0);
  });

  test("AI matni ishlatilganda - natija kuzatuvi aiGenerated:true bilan yoziladi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({ text: "AI CEO yozgan sevimlilar eslatmasi." });
    const db = buildMockDb({
      favoriteDocs: [{ id: "fav-1", data: { sellerId: "s1", clientId: "c1", items: [{ name: "Krem", price: 10000 }] } }],
      sellerData: { aiCeoEnabled: true, aiCeoAutoFavoriteEnabled: true },
    });
    const { sendFavoriteReminders } = loadModule(db, { generateContentMock });
    await sendFavoriteReminders();
    expect(db.__outcomeAddCalls[0].aiGenerated).toBe(true);
  });

  test("oldingi AI xabarlarning HAQIQIY natijasi (yetarli namuna bilan) YANGI xabar promptiga qo'shiladi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({ text: "AI CEO yozgan sevimlilar eslatmasi." });
    const db = buildMockDb({
      favoriteDocs: [{ id: "fav-1", data: { sellerId: "s1", clientId: "c1", items: [{ name: "Krem", price: 10000 }] } }],
      sellerData: { aiCeoEnabled: true, aiCeoAutoFavoriteEnabled: true, storeName: "Zelo" },
      learningSummaryData: { favoriteAiSent: 10, favoriteAiConverted: 1 }, // 10% - past natija
    });
    const { sendFavoriteReminders } = loadModule(db, { generateContentMock });
    await sendFavoriteReminders();
    const promptSentToGemini = generateContentMock.mock.calls[0][0].contents;
    expect(promptSentToGemini).toContain("o'z-o'zini yaxshilash");
  });

  // 100-seller qattiqlashtirish (`lib/batchProcess.js`): bir xil
  // sotuvchining BIR NECHTA sevimlilar hujjati bitta ishga tushirishda
  // ketma-ket, LEKIN sotuvchi ma'lumoti FAQAT BIR MARTA o'qilib qayta
  // ishlanishini tasdiqlaydi - guruhlash refaktoringi buzilmaganini
  // ko'rsatadi.
  test("bir xil sotuvchining IKKITA sevimlilar hujjati bo'lsa - HAR IKKALASI ham ishlanadi, lekin sotuvchi hujjati FAQAT BIR MARTA o'qiladi", async () => {
    const db = buildMockDb({
      favoriteDocs: [
        { id: "fav-1", data: { sellerId: "s1", clientId: "c1", items: [{ name: "Krem", price: 10000 }] } },
        { id: "fav-2", data: { sellerId: "s1", clientId: "c2", items: [{ name: "Sovun", price: 5000 }] } },
      ],
      sellerData: {},
    });
    const { sendFavoriteReminders, __sendTelegramMessageMock } = loadModule(db);
    await sendFavoriteReminders();
    expect(db.__sellerDocGetCalls).toBe(1);
    expect(__sendTelegramMessageMock).toHaveBeenCalledTimes(2);
    expect(db.__updateCalls.filter((c) => c.data.status === "reminded")).toHaveLength(2);
  });
});

describe("sendRepurchaseReminders", () => {
  test("mijoz O'SHA BUYURTMADAN KEYIN qayta buyurtma bergan bo'lsa, eslatma YUBORMAYDI", async () => {
    const db = buildMockDb({
      orderDocs: [{ id: "order-1", data: { sellerId: "s1", clientId: "c1", orders: [{ name: "Krem", quantity: 1 }], createdAt: 1000 } }],
      newerOrderExists: true,
    });
    const { sendRepurchaseReminders } = loadModule(db);
    await sendRepurchaseReminders();
    // Faqat "belgilash" yozuvi bo'lishi kerak, xabar YUBORILMAGANI
    // uchun (lekin qayta tekshirmaslik uchun baribir belgilanadi).
    expect(db.__updateCalls.length).toBe(1);
    expect(db.__updateCalls[0].data.repurchaseReminderSent).toBe(true);
  });

  test("allaqachon eslatma yuborilgan buyurtmani O'TKAZIB YUBORADI", async () => {
    const db = buildMockDb({
      orderDocs: [{ id: "order-1", data: { sellerId: "s1", clientId: "c1", repurchaseReminderSent: true, orders: [{ name: "Krem" }] } }],
      newerOrderExists: false,
    });
    const { sendRepurchaseReminders } = loadModule(db);
    await sendRepurchaseReminders();
    expect(db.__updateCalls.length).toBe(0);
  });

  test("haqiqiy, qayta buyurtma BERILMAGAN holatda - eslatma yuboradi", async () => {
    const db = buildMockDb({
      orderDocs: [{ id: "order-1", data: { sellerId: "s1", clientId: "c1", orders: [{ name: "Krem", quantity: 1 }], createdAt: 1000 } }],
      newerOrderExists: false,
      sellerData: {},
    });
    const { sendRepurchaseReminders } = loadModule(db);
    await sendRepurchaseReminders();
    expect(db.__updateCalls.length).toBe(1);
    expect(db.__updateCalls[0].data.repurchaseReminderSent).toBe(true);
  });

  test("sotuvchida shaxsiy bot ULANGAN bo'lsa, eslatma BIRINCHI NAVBATDA o'sha bot orqali yuboriladi (v39.6)", async () => {
    const db = buildMockDb({
      orderDocs: [{ id: "order-1", data: { sellerId: "s1", clientId: "c1", orders: [{ name: "Krem", quantity: 1 }], createdAt: 1000 } }],
      newerOrderExists: false,
      sellerData: {},
      customBotData: { botToken: "sellers-own-bot-token" },
    });
    const { sendRepurchaseReminders, __sendTelegramMessageMock } = loadModule(db);
    await sendRepurchaseReminders();
    expect(__sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    expect(__sendTelegramMessageMock.mock.calls[0][0]).toBe("sellers-own-bot-token");
  });

  test("sotuvchida shaxsiy bot bo'lmasa, platforma (zaxira) tokeni ishlatiladi", async () => {
    const db = buildMockDb({
      orderDocs: [{ id: "order-1", data: { sellerId: "s1", clientId: "c1", orders: [{ name: "Krem", quantity: 1 }], createdAt: 1000 } }],
      newerOrderExists: false,
      sellerData: {},
    });
    const { sendRepurchaseReminders, __sendTelegramMessageMock } = loadModule(db);
    await sendRepurchaseReminders();
    expect(__sendTelegramMessageMock.mock.calls[0][0]).toBe("fallback-token");
  });

  // AI CEO — TIER-1 "ISHONCH ZINAPOYASI": bu uchta test, avtomatik
  // qaytarish eslatmasining YANGI, opt-in AI-yaxshilash qatlamini
  // tekshiradi.
  test("aiCeoEnabled=false bo'lsa (standart holat) - AI CHAQIRILMAYDI, oddiy shablon yuboriladi", async () => {
    const generateContentMock = jest.fn();
    const db = buildMockDb({
      orderDocs: [{ id: "order-1", data: { sellerId: "s1", clientId: "c1", orders: [{ name: "Krem", quantity: 1 }], createdAt: 1000 } }],
      newerOrderExists: false,
      sellerData: {}, // aiCeoEnabled/aiCeoAutoWinBackEnabled ikkalasi ham yo'q
    });
    const { sendRepurchaseReminders, __sendTelegramMessageMock } = loadModule(db, { generateContentMock });
    await sendRepurchaseReminders();
    expect(generateContentMock).not.toHaveBeenCalled();
    expect(__sendTelegramMessageMock).toHaveBeenCalledWith(
      expect.any(String), "c1", expect.stringContaining("Bir oy oldin buyurtma bergan")
    );
  });

  test("aiCeoEnabled=true, lekin aiCeoAutoWinBackEnabled YOQILMAGAN bo'lsa - AI baribir chaqirilmaydi (opt-in, opt-out EMAS)", async () => {
    const generateContentMock = jest.fn();
    const db = buildMockDb({
      orderDocs: [{ id: "order-1", data: { sellerId: "s1", clientId: "c1", orders: [{ name: "Krem", quantity: 1 }], createdAt: 1000 } }],
      newerOrderExists: false,
      sellerData: { aiCeoEnabled: true }, // aiCeoAutoWinBackEnabled ATAYLAB yo'q
    });
    const { sendRepurchaseReminders } = loadModule(db, { generateContentMock });
    await sendRepurchaseReminders();
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  test("aiCeoEnabled=true VA aiCeoAutoWinBackEnabled=true bo'lsa - AI matnini ishlatadi va hisoblagichni oshiradi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({ text: "AI CEO yozgan maxsus, iliq xabar." });
    const db = buildMockDb({
      orderDocs: [{ id: "order-1", data: { sellerId: "s1", clientId: "c1", customer: { fullName: "Ali" }, orders: [{ name: "Krem", quantity: 1 }], createdAt: 1000 } }],
      newerOrderExists: false,
      sellerData: { aiCeoEnabled: true, aiCeoAutoWinBackEnabled: true, storeName: "Zelo" },
    });
    const { sendRepurchaseReminders, __sendTelegramMessageMock } = loadModule(db, { generateContentMock });
    await sendRepurchaseReminders();
    expect(generateContentMock).toHaveBeenCalledTimes(1);
    expect(__sendTelegramMessageMock).toHaveBeenCalledWith(
      expect.any(String), "c1", "AI CEO yozgan maxsus, iliq xabar."
    );
  });

  test("AI xato bersa - JIM QOLADI va oddiy shablon bilan baribir yuboradi (eslatma HECH QACHON AI xatosi tufayli buzilmaydi)", async () => {
    const generateContentMock = jest.fn().mockRejectedValue(new Error("Gemini vaqtincha ishlamayapti"));
    const db = buildMockDb({
      orderDocs: [{ id: "order-1", data: { sellerId: "s1", clientId: "c1", orders: [{ name: "Krem", quantity: 1 }], createdAt: 1000 } }],
      newerOrderExists: false,
      sellerData: { aiCeoEnabled: true, aiCeoAutoWinBackEnabled: true },
    });
    const { sendRepurchaseReminders, __sendTelegramMessageMock } = loadModule(db, { generateContentMock });
    await expect(sendRepurchaseReminders()).resolves.not.toThrow();
    expect(__sendTelegramMessageMock).toHaveBeenCalledWith(
      expect.any(String), "c1", expect.stringContaining("Bir oy oldin buyurtma bergan")
    );
  });

  // AI CEO — 7-BOSQICH ("natija kuzatuvi va o'rganish"): xuddi
  // `sendFavoriteReminders`dagi bilan BIR XIL uchta test - endi avtomatik
  // qaytarish xabari uchun.
  test("aiCeoEnabled=true bo'lsa - natija kuzatuvga OLINADI (AI o'chiq bo'lsa ham, aiGenerated:false bilan)", async () => {
    const db = buildMockDb({
      orderDocs: [{ id: "order-1", data: { sellerId: "s1", clientId: "c1", orders: [{ name: "Krem", quantity: 1 }], createdAt: 1000 } }],
      newerOrderExists: false,
      sellerData: { aiCeoEnabled: true },
    });
    const { sendRepurchaseReminders } = loadModule(db);
    await sendRepurchaseReminders();
    expect(db.__outcomeAddCalls).toHaveLength(1);
    expect(db.__outcomeAddCalls[0]).toMatchObject({ type: "winback", clientId: "c1", aiGenerated: false, status: "pending" });
  });

  test("aiCeoEnabled=false (standart holat) bo'lsa - natija kuzatuvga UMUMAN OLINMAYDI", async () => {
    const db = buildMockDb({
      orderDocs: [{ id: "order-1", data: { sellerId: "s1", clientId: "c1", orders: [{ name: "Krem", quantity: 1 }], createdAt: 1000 } }],
      newerOrderExists: false,
      sellerData: {},
    });
    const { sendRepurchaseReminders } = loadModule(db);
    await sendRepurchaseReminders();
    expect(db.__outcomeAddCalls).toHaveLength(0);
  });

  test("oldingi AI xabarlarning HAQIQIY natijasi (yetarli namuna bilan) YANGI xabar promptiga qo'shiladi", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({ text: "AI CEO yozgan maxsus, iliq xabar." });
    const db = buildMockDb({
      orderDocs: [{ id: "order-1", data: { sellerId: "s1", clientId: "c1", orders: [{ name: "Krem", quantity: 1 }], createdAt: 1000 } }],
      newerOrderExists: false,
      sellerData: { aiCeoEnabled: true, aiCeoAutoWinBackEnabled: true, storeName: "Zelo" },
      learningSummaryData: { winbackAiSent: 10, winbackAiConverted: 4 }, // 40% - yaxshi natija
    });
    const { sendRepurchaseReminders } = loadModule(db, { generateContentMock });
    await sendRepurchaseReminders();
    const promptSentToGemini = generateContentMock.mock.calls[0][0].contents;
    expect(promptSentToGemini).toContain("Yaxshi natija");
  });

  // AI CEO — 8-BOSQICH ("avtonom harakatlar doirasini kengaytirish"):
  // to'rtta test - HAQIQIY, moliyaviy oqibatga ega chegirma promokodi
  // FAQAT barcha shart-sharoit (opt-in + bog'liqlik + ISBOTLANGAN past
  // natija) bajarilganda yaratilishini tasdiqlaydi (batafsil izoh:
  // `aiCeoAutoDiscount.js`).
  test("aiCeoAutoDiscountEnabled=true VA natija ISBOTLANGAN past bo'lsa - HAQIQIY chegirma promokodi yaratiladi va xabarga qo'shiladi", async () => {
    const db = buildMockDb({
      orderDocs: [{ id: "order-1", data: { sellerId: "s1", clientId: "c1", orders: [{ name: "Krem", quantity: 1 }], createdAt: 1000 } }],
      newerOrderExists: false,
      sellerData: { aiCeoEnabled: true, aiCeoAutoWinBackEnabled: true, aiCeoAutoDiscountEnabled: true, storeName: "Zelo" },
      learningSummaryData: { winbackAiSent: 10, winbackAiConverted: 1 }, // 10% - past, isbotlangan
    });
    const { sendRepurchaseReminders, __sendTelegramMessageMock } = loadModule(db);
    await sendRepurchaseReminders();
    expect(db.__couponSetCalls).toHaveLength(1);
    expect(db.__couponSetCalls[0].data).toMatchObject({
      discountType: "percent",
      isAiCeoWinBackReward: true,
      rewardForClientId: "c1",
      usageLimit: 1,
      isActive: true,
    });
    expect(__sendTelegramMessageMock).toHaveBeenCalledWith(
      expect.any(String), "c1", expect.stringContaining(db.__couponSetCalls[0].code)
    );
    expect(db.__outcomeAddCalls[0].discountIssued).toBe(true);
  });

  test("aiCeoAutoDiscountEnabled=true, lekin natija HALI yaxshi (ISBOTLANMAGAN past) bo'lsa - chegirma YARATILMAYDI", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({ text: "AI CEO yozgan maxsus, iliq xabar." });
    const db = buildMockDb({
      orderDocs: [{ id: "order-1", data: { sellerId: "s1", clientId: "c1", orders: [{ name: "Krem", quantity: 1 }], createdAt: 1000 } }],
      newerOrderExists: false,
      sellerData: { aiCeoEnabled: true, aiCeoAutoWinBackEnabled: true, aiCeoAutoDiscountEnabled: true, storeName: "Zelo" },
      learningSummaryData: { winbackAiSent: 10, winbackAiConverted: 4 }, // 40% - yaxshi natija
    });
    const { sendRepurchaseReminders } = loadModule(db, { generateContentMock });
    await sendRepurchaseReminders();
    expect(db.__couponSetCalls).toHaveLength(0);
    expect(db.__outcomeAddCalls[0].discountIssued).toBe(false);
  });

  test("aiCeoAutoDiscountEnabled=false (standart holat) bo'lsa - past natija bo'lsa ham chegirma YARATILMAYDI", async () => {
    const db = buildMockDb({
      orderDocs: [{ id: "order-1", data: { sellerId: "s1", clientId: "c1", orders: [{ name: "Krem", quantity: 1 }], createdAt: 1000 } }],
      newerOrderExists: false,
      sellerData: { aiCeoEnabled: true, aiCeoAutoWinBackEnabled: true, storeName: "Zelo" }, // aiCeoAutoDiscountEnabled ATAYLAB yo'q
      learningSummaryData: { winbackAiSent: 10, winbackAiConverted: 1 },
    });
    const { sendRepurchaseReminders } = loadModule(db);
    await sendRepurchaseReminders();
    expect(db.__couponSetCalls).toHaveLength(0);
  });

  test("aiCeoAutoWinBackEnabled YOQILMAGAN bo'lsa (faqat aiCeoAutoDiscountEnabled yoqilgan) - bog'liqlik tufayli chegirma YARATILMAYDI", async () => {
    const db = buildMockDb({
      orderDocs: [{ id: "order-1", data: { sellerId: "s1", clientId: "c1", orders: [{ name: "Krem", quantity: 1 }], createdAt: 1000 } }],
      newerOrderExists: false,
      sellerData: { aiCeoEnabled: true, aiCeoAutoDiscountEnabled: true }, // aiCeoAutoWinBackEnabled ATAYLAB yo'q
      learningSummaryData: { winbackAiSent: 10, winbackAiConverted: 1 },
    });
    const { sendRepurchaseReminders } = loadModule(db);
    await sendRepurchaseReminders();
    expect(db.__couponSetCalls).toHaveLength(0);
  });

  // 100-seller qattiqlashtirish (`lib/batchProcess.js`): eng KRITIK
  // holat - `discountState.issuedCount` xavfsizlik hisoblagichi bir xil
  // sotuvchining BIR NECHTA buyurtmasi orasida TO'G'RI saqlanib
  // qolishini (guruh ICHIDA ketma-ket ishlangani uchun) tasdiqlaydi.
  // Agar guruhlash noto'g'ri bo'lsa (masalan har bir buyurtma o'z
  // `discountState`iga ega bo'lib qolsa), bu hisoblagich HAR DOIM 0dan
  // boshlanib, `MAX_AUTO_DISCOUNTS_PER_SELLER_PER_RUN` chegarasi
  // buzilishi mumkin edi.
  test("bir xil sotuvchining IKKITA buyurtmasi bo'lsa - HAR IKKALASI ham ishlanadi, sotuvchi hujjati FAQAT BIR MARTA o'qiladi, va ikkalasi ham chegirma oladi (chegaradan pastda)", async () => {
    const generateContentMock = jest.fn().mockResolvedValue({ text: "AI CEO yozgan maxsus, iliq xabar." });
    const db = buildMockDb({
      orderDocs: [
        { id: "order-1", data: { sellerId: "s1", clientId: "c1", orders: [{ name: "Krem", quantity: 1 }], createdAt: 1000 } },
        { id: "order-2", data: { sellerId: "s1", clientId: "c2", orders: [{ name: "Sovun", quantity: 1 }], createdAt: 1000 } },
      ],
      newerOrderExists: false,
      sellerData: { aiCeoEnabled: true, aiCeoAutoWinBackEnabled: true, aiCeoAutoDiscountEnabled: true, storeName: "Zelo" },
      learningSummaryData: { winbackAiSent: 10, winbackAiConverted: 1 }, // 10% - past natija, chegirmaga loyiq
    });
    const { sendRepurchaseReminders } = loadModule(db, { generateContentMock });
    await sendRepurchaseReminders();
    expect(db.__sellerDocGetCalls).toBe(1);
    expect(db.__couponSetCalls).toHaveLength(2);
    // Ikkala promokod ham BIR-BIRIDAN FARQLI (mustaqil yaratilgan).
    expect(db.__couponSetCalls[0].code).not.toBe(db.__couponSetCalls[1].code);
    expect(db.__couponSetCalls.map((c) => c.data.rewardForClientId).sort()).toEqual(["c1", "c2"]);
  });
});
