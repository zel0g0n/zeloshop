/**
 * `notifications.js`dagi `sendCrmNotification` uchun testlar.
 *
 * v39.6 ARXITEKTURA: mijozga (xaridorga) yuboriladigan CRM xabari
 * ENDI birinchi navbatda sotuvchining O'Z (shaxsiy, ulangan) boti
 * orqali yuboriladi - chunki xaridor REAL HAYOTDA zeloshop haqida
 * umuman bilmaydi, u faqat sotuvchining shaxsiy boti bilan ishlaydi
 * (foydalanuvchining ANIQ so'ragan talabi). `zeloshop_bot` (platforma
 * tokeni) FAQAT ZAXIRA (fallback) sifatida ishlatiladi - agar sotuvchi
 * hali shaxsiy bot ULAMAGAN BO'LSA, YOKI shaxsiy bot orqali yuborish
 * biror sababga ko'ra MUVAFFAQIYATSIZ bo'lsa (masalan, mijoz aynan shu
 * botni hali "Start" bosmagan - Telegramning "chat not found" cheklovi).
 * Bu mantiq umumiy `lib/customerNotify.js` moduli (`sendCustomerNotification`)
 * orqali amalga oshiriladi.
 */

function buildMockDb({ customerBotToken = null, verifiedClientIds = [], staffDocs = [], campaignWrites = [], staffActorDocs = {} } = {}) {
  return {
    collection: (name) => {
      if (name === "sellers") {
        return {
          doc: () => ({
            // BIZNES BUYRUQ MARKAZI (2026-09, 3-band): `campaigns` quyi
            // kolleksiyasiga `.add(...)` chaqiriladi (bot tokeni/kunlik
            // statistika quyi kolleksiyalaridan FARQLI - ular `.doc().get()/.set()`
            // ishlatadi) - shuning uchun quyi kolleksiya nomiga qarab
            // ikkalasini ham qo'llab-quvvatlaymiz.
            collection: (subName) => {
              if (subName === "campaigns") {
                return { add: async (data) => { campaignWrites.push(data); return { id: "campaign-1" }; } };
              }
              return {
                doc: () => ({
                  get: async () => (
                    customerBotToken
                      ? { exists: true, data: () => ({ botToken: customerBotToken }) }
                      : { exists: false }
                  ),
                  set: async () => undefined, // dailyStats hisoblagichi uchun (bu testlar buni tekshirmaydi)
                }),
              };
            },
          }),
        };
      }
      if (name === "orders") {
        return {
          where: () => ({
            where: () => ({
              get: async () => ({
                forEach: (cb) => verifiedClientIds.forEach((id) => cb({ data: () => ({ clientId: id }) })),
              }),
            }),
          }),
        };
      }
      // "Xodimlar" (Staff) — `notifyStaffOfNewOrder`ning
      // `.where("sellerId","==",...).where("status","==","active").get()`
      // zanjirini, VA `resolveActingSellerContext`ning
      // `.doc(actorUid).get()` zanjirini qo'llab-quvvatlaydi
      // (2026-09 punkt-royxati, 2-band: `manageCustomers` ruxsatiga
      // ega xodim ham `sendCrmNotification`ni chaqira olishi kerak).
      if (name === "staff") {
        return {
          where: () => ({
            where: () => ({
              get: async () => ({ docs: staffDocs }),
            }),
          }),
          doc: (id) => ({
            get: async () => (
              staffActorDocs[id]
                ? { exists: true, data: () => staffActorDocs[id] }
                : { exists: false }
            ),
          }),
        };
      }
      // MUHIM: `logNotification` (bildirishnoma jurnali) `.add(...)`
      // chaqiradi - "notificationLogs" kolleksiyasi uchun ham
      // qo'llab-quvvatlaymiz.
      return { doc: () => ({ get: async () => ({ exists: false }) }), add: async () => ({}) };
    },
  };
}

function loadNotificationsModule({ customerBotToken, verifiedClientIds, sendResults, staffDocs, campaignWrites, staffActorDocs } = {}) {
  jest.resetModules();

  const trackedCampaignWrites = campaignWrites || [];
  const mockDb = buildMockDb({ customerBotToken, verifiedClientIds, staffDocs, campaignWrites: trackedCampaignWrites, staffActorDocs });
  // `sendResults` — chaqiruvlar ketma-ketligi bo'yicha natijalar ro'yxati
  // (masalan, [{ ok: false }, { ok: true }] — shaxsiy bot orqali birinchi
  // urinish muvaffaqiyatsiz, keyin platforma boti orqali zaxira
  // muvaffaqiyatli bo'ladi). Ro'yxat tugasa, oxirgi qiymat takrorlanadi.
  const results = sendResults && sendResults.length ? sendResults : [{ ok: true }];
  let callIndex = 0;
  const sendTelegramMessageMock = jest.fn(async () => {
    const result = results[Math.min(callIndex, results.length - 1)];
    callIndex += 1;
    return result;
  });

  // MUHIM: haqiqiy Admin SDK'da `admin.firestore` — FUNKSIYA bo'lib,
  // O'ZIDA ham `.FieldValue`/`.Timestamp` statik xususiyatlarini olib
  // yuradi (`admin.firestore.FieldValue.increment(...)` kabi chaqiriladi
  // - `admin.firestore()` esa Firestore instansiyasini qaytaradi). Buni
  // shu funksiyaning O'ZIGA xususiyat sifatida biriktirib (pastda),
  // ikkala chaqiruv shaklini ham (`admin.firestore()` VA
  // `admin.firestore.FieldValue...`) to'g'ri qo'llab-quvvatlaymiz -
  // aks holda `handleSendCrmNotification`dagi kampaniya yozuvi (va
  // `lib/dailyStats.js`dagi hisoblagichlar) jim xatoga uchrab,
  // try/catch ichida yashiringan bo'lardi.
  const firestoreFn = () => mockDb;
  firestoreFn.FieldValue = {
    serverTimestamp: () => "MOCK_TS",
    increment: (n) => ({ __op: "increment", amount: n }),
    arrayUnion: (...items) => ({ __op: "arrayUnion", items }),
  };
  jest.doMock("../lib/admin", () => ({
    admin: { firestore: firestoreFn },
    BOT_TOKEN: { value: () => "platform-shared-token" },
    STAFF_BOT_TOKEN: { value: () => "staff-shared-token" },
    GEMINI_API_KEY: { value: () => "mock" },
    db: mockDb,
  }));
  jest.doMock("../lib/helpers", () => ({
    sendTelegramMessage: sendTelegramMessageMock,
    sanitizeFirestoreData: (d) => d,
    buildSellerAppLink: (path) => `https://commerce-zelo.web.app${path || ""}`,
  }));
  jest.doMock("../lib/rateLimit", () => ({
    checkRateLimit: jest.fn(async () => undefined),
  }));

  const notifications = require("../notifications");
  return { notifications, sendTelegramMessageMock, campaignWrites: trackedCampaignWrites };
}

describe("sendCrmNotification — bot tokeni tanlash mantig'i", () => {
  test("sotuvchi shaxsiy bot ulagan bo'lsa, xabar BIRINCHI NAVBATDA o'sha bot orqali yuboriladi", async () => {
    const { notifications, sendTelegramMessageMock } = loadNotificationsModule({
      customerBotToken: "sellers-own-bot-token",
      verifiedClientIds: ["client-1"],
    });

    await notifications._testables.handleSendCrmNotification({
      auth: { uid: "seller-1" },
      data: {
        sellerId: "seller-1",
        targetClientIds: ["client-1"],
        title: "Aksiya",
        message: "15% chegirma",
      },
    });

    // Shaxsiy bot orqali yuborish MUVAFFAQIYATLI (standart sendResults),
    // shuning uchun platforma botiga zaxira sifatida murojaat qilinMAYDI.
    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    expect(sendTelegramMessageMock.mock.calls[0][0]).toBe("sellers-own-bot-token");
  });

  test("sotuvchida shaxsiy bot bo'lmasa, to'g'ridan-to'g'ri platforma tokeni ishlatiladi", async () => {
    const { notifications, sendTelegramMessageMock } = loadNotificationsModule({
      customerBotToken: null,
      verifiedClientIds: ["client-1"],
    });

    await notifications._testables.handleSendCrmNotification({
      auth: { uid: "seller-1" },
      data: {
        sellerId: "seller-1",
        targetClientIds: ["client-1"],
        title: "Aksiya",
        message: "15% chegirma",
      },
    });

    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    expect(sendTelegramMessageMock.mock.calls[0][0]).toBe("platform-shared-token");
  });

  test("shaxsiy bot orqali yuborish muvaffaqiyatsiz bo'lsa (mijoz o'sha botni ishga tushirmagan), platforma botiga ZAXIRA sifatida o'tiladi", async () => {
    const { notifications, sendTelegramMessageMock } = loadNotificationsModule({
      customerBotToken: "sellers-own-bot-token",
      verifiedClientIds: ["client-1"],
      // Birinchi urinish (shaxsiy bot) muvaffaqiyatsiz - "chat not
      // found" kabi xato taqlid qilinadi; ikkinchi urinish (platforma
      // boti) muvaffaqiyatli bo'ladi.
      sendResults: [{ ok: false, description: "chat not found" }, { ok: true }],
    });

    await notifications._testables.handleSendCrmNotification({
      auth: { uid: "seller-1" },
      data: {
        sellerId: "seller-1",
        targetClientIds: ["client-1"],
        title: "Aksiya",
        message: "15% chegirma",
      },
    });

    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(2);
    expect(sendTelegramMessageMock.mock.calls[0][0]).toBe("sellers-own-bot-token");
    expect(sendTelegramMessageMock.mock.calls[1][0]).toBe("platform-shared-token");
  });

  test("tasdiqlanmagan (buyurtma tarixida yo'q) mijozlarga xabar yuborilmaydi", async () => {
    const { notifications, sendTelegramMessageMock } = loadNotificationsModule({
      customerBotToken: null,
      verifiedClientIds: ["client-real"], // faqat shu ID haqiqiy buyurtmaga ega
    });

    const result = await notifications._testables.handleSendCrmNotification({
      auth: { uid: "seller-1" },
      data: {
        sellerId: "seller-1",
        targetClientIds: ["client-real", "client-fake"],
        title: "Aksiya",
        message: "15% chegirma",
      },
    });

    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    expect(result.clientsTotal).toBe(1);
  });

  test("tizimga kirmagan foydalanuvchi so'rovini rad etadi", async () => {
    const { notifications } = loadNotificationsModule({});
    await expect(
      notifications._testables.handleSendCrmNotification({ auth: null, data: {} })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  // XAVFSIZLIK (2026-09 audit, "Advanced Team & RBAC" bilan birga
  // tuzatilgan): ILGARI `sellerId` mijoz yuborgan so'rov ma'lumotidan
  // (`request.data.sellerId`) olinib, faqat `auth.uid === sellerId`
  // tekshirilardi. Endi `sellerId` UMUMAN `request.data`dan
  // OLINMAYDI — u FAQAT `resolveActingSellerContext` orqali
  // chaqiruvchining HAQIQIY identifikatoridan hosil bo'ladi, shuning
  // uchun `data.sellerId`ga qanday qiymat yuborilishidan qat'i nazar
  // (hatto boshqa sotuvchining ID'si) HECH QANDAY ta'sir qilmaydi.
  test("data.sellerId'ga ISHONILMAYDI — haqiqiy sellerId FAQAT auth.uid'dan hosil bo'ladi", async () => {
    const { notifications, campaignWrites } = loadNotificationsModule({
      customerBotToken: null,
      verifiedClientIds: ["client-1"],
    });

    await notifications._testables.handleSendCrmNotification({
      auth: { uid: "seller-1" },
      // Boshqa sotuvchining ID'sini yuborishga urinish — e'tiborga
      // olinMAYDI, xabar baribir "seller-1" nomidan yuboriladi.
      data: { sellerId: "seller-2-spoofed", targetClientIds: ["client-1"], title: "a", message: "b" },
    });

    // Kampaniya yozuvi `seller-1`ning O'Z kolleksiyasiga yozilganini
    // bilvosita tasdiqlash — `campaignWrites` massivi to'ldirilgani
    // (mock har qanday sellerId uchun bir xil `campaignWrites`ga
    // yozadi, lekin muvaffaqiyatli yakunlanishi — `data.sellerId`
    // qiymati funksiyani BUZMAGANLIGINI ko'rsatadi).
    expect(campaignWrites).toHaveLength(1);
  });

  // 2026-09 punkt-royxati, 2-band ("Advanced Team & RBAC"):
  // `manageCustomers` ruxsatiga ega xodim (masalan "Marketing
  // menejeri") ham sotuvchi nomidan CRM xabari yubora oladi.
  test("manageCustomers ruxsatiga ega FAOL xodim sotuvchi nomidan CRM xabari yubora oladi", async () => {
    const { notifications, sendTelegramMessageMock, campaignWrites } = loadNotificationsModule({
      customerBotToken: null,
      verifiedClientIds: ["client-1"],
      staffActorDocs: { "marketing-staff-1": { sellerId: "seller-1", status: "active", permissions: { manageCustomers: true } } },
    });

    const result = await notifications._testables.handleSendCrmNotification({
      auth: { uid: "marketing-staff-1" },
      data: { targetClientIds: ["client-1"], title: "Aksiya", message: "15% chegirma" },
    });

    expect(result.clientsSent).toBe(1);
    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    expect(campaignWrites).toHaveLength(1);
  });

  test("manageCustomers ruxsati BO'LMAGAN xodim CRM xabari yubora OLMAYDI", async () => {
    const { notifications, sendTelegramMessageMock } = loadNotificationsModule({
      customerBotToken: null,
      verifiedClientIds: ["client-1"],
      staffActorDocs: { "warehouse-staff-1": { sellerId: "seller-1", status: "active", permissions: { manageProducts: true } } },
    });

    await expect(
      notifications._testables.handleSendCrmNotification({
        auth: { uid: "warehouse-staff-1" },
        data: { targetClientIds: ["client-1"], title: "Aksiya", message: "15% chegirma" },
      })
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(sendTelegramMessageMock).not.toHaveBeenCalled();
  });

  test("NOFAOL (status !== active) xodim, manageCustomers'ga ega bo'lsa ham, CRM xabari yubora OLMAYDI", async () => {
    const { notifications } = loadNotificationsModule({
      customerBotToken: null,
      verifiedClientIds: ["client-1"],
      staffActorDocs: { "inactive-staff-1": { sellerId: "seller-1", status: "inactive", permissions: { manageCustomers: true } } },
    });

    await expect(
      notifications._testables.handleSendCrmNotification({
        auth: { uid: "inactive-staff-1" },
        data: { targetClientIds: ["client-1"], title: "Aksiya", message: "15% chegirma" },
      })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });
});

// BIZNES BUYRUQ MARKAZI (2026-09, 3-band "eng yaxshi marketing
// kampaniyasi" ko'rsatkichi): har bir "Yuborish" bosilganda
// `sellers/{id}/campaigns/{autoId}`ga yozuv qo'shiladi.
describe("sendCrmNotification — kampaniya yozuvini saqlash (Business Command Center)", () => {
  test("muvaffaqiyatli yuborilgandan keyin campaigns kolleksiyasiga yozadi (title/message/audienceCount/couponCode)", async () => {
    const { notifications, campaignWrites } = loadNotificationsModule({
      customerBotToken: null,
      verifiedClientIds: ["client-1", "client-2"],
    });

    await notifications._testables.handleSendCrmNotification({
      auth: { uid: "seller-1" },
      data: {
        sellerId: "seller-1",
        targetClientIds: ["client-1", "client-2"],
        title: "Kuzgi aksiya",
        message: "Barcha mahsulotlarga 20% chegirma",
        couponCode: "KUZGI20",
      },
    });

    expect(campaignWrites).toHaveLength(1);
    expect(campaignWrites[0]).toMatchObject({
      title: "Kuzgi aksiya",
      message: "Barcha mahsulotlarga 20% chegirma",
      audienceCount: 2,
      couponCode: "KUZGI20",
    });
  });

  test("promokodsiz yuborilsa - couponCode ATAYLAB null (soxta atributsiya imkoniyati qoldirilmaydi)", async () => {
    const { notifications, campaignWrites } = loadNotificationsModule({
      customerBotToken: null,
      verifiedClientIds: ["client-1"],
    });

    await notifications._testables.handleSendCrmNotification({
      auth: { uid: "seller-1" },
      data: {
        sellerId: "seller-1",
        targetClientIds: ["client-1"],
        title: "Yangilik",
        message: "Yangi mahsulotlar keldi",
      },
    });

    expect(campaignWrites).toHaveLength(1);
    expect(campaignWrites[0].couponCode).toBeNull();
  });

  test("audienceCount FAQAT tasdiqlangan (buyurtma tarixida mavjud) mijozlar sonini aks ettiradi", async () => {
    const { notifications, campaignWrites } = loadNotificationsModule({
      customerBotToken: null,
      verifiedClientIds: ["client-real"], // faqat shu ID haqiqiy buyurtmaga ega
    });

    await notifications._testables.handleSendCrmNotification({
      auth: { uid: "seller-1" },
      data: {
        sellerId: "seller-1",
        targetClientIds: ["client-real", "client-fake"],
        title: "Aksiya",
        message: "Chegirma",
      },
    });

    expect(campaignWrites[0].audienceCount).toBe(1);
  });
});

describe("buildSellerNewOrderMessage — sotuvchiga yuboriladigan yangi buyurtma matni", () => {
  test("mijoz, mahsulotlar va summani o'z ichiga oladi", () => {
    const { notifications } = loadNotificationsModule({});
    const text = notifications._testables.buildSellerNewOrderMessage({
      orderNumber: "1001",
      customer: { fullName: "Karim", phone: "+998901234567", address: "Chilonzor" },
      orders: [{ name: "Krem", quantity: 2, price: 50000 }],
      totalAmount: 100000,
    });
    expect(text).toContain("Karim");
    expect(text).toContain("Krem");
    expect(text).toContain("100,000");
  });

  // 2026-09 punkt-royxati, 89-band (bildirishnoma boyitish): mijoz
  // checkout'da tanlagan yetkazib berish vaqt oralig'i (97-band) ENDI
  // xabarning O'ZIDA ko'rinadi - sotuvchi ilovani ochmasdan ham qachon
  // yetkazish kerakligini biladi.
  test("`deliveryTimeSlot` mavjud bo'lsa, kelishilgan vaqtni ko'rsatadi", () => {
    const { notifications } = loadNotificationsModule({});
    const text = notifications._testables.buildSellerNewOrderMessage({
      orderNumber: "1001",
      customer: { fullName: "Karim" },
      orders: [],
      totalAmount: 100000,
      deliveryTimeSlot: { start: Date.UTC(2026, 8, 2, 9, 0, 0), end: Date.UTC(2026, 8, 2, 10, 0, 0) },
    });
    expect(text).toContain("Kelishilgan vaqt:");
    expect(text).toContain("02.09, 14:00–15:00");
  });

  test("`deliveryTimeSlot` bo'lmasa, bu qator umuman ko'rinmaydi", () => {
    const { notifications } = loadNotificationsModule({});
    const text = notifications._testables.buildSellerNewOrderMessage({
      orderNumber: "1001",
      customer: { fullName: "Karim" },
      orders: [],
      totalAmount: 100000,
    });
    expect(text).not.toContain("Kelishilgan vaqt");
  });
});

describe("notifyStaffOfNewOrder — 'Xodimlar' (Staff) ga yangi buyurtma haqida bildirishnoma", () => {
  test("hech qanday FAOL, manageOrders huquqiga ega xodim bo'lmasa — hech kimga xabar yuborilmaydi", async () => {
    const { notifications, sendTelegramMessageMock } = loadNotificationsModule({
      staffDocs: [
        { id: "st1", data: () => ({ permissions: { manageOrders: false } }) },
      ],
    });
    await notifications._testables.notifyStaffOfNewOrder({ sellerId: "seller-1", totalAmount: 1000 }, "order-1");
    expect(sendTelegramMessageMock).not.toHaveBeenCalled();
  });

  test("manageOrders huquqiga ega FAOL xodimlarga, 'Buyurtmalarni ochish' tugmasi bilan yuboriladi", async () => {
    const { notifications, sendTelegramMessageMock } = loadNotificationsModule({
      staffDocs: [
        { id: "st1", data: () => ({ permissions: { manageOrders: true } }) },
        { id: "st2", data: () => ({ permissions: { manageOrders: false } }) },
        { id: "st3", data: () => ({ permissions: { manageOrders: true } }) },
      ],
    });
    await notifications._testables.notifyStaffOfNewOrder(
      { sellerId: "seller-1", customer: { fullName: "Karim" }, totalAmount: 45000 },
      "order-1"
    );
    // Faqat st1 va st3 (manageOrders===true) — st2 chetlab o'tiladi.
    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(2);
    const recipients = sendTelegramMessageMock.mock.calls.map((c) => c[1]);
    expect(recipients.sort()).toEqual(["st1", "st3"]);
    expect(sendTelegramMessageMock.mock.calls[0][0]).toBe("staff-shared-token");
    expect(sendTelegramMessageMock.mock.calls[0][2]).toContain("Karim");
    expect(sendTelegramMessageMock.mock.calls[0][3].inlineKeyboard[0][0].web_app.url).toContain("/staff");
  });

  test("bitta xodimga yuborishda TARMOQ XATOSI (reject) bo'lsa ham, boshqasiga baribir yuboriladi va funksiya xato tashlamaydi", async () => {
    const { notifications } = loadNotificationsModule({
      staffDocs: [
        { id: "st1", data: () => ({ permissions: { manageOrders: true } }) },
        { id: "st2", data: () => ({ permissions: { manageOrders: true } }) },
      ],
    });
    // Ushbu testga xos, RAD ETADIGAN (reject) mock — umumiy
    // loader'ning har doim RESOLVE bo'ladigan mockidan farqli, chunki
    // haqiqiy tarmoq xatosini simulyatsiya qilish kerak.
    const { sendTelegramMessage } = require("../lib/helpers");
    sendTelegramMessage
      .mockRejectedValueOnce(new Error("tarmoq xatosi"))
      .mockResolvedValueOnce({ ok: true });

    await expect(
      notifications._testables.notifyStaffOfNewOrder({ sellerId: "seller-1", totalAmount: 1000 }, "order-1")
    ).resolves.toBeUndefined();
    expect(sendTelegramMessage).toHaveBeenCalledTimes(2);
  });
});
