/**
 * `couriers.js` uchun testlar — sotuvchi tomonidan kuryer
 * qo'shish/faollashtirish/o'chirish, buyurtmani kuryerga topshirish,
 * va kuryer holat yangilashning ASOSIY (`applyCourierOrderAction`,
 * bot VA Mini App IKKALASI HAM shu funksiyani chaqiradi) mantig'i.
 *
 * Haqiqiy Firestore/Telegram API'ga ULANMAYDI — barchasi taqlid
 * qilingan (mock).
 */

function buildMockDb({ orders = {}, couriers = {}, customerBotTokens = {}, staff = {} } = {}) {
  const orderUpdates = {};
  const courierUpdates = {};
  const courierDeletes = [];
  const inviteSets = {};
  const inviteUpdates = {};

  // YANGI (v39.5): buyurtma hujjatiga ishora ("ref") - `.where().get()`
  // orqali topilgan hujjatlar HAM `writeCourierLocationAndNotifyClient`
  // uchun `.ref.update(...)` chaqira olishi kerak - shuning uchun BIR
  // XIL ref yasovchi funksiya `.doc(id)` bilan ULASHILADI.
  const buildOrderRef = (id) => ({
    get: async () => (orders[id] ? { exists: true, data: () => orders[id] } : { exists: false }),
    update: async (data) => { orderUpdates[id] = { ...(orderUpdates[id] || {}), ...data }; },
  });

  return {
    collection: (name) => {
      if (name === "orders") {
        return {
          doc: (id) => buildOrderRef(id),
          // YANGI: "faqat bitta jarayondagi yetkazma" tekshiruvi
          // (`applyCourierOrderAction`dagi "picked_up" bo'limi) uchun -
          // FAQAT bitta `.where(field, "==", value).get()` ko'rinishini
          // qo'llab-quvvatlaydi, murakkab so'rov mexanizmini simulyatsiya
          // qilishga hojat yo'q.
          where: (field, op, value) => ({
            get: async () => {
              if (op !== "==") throw new Error(`Kutilmagan operator: ${op}`);
              const docs = Object.entries(orders)
                .filter(([, data]) => data[field] === value)
                .map(([id, data]) => ({ id, data: () => data, ref: buildOrderRef(id) }));
              return { docs, empty: docs.length === 0 };
            },
          }),
        };
      }
      if (name === "couriers") {
        return {
          doc: (id) => ({
            get: async () => (couriers[id] ? { exists: true, data: () => couriers[id] } : { exists: false }),
            update: async (data) => { courierUpdates[id] = data; },
            delete: async () => { courierDeletes.push(id); },
          }),
        };
      }
      // YANGI (2026-09, `manageCouriers` xodim ruxsati): `staffAccess.js`
      // `resolveActingSellerContext` HAR BIR chaqiruvda avval shu
      // kolleksiyani tekshiradi (chaqiruvchi xodimmi yoki sotuvchining
      // O'ZimI, aniqlash uchun) - standart holatda bo'sh (`{}`), ya'ni
      // mavjud (xodimga oid bo'lmagan) testlar o'zgarishsiz o'tadi.
      if (name === "staff") {
        return {
          doc: (id) => ({
            get: async () => (staff[id] ? { exists: true, data: () => staff[id] } : { exists: false }),
          }),
        };
      }
      if (name === "sellers") {
        return {
          // YANGI (v39.6): `doc(sellerId)` endi ANIQ sotuvchi ID'sini
          // qabul qiladi - `getSellerCustomBotToken`ning
          // "sellers/{sellerId}/private/customerBot" o'qishini
          // qo'llab-quvvatlash uchun (avval faqat "courierInvites"
          // quyi kolleksiyasi mavjud edi, "private" so'ralsa xato
          // tashlar edi - bu esa haqiqiy custom-bot mantig'ini
          // testlarda HECH QACHON haqiqiy sinamas edi, doim xatoni
          // ushlab "null"ga tushib qolar edi).
          doc: (sellerId) => ({
            collection: (sub) => {
              if (sub === "private") {
                return {
                  doc: (docId) => {
                    if (docId !== "customerBot") throw new Error(`Kutilmagan hujjat: ${docId}`);
                    const token = customerBotTokens[sellerId];
                    return {
                      get: async () => (token ? { exists: true, data: () => ({ botToken: token }) } : { exists: false }),
                    };
                  },
                };
              }
              if (sub !== "courierInvites") throw new Error(`Kutilmagan quyi kolleksiya: ${sub}`);
              return {
                doc: (token) => ({
                  set: async (data) => { inviteSets[token] = data; },
                  update: async (data) => { inviteUpdates[token] = data; },
                }),
              };
            },
          }),
        };
      }
      throw new Error(`Kutilmagan kolleksiya: ${name}`);
    },
    __orderUpdates: orderUpdates,
    __courierUpdates: courierUpdates,
    __courierDeletes: courierDeletes,
    __inviteSets: inviteSets,
    __inviteUpdates: inviteUpdates,
  };
}

function loadCouriersModule({
  db, sendTelegramMessageMock, checkRateLimitMock, buildDeepLinkMock,
  sendTelegramLiveLocationMock, editTelegramLiveLocationMock, stopTelegramLiveLocationMock,
} = {}) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: { firestore: { FieldValue: { serverTimestamp: () => "MOCK_TS", delete: () => "MOCK_DELETE" } } },
    db,
    BOT_TOKEN: { value: () => "platform-token" },
    COURIER_BOT_TOKEN: { value: () => "courier-token" },
  }));
  jest.doMock("../lib/rateLimit", () => ({ checkRateLimit: checkRateLimitMock || jest.fn().mockResolvedValue(undefined) }));
  jest.doMock("../lib/helpers", () => ({
    sendTelegramMessage: sendTelegramMessageMock || jest.fn().mockResolvedValue({ ok: true }),
    buildDeepLink: buildDeepLinkMock || ((sellerId, path) => `https://t.me/zeloshop_bot/shop?startapp=${sellerId}_p${path}`),
    // YANGI (v39.5): Telegram NATIV jonli joylashuv yordamchilari -
    // standart holatda "muvaffaqiyatli" (mock message_id) qaytaradi.
    sendTelegramLiveLocation: sendTelegramLiveLocationMock || jest.fn().mockResolvedValue(555),
    editTelegramLiveLocation: editTelegramLiveLocationMock || jest.fn().mockResolvedValue(undefined),
    stopTelegramLiveLocation: stopTelegramLiveLocationMock || jest.fn().mockResolvedValue(undefined),
  }));
  return require("../couriers");
}

describe("SOF funksiyalar", () => {
  const couriers = loadCouriersModule({ db: buildMockDb({}) });

  test("buildCourierInviteLink — to'g'ri bot username bilan havola yasaydi", () => {
    expect(couriers._testables.buildCourierInviteLink("seller1_abc123")).toBe(
      "https://t.me/zeloshop_kuryer_bot?start=seller1_abc123"
    );
  });

  test("buildCourierAssignmentMessage — naqd to'lov (cod) bo'lsa ogohlantirish qo'shadi", () => {
    const text = couriers._testables.buildCourierAssignmentMessage(
      { customer: { fullName: "Vali", phone: "+998901234567", address: "Toshkent", paymentTypes: ["cod"] }, orders: [{ name: "Krem", quantity: 2 }], totalAmount: 50000 },
      "orderId123456"
    );
    expect(text).toContain("Naqd to'lov");
    expect(text).toContain("Vali");
    expect(text).toContain("Krem x2");
    expect(text).toContain("50,000");
  });

  test("buildCourierAssignmentMessage — oldindan to'langan bo'lsa, cod ogohlantirishisiz", () => {
    const text = couriers._testables.buildCourierAssignmentMessage(
      { customer: { fullName: "Vali", paymentTypes: ["prepay"] }, orders: [], totalAmount: 10000 },
      "orderId123456"
    );
    expect(text).not.toContain("Naqd to'lov");
    expect(text).toContain("Oldindan to'langan");
  });

  test("buildCourierActionKeyboard — 'assigned' bosqichida Boshladim/Bekor qilish", () => {
    const keyboard = couriers._testables.buildCourierActionKeyboard("abc123");
    expect(keyboard).toHaveLength(2);
    expect(keyboard[0][0].callback_data).toBe("cor:picked_up:abc123");
    expect(keyboard[1][0].callback_data).toBe("cor:declined:abc123");
  });

  test("buildCourierActionKeyboard — 'picked_up' bosqichida Yetkazildi/Yetkaza olmadim", () => {
    const keyboard = couriers._testables.buildCourierActionKeyboard("abc123", "picked_up");
    expect(keyboard).toHaveLength(2);
    expect(keyboard[0][0].callback_data).toBe("cor:delivered:abc123");
    expect(keyboard[1][0].callback_data).toBe("cor:failed:abc123");
  });
});

describe("handleCreateCourierInvite", () => {
  test("auth yo'q bo'lsa unauthenticated", async () => {
    const couriers = loadCouriersModule({ db: buildMockDb({}) });
    await expect(couriers._testables.handleCreateCourierInvite({ data: { name: "Aziz" } }))
      .rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("ism bo'sh bo'lsa invalid-argument", async () => {
    const couriers = loadCouriersModule({ db: buildMockDb({}) });
    await expect(couriers._testables.handleCreateCourierInvite({ auth: { uid: "seller1" }, data: {} }))
      .rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("token sellerId PREFIKSI bilan yaratiladi va havola to'g'ri qaytadi", async () => {
    const db = buildMockDb({});
    const couriers = loadCouriersModule({ db });
    const result = await couriers._testables.handleCreateCourierInvite({
      auth: { uid: "seller1" },
      data: { name: "Aziz", phone: "+998901234567" },
    });
    expect(result.token.startsWith("seller1_")).toBe(true);
    expect(result.inviteLink).toBe(`https://t.me/zeloshop_kuryer_bot?start=${result.token}`);
    expect(db.__inviteSets[result.token].name).toBe("Aziz");
    expect(db.__inviteSets[result.token].used).toBe(false);
  });
});

describe("handleSetCourierActive / handleRemoveCourier — egalik tekshiruvi", () => {
  test("boshqa sotuvchining kuryerini o'zgartirib bo'lmaydi", async () => {
    const db = buildMockDb({ couriers: { c1: { sellerId: "seller-other", status: "active" } } });
    const couriers = loadCouriersModule({ db });
    await expect(
      couriers._testables.handleSetCourierActive({ auth: { uid: "seller1" }, data: { courierId: "c1", active: false } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("o'z kuryerini faolsizlantirish/faollashtirish ishlaydi", async () => {
    const db = buildMockDb({ couriers: { c1: { sellerId: "seller1", status: "active" } } });
    const couriers = loadCouriersModule({ db });
    const result = await couriers._testables.handleSetCourierActive({ auth: { uid: "seller1" }, data: { courierId: "c1", active: false } });
    expect(result.success).toBe(true);
    expect(db.__courierUpdates.c1.status).toBe("inactive");
  });

  test("removeCourier — faqat egasi o'chira oladi", async () => {
    const db = buildMockDb({ couriers: { c1: { sellerId: "seller1" } } });
    const couriers = loadCouriersModule({ db });
    const result = await couriers._testables.handleRemoveCourier({ auth: { uid: "seller1" }, data: { courierId: "c1" } });
    expect(result.success).toBe(true);
    expect(db.__courierDeletes).toContain("c1");
  });

  test("kuryer o'zi (auth.uid === courierId) o'z holatini o'zgartira oladi", async () => {
    const db = buildMockDb({ couriers: { c1: { sellerId: "seller1", status: "active" } } });
    const couriers = loadCouriersModule({ db });
    const result = await couriers._testables.handleSetCourierActive({ auth: { uid: "c1" }, data: { courierId: "c1", active: false } });
    expect(result.success).toBe(true);
    expect(db.__courierUpdates.c1.status).toBe("inactive");
  });

  test("boshqa kuryer o'zganing hisobini o'zgartira olmaydi (na sotuvchi, na o'zi)", async () => {
    const db = buildMockDb({ couriers: { c1: { sellerId: "seller1", status: "active" } } });
    const couriers = loadCouriersModule({ db });
    await expect(
      couriers._testables.handleSetCourierActive({ auth: { uid: "c2" }, data: { courierId: "c1", active: false } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("mavjud bo'lmagan kuryer uchun not-found", async () => {
    const db = buildMockDb({ couriers: {} });
    const couriers = loadCouriersModule({ db });
    await expect(
      couriers._testables.handleSetCourierActive({ auth: { uid: "seller1" }, data: { courierId: "ghost", active: false } })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  // YANGI: kuryer O'ZINI o'zi ro'yxatdan o'chira oladi ("kuryerlikni
  // to'xtatish", Mini App "Profil" bo'limi) - `handleSetCourierActive`
  // bilan BIR XIL "sotuvchi YOKI o'zi" naqshi `handleRemoveCourier`ga
  // ham qo'llanildi.
  test("removeCourier — kuryer o'zini o'zi (egasi bo'lmasa ham) o'chira oladi", async () => {
    const db = buildMockDb({ couriers: { c1: { sellerId: "seller1", status: "active" } } });
    const couriers = loadCouriersModule({ db });
    const result = await couriers._testables.handleRemoveCourier({ auth: { uid: "c1" }, data: { courierId: "c1" } });
    expect(result.success).toBe(true);
    expect(db.__courierDeletes).toContain("c1");
  });

  test("removeCourier — na sotuvchi na o'zi bo'lsa permission-denied", async () => {
    const db = buildMockDb({ couriers: { c1: { sellerId: "seller1", status: "active" } } });
    const couriers = loadCouriersModule({ db });
    await expect(
      couriers._testables.handleRemoveCourier({ auth: { uid: "seller-other" }, data: { courierId: "c1" } })
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(db.__courierDeletes).not.toContain("c1");
  });

  test("removeCourier — mavjud bo'lmagan kuryer uchun not-found", async () => {
    const db = buildMockDb({ couriers: {} });
    const couriers = loadCouriersModule({ db });
    await expect(
      couriers._testables.handleRemoveCourier({ auth: { uid: "seller1" }, data: { courierId: "ghost" } })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  // XAVFSIZLIK (P1 fix, 2026-09 audit): oldin `setCourierActive`/
  // `removeCourier`da HECH QANDAY `checkRateLimit` yo'q edi — chaqiruvchi
  // FOYDALANUVCHI bo'yicha (aniq courierId bo'yicha EMAS) tekshirilishi
  // kerak, aks holda kuryerni almashtirib chegarani aylanib o'tish mumkin.
  test("setCourierActive — chaqiruvchi bo'yicha rate-limit tekshiradi", async () => {
    const checkRateLimitMock = jest.fn().mockResolvedValue(undefined);
    const db = buildMockDb({ couriers: { c1: { sellerId: "seller1", status: "active" } } });
    const couriers = loadCouriersModule({ db, checkRateLimitMock });
    await couriers._testables.handleSetCourierActive({ auth: { uid: "seller1" }, data: { courierId: "c1", active: false } });
    expect(checkRateLimitMock).toHaveBeenCalledWith("setCourierActive:seller1", expect.any(Number), expect.any(Number));
  });

  test("setCourierActive — rate-limit oshib ketgan bo'lsa, kuryer holati O'ZGARTIRILMASDAN rad etiladi", async () => {
    const { HttpsError } = require("firebase-functions/v2/https");
    const checkRateLimitMock = jest.fn().mockRejectedValue(new HttpsError("resource-exhausted", "Juda ko'p so'rov."));
    const db = buildMockDb({ couriers: { c1: { sellerId: "seller1", status: "active" } } });
    const couriers = loadCouriersModule({ db, checkRateLimitMock });
    await expect(
      couriers._testables.handleSetCourierActive({ auth: { uid: "seller1" }, data: { courierId: "c1", active: false } })
    ).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(db.__courierUpdates.c1).toBeUndefined();
  });

  test("removeCourier — chaqiruvchi bo'yicha rate-limit tekshiradi", async () => {
    const checkRateLimitMock = jest.fn().mockResolvedValue(undefined);
    const db = buildMockDb({ couriers: { c1: { sellerId: "seller1" } } });
    const couriers = loadCouriersModule({ db, checkRateLimitMock });
    await couriers._testables.handleRemoveCourier({ auth: { uid: "seller1" }, data: { courierId: "c1" } });
    expect(checkRateLimitMock).toHaveBeenCalledWith("removeCourier:seller1", expect.any(Number), expect.any(Number));
  });
});

describe("handleUpdateCourierProfile — kuryerning o'z profilini (ism/telefon) tahrirlashi", () => {
  test("autentifikatsiyasiz rad etiladi", async () => {
    const couriers = loadCouriersModule({ db: buildMockDb({}) });
    await expect(
      couriers._testables.handleUpdateCourierProfile({ auth: null, data: { name: "Aziz" } })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("bo'sh ism bilan invalid-argument", async () => {
    const db = buildMockDb({ couriers: { c1: { sellerId: "seller1", name: "Eski ism" } } });
    const couriers = loadCouriersModule({ db });
    await expect(
      couriers._testables.handleUpdateCourierProfile({ auth: { uid: "c1" }, data: { name: "   " } })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("mavjud bo'lmagan kuryer hujjati uchun not-found", async () => {
    const db = buildMockDb({ couriers: {} });
    const couriers = loadCouriersModule({ db });
    await expect(
      couriers._testables.handleUpdateCourierProfile({ auth: { uid: "ghost" }, data: { name: "Aziz" } })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  test("o'zining ism/telefonini muvaffaqiyatli yangilaydi (faqat auth.uid bo'yicha, boshqa courierId yuborilsa ham e'tiborga olinmaydi)", async () => {
    const db = buildMockDb({ couriers: { c1: { sellerId: "seller1", name: "Eski ism", phone: "+998900000000" } } });
    const couriers = loadCouriersModule({ db });
    const result = await couriers._testables.handleUpdateCourierProfile({
      auth: { uid: "c1" },
      // MUHIM: `courierId` maydoni yuborilsa ham funksiya UNI e'tiborga
      // olmaydi - har doim `request.auth.uid`dan foydalanadi, shuning
      // uchun boshqa kuryerning profilini o'zgartirib bo'lmaydi.
      data: { courierId: "someone-else", name: "  Yangi Ism  ", phone: "+998901234567" },
    });
    expect(result.success).toBe(true);
    expect(db.__courierUpdates.c1).toEqual({ name: "Yangi Ism", phone: "+998901234567" });
    expect(db.__courierUpdates["someone-else"]).toBeUndefined();
  });

  test("telefon berilmasa null sifatida saqlanadi", async () => {
    const db = buildMockDb({ couriers: { c1: { sellerId: "seller1", name: "Aziz" } } });
    const couriers = loadCouriersModule({ db });
    const result = await couriers._testables.handleUpdateCourierProfile({ auth: { uid: "c1" }, data: { name: "Aziz" } });
    expect(result.success).toBe(true);
    expect(db.__courierUpdates.c1).toEqual({ name: "Aziz", phone: null });
  });

  test("rate limit funksiyasi chaqiriladi", async () => {
    const checkRateLimitMock = jest.fn().mockResolvedValue(undefined);
    const db = buildMockDb({ couriers: { c1: { sellerId: "seller1", name: "Aziz" } } });
    const couriers = loadCouriersModule({ db, checkRateLimitMock });
    await couriers._testables.handleUpdateCourierProfile({ auth: { uid: "c1" }, data: { name: "Aziz" } });
    expect(checkRateLimitMock).toHaveBeenCalledWith("updateCourierProfile:c1", 20, 3600);
  });
});

describe("handleAssignOrderToCourier", () => {
  test("faqat 'processing' bosqichidagi buyurtmani topshirish mumkin", async () => {
    const db = buildMockDb({
      orders: { o1: { sellerId: "seller1", status: "new" } },
      couriers: { c1: { sellerId: "seller1", status: "active", name: "Aziz" } },
    });
    const sendTelegramMessageMock = jest.fn();
    const couriers = loadCouriersModule({ db, sendTelegramMessageMock });
    await expect(
      couriers._testables.handleAssignOrderToCourier({ auth: { uid: "seller1" }, data: { orderId: "o1", courierId: "c1" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(sendTelegramMessageMock).not.toHaveBeenCalled();
  });

  test("faolsiz kuryerga topshirib bo'lmaydi", async () => {
    const db = buildMockDb({
      orders: { o1: { sellerId: "seller1", status: "processing" } },
      couriers: { c1: { sellerId: "seller1", status: "inactive", name: "Aziz" } },
    });
    const couriers = loadCouriersModule({ db });
    await expect(
      couriers._testables.handleAssignOrderToCourier({ auth: { uid: "seller1" }, data: { orderId: "o1", courierId: "c1" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("boshqa sotuvchining buyurtmasi/kuryerini ishlata olmaydi", async () => {
    const db = buildMockDb({
      orders: { o1: { sellerId: "seller-other", status: "processing" } },
      couriers: { c1: { sellerId: "seller1", status: "active" } },
    });
    const couriers = loadCouriersModule({ db });
    await expect(
      couriers._testables.handleAssignOrderToCourier({ auth: { uid: "seller1" }, data: { orderId: "o1", courierId: "c1" } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("muvaffaqiyatli: status 'processing'da QOLADI ('assigned', kuryer hali boshlamagan), 2 tugmali xabar yuboriladi", async () => {
    const db = buildMockDb({
      orders: {
        o1: {
          sellerId: "seller1", status: "processing",
          customer: { fullName: "Vali", paymentTypes: ["cod"] },
          orders: [{ name: "Krem", quantity: 2 }], totalAmount: 50000,
        },
      },
      couriers: { c1: { sellerId: "seller1", status: "active", name: "Aziz", phone: "+998901112233" } },
    });
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const couriers = loadCouriersModule({ db, sendTelegramMessageMock });

    const result = await couriers._testables.handleAssignOrderToCourier({ auth: { uid: "seller1" }, data: { orderId: "o1", courierId: "c1" } });

    expect(result.success).toBe(true);
    expect(db.__orderUpdates.o1.status).toBeUndefined();
    expect(db.__orderUpdates.o1.courierId).toBe("c1");
    expect(db.__orderUpdates.o1.courierName).toBe("Aziz");
    expect(db.__orderUpdates.o1.courierPhone).toBe("+998901112233");
    expect(db.__orderUpdates.o1.courierDeliveryStatus).toBe("assigned");
    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    const [token, chatId, text, opts] = sendTelegramMessageMock.mock.calls[0];
    expect(token).toBe("courier-token");
    expect(chatId).toBe("c1");
    expect(text).toContain("Naqd to'lov");
    expect(opts.inlineKeyboard).toHaveLength(2);
    expect(opts.inlineKeyboard[0][0].callback_data).toBe("cor:picked_up:o1");
    expect(opts.inlineKeyboard[1][0].callback_data).toBe("cor:declined:o1");
  });

  test("allaqachon (boshqa kuryerga) biriktirilgan, hali boshlanmagan buyurtmani qayta biriktirib bo'lmaydi", async () => {
    const db = buildMockDb({
      orders: { o1: { sellerId: "seller1", status: "processing", courierId: "c-old", courierDeliveryStatus: "assigned" } },
      couriers: { c1: { sellerId: "seller1", status: "active", name: "Aziz" } },
    });
    const couriers = loadCouriersModule({ db });
    await expect(
      couriers._testables.handleAssignOrderToCourier({ auth: { uid: "seller1" }, data: { orderId: "o1", courierId: "c1" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("kuryerga Telegram xabari yuborilmasa ham (tarmoq xatosi), topshiriq BEKOR QILINMAYDI", async () => {
    const db = buildMockDb({
      orders: { o1: { sellerId: "seller1", status: "processing", customer: {}, orders: [], totalAmount: 0 } },
      couriers: { c1: { sellerId: "seller1", status: "active", name: "Aziz" } },
    });
    const sendTelegramMessageMock = jest.fn().mockRejectedValue(new Error("tarmoq xatosi"));
    const couriers = loadCouriersModule({ db, sendTelegramMessageMock });

    const result = await couriers._testables.handleAssignOrderToCourier({ auth: { uid: "seller1" }, data: { orderId: "o1", courierId: "c1" } });

    expect(result.success).toBe(true);
    expect(db.__orderUpdates.o1.courierDeliveryStatus).toBe("assigned");
  });

  // YANGI (2026-09 punkt-royxati, 3/10-bandlar): `manageCouriers`
  // ruxsatiga ega xodim ham, sotuvchining o'zi kabi, buyurtmani
  // kuryerga topshira olishi kerak.
  test("`manageCouriers` ruxsatiga ega FAOL xodim ham buyurtmani kuryerga topshira oladi", async () => {
    const db = buildMockDb({
      orders: { o1: { sellerId: "seller1", status: "processing", customer: {}, orders: [], totalAmount: 0 } },
      couriers: { c1: { sellerId: "seller1", status: "active", name: "Aziz" } },
      staff: { staff1: { sellerId: "seller1", status: "active", permissions: { manageCouriers: true } } },
    });
    const couriers = loadCouriersModule({ db });
    const result = await couriers._testables.handleAssignOrderToCourier({ auth: { uid: "staff1" }, data: { orderId: "o1", courierId: "c1" } });
    expect(result.success).toBe(true);
    expect(db.__orderUpdates.o1.courierId).toBe("c1");
  });

  test("`manageCouriers` ruxsati YO'Q xodim buyurtmani kuryerga topshira olmaydi", async () => {
    const db = buildMockDb({
      orders: { o1: { sellerId: "seller1", status: "processing" } },
      couriers: { c1: { sellerId: "seller1", status: "active" } },
      staff: { staff1: { sellerId: "seller1", status: "active", permissions: { manageOrders: true } } },
    });
    const couriers = loadCouriersModule({ db });
    await expect(
      couriers._testables.handleAssignOrderToCourier({ auth: { uid: "staff1" }, data: { orderId: "o1", courierId: "c1" } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("faolsizlantirilgan xodim (ruxsati bo'lsa ham) buyurtmani kuryerga topshira olmaydi", async () => {
    const db = buildMockDb({
      orders: { o1: { sellerId: "seller1", status: "processing" } },
      couriers: { c1: { sellerId: "seller1", status: "active" } },
      staff: { staff1: { sellerId: "seller1", status: "inactive", permissions: { manageCouriers: true } } },
    });
    const couriers = loadCouriersModule({ db });
    await expect(
      couriers._testables.handleAssignOrderToCourier({ auth: { uid: "staff1" }, data: { orderId: "o1", courierId: "c1" } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  // XAVFSIZLIK (P1 fix, 2026-09 audit): bu funksiya umumiy
  // `COURIER_BOT_TOKEN` orqali Telegram'ga xabar yuboradi — oldin
  // rate-limit yo'q edi ("noisy neighbor": bitta sotuvchi umumiy botning
  // Telegram chegarasini tugatib, BOSHQA sotuvchilarga ham ta'sir
  // qilishi mumkin edi). `sellerId` bo'yicha (aniq xodim uid'i bo'yicha
  // EMAS — bir nechta xodim chegarani ko'paytirib yubormasligi uchun).
  test("do'kon EGASI bo'yicha rate-limit tekshiradi", async () => {
    const checkRateLimitMock = jest.fn().mockResolvedValue(undefined);
    const db = buildMockDb({
      orders: { o1: { sellerId: "seller1", status: "processing", customer: {}, orders: [], totalAmount: 0 } },
      couriers: { c1: { sellerId: "seller1", status: "active", name: "Aziz" } },
    });
    const couriers = loadCouriersModule({ db, checkRateLimitMock });
    await couriers._testables.handleAssignOrderToCourier({ auth: { uid: "seller1" }, data: { orderId: "o1", courierId: "c1" } });
    expect(checkRateLimitMock).toHaveBeenCalledWith("assignOrderToCourier:seller1", expect.any(Number), expect.any(Number));
  });

  test("XODIM chaqirganda ham, rate-limit HAQIQIY do'kon EGASI (sellerId) bo'yicha hisoblanadi — xodim uid'i bo'yicha EMAS", async () => {
    const checkRateLimitMock = jest.fn().mockResolvedValue(undefined);
    const db = buildMockDb({
      orders: { o1: { sellerId: "seller1", status: "processing", customer: {}, orders: [], totalAmount: 0 } },
      couriers: { c1: { sellerId: "seller1", status: "active", name: "Aziz" } },
      staff: { staff1: { sellerId: "seller1", status: "active", permissions: { manageCouriers: true } } },
    });
    const couriers = loadCouriersModule({ db, checkRateLimitMock });
    await couriers._testables.handleAssignOrderToCourier({ auth: { uid: "staff1" }, data: { orderId: "o1", courierId: "c1" } });
    expect(checkRateLimitMock).toHaveBeenCalledWith("assignOrderToCourier:seller1", expect.any(Number), expect.any(Number));
  });

  test("rate-limit oshib ketgan bo'lsa, buyurtma O'ZGARTIRILMASDAN rad etiladi", async () => {
    const { HttpsError } = require("firebase-functions/v2/https");
    const checkRateLimitMock = jest.fn().mockRejectedValue(new HttpsError("resource-exhausted", "Juda ko'p so'rov."));
    const db = buildMockDb({
      orders: { o1: { sellerId: "seller1", status: "processing" } },
      couriers: { c1: { sellerId: "seller1", status: "active", name: "Aziz" } },
    });
    const couriers = loadCouriersModule({ db, checkRateLimitMock });
    await expect(
      couriers._testables.handleAssignOrderToCourier({ auth: { uid: "seller1" }, data: { orderId: "o1", courierId: "c1" } })
    ).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(db.__orderUpdates.o1).toBeUndefined();
  });
});

describe("handleUpdateCourierOrderStatus — Mini App'dan (kuryer o'zi) chaqiriladigan onCall", () => {
  test("autentifikatsiyasiz rad etiladi", async () => {
    const couriers = loadCouriersModule({ db: buildMockDb({}) });
    await expect(
      couriers._testables.handleUpdateCourierOrderStatus({ auth: null, data: { orderId: "o1", action: "picked_up" } })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  // XAVFSIZLIK (P1 fix, 2026-09 audit): bu — Mini App'dan TO'G'RIDAN-
  // TO'G'RI chaqiriladigan yagona yo'l (Telegram inline tugma orqali
  // chaqiriladigan `courierBot.js`dagi webhook'dan FARQLI, u boshqa
  // himoya qatlamiga ega) — shuning uchun aynan SHU YERDA, chaqiruvchi
  // KURYER bo'yicha rate-limit qo'shildi.
  test("chaqiruvchi kuryer bo'yicha rate-limit tekshiradi", async () => {
    const checkRateLimitMock = jest.fn().mockResolvedValue(undefined);
    const db = buildMockDb({
      orders: { o1: { sellerId: "seller1", courierId: "c1", courierDeliveryStatus: "assigned", status: "processing" } },
    });
    const couriers = loadCouriersModule({ db, checkRateLimitMock });
    await couriers._testables.handleUpdateCourierOrderStatus({ auth: { uid: "c1" }, data: { orderId: "o1", action: "picked_up" } });
    expect(checkRateLimitMock).toHaveBeenCalledWith("updateCourierOrderStatus:c1", expect.any(Number), expect.any(Number));
  });

  test("rate-limit oshib ketgan bo'lsa, buyurtma holati O'ZGARTIRILMASDAN rad etiladi", async () => {
    const { HttpsError } = require("firebase-functions/v2/https");
    const checkRateLimitMock = jest.fn().mockRejectedValue(new HttpsError("resource-exhausted", "Juda ko'p so'rov."));
    const db = buildMockDb({
      orders: { o1: { sellerId: "seller1", courierId: "c1", courierDeliveryStatus: "assigned", status: "processing" } },
    });
    const couriers = loadCouriersModule({ db, checkRateLimitMock });
    await expect(
      couriers._testables.handleUpdateCourierOrderStatus({ auth: { uid: "c1" }, data: { orderId: "o1", action: "picked_up" } })
    ).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(db.__orderUpdates.o1).toBeUndefined();
  });
});

describe("applyCourierOrderAction — bot VA Mini App IKKALASI HAM ishlatadigan asosiy mantiq", () => {
  test("noma'lum amal — invalid-argument", async () => {
    const couriers = loadCouriersModule({ db: buildMockDb({}) });
    await expect(
      couriers._testables.applyCourierOrderAction({ courierId: "c1", orderId: "o1", action: "unknown" })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("buyurtma topilmasa — not-found", async () => {
    const couriers = loadCouriersModule({ db: buildMockDb({}) });
    await expect(
      couriers._testables.applyCourierOrderAction({ courierId: "c1", orderId: "missing", action: "delivered" })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  test("boshqa kuryerga biriktirilgan buyurtmani o'zgartira olmaydi", async () => {
    const db = buildMockDb({ orders: { o1: { sellerId: "s1", courierId: "c2" } } });
    const couriers = loadCouriersModule({ db });
    await expect(
      couriers._testables.applyCourierOrderAction({ courierId: "c1", orderId: "o1", action: "delivered" })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("'delivered' — order.status HAM 'delivered'ga o'tadi, sotuvchiga xabar boradi", async () => {
    const db = buildMockDb({
      orders: { o1: { sellerId: "s1", courierId: "c1", status: "shipped" } },
      couriers: { c1: { name: "Aziz" } },
    });
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const couriers = loadCouriersModule({ db, sendTelegramMessageMock });

    const result = await couriers._testables.applyCourierOrderAction({ courierId: "c1", orderId: "o1", action: "delivered" });

    expect(result.status).toBe("delivered");
    expect(db.__orderUpdates.o1.status).toBe("delivered");
    expect(db.__orderUpdates.o1.courierDeliveryStatus).toBe("delivered");
    expect(sendTelegramMessageMock).toHaveBeenCalledWith("platform-token", "s1", expect.stringContaining("Yetkazildi"));
  });

  test("'picked_up' — order.status ENDI 'shipped'ga o'tadi (kuryer HAQIQATAN boshlagan), mijozga kuzatuv havolasi avtomatik boradi", async () => {
    const db = buildMockDb({
      orders: { o1: { sellerId: "s1", clientId: "client1", courierId: "c1", courierDeliveryStatus: "assigned", status: "processing" } },
      couriers: { c1: { name: "Aziz" } },
    });
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const couriers = loadCouriersModule({ db, sendTelegramMessageMock });

    const result = await couriers._testables.applyCourierOrderAction({ courierId: "c1", orderId: "o1", action: "picked_up" });

    expect(result.status).toBe("shipped");
    expect(db.__orderUpdates.o1.status).toBe("shipped");
    expect(db.__orderUpdates.o1.courierDeliveryStatus).toBe("picked_up");
    // UCHTA xabar: (1) sotuvchiga holat bildirishnomasi, (2) mijozga
    // kuzatuv havolasi, (3) YANGI (v39.5) kuryerga jonli joylashuvni
    // yoqish TAVSIYASI - HAMMASI avtomatik, alohida chaqiruv shart emas.
    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(3);
    expect(sendTelegramMessageMock).toHaveBeenCalledWith("platform-token", "s1", expect.any(String));
    const clientCall = sendTelegramMessageMock.mock.calls.find((c) => c[1] === "client1");
    expect(clientCall).toBeDefined();
    expect(clientCall[3].buttonUrl).toContain("/orders/o1/track");
    const courierTipCall = sendTelegramMessageMock.mock.calls.find((c) => c[0] === "courier-token" && c[1] === "c1");
    expect(courierTipCall).toBeDefined();
    expect(courierTipCall[2]).toContain("Jonli joylashuv");
  });

  test("'picked_up' — sotuvchida shaxsiy bot ULANGAN bo'lsa, mijozga kuzatuv havolasi O'SHA bot orqali yuboriladi (v39.6)", async () => {
    const db = buildMockDb({
      orders: { o1: { sellerId: "s1", clientId: "client1", courierId: "c1", courierDeliveryStatus: "assigned", status: "processing" } },
      couriers: { c1: { name: "Aziz" } },
      customerBotTokens: { s1: "sellers-own-bot-token" },
    });
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const couriers = loadCouriersModule({ db, sendTelegramMessageMock });

    await couriers._testables.applyCourierOrderAction({ courierId: "c1", orderId: "o1", action: "picked_up" });

    const clientCall = sendTelegramMessageMock.mock.calls.find((c) => c[1] === "client1");
    expect(clientCall).toBeDefined();
    // Sotuvchiga (platforma boti, "s1") va kuryerga (kuryer boti,
    // "c1") ketadigan xabarlar ESKICHA qoladi — FAQAT mijozga
    // ketadigan xabar sotuvchining shaxsiy botiga o'tadi.
    expect(clientCall[0]).toBe("sellers-own-bot-token");
  });

  test("'picked_up' — kuryerda ALLAQACHON boshqa 'picked_up' yetkazma bo'lsa, rad etiladi", async () => {
    const db = buildMockDb({
      orders: {
        o1: { sellerId: "s1", courierId: "c1", courierDeliveryStatus: "assigned", status: "processing" },
        o2: { sellerId: "s1", courierId: "c1", courierDeliveryStatus: "picked_up", status: "shipped" },
      },
      couriers: { c1: { name: "Aziz" } },
    });
    const couriers = loadCouriersModule({ db });
    await expect(
      couriers._testables.applyCourierOrderAction({ courierId: "c1", orderId: "o1", action: "picked_up" })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("'declined' — FAQAT 'assigned' bosqichida ruxsat, kuryer maydonlari tozalanadi, status o'zgarmaydi", async () => {
    const db = buildMockDb({
      orders: { o1: { sellerId: "s1", courierId: "c1", courierName: "Aziz", courierDeliveryStatus: "assigned", status: "processing" } },
      couriers: { c1: { name: "Aziz" } },
    });
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const couriers = loadCouriersModule({ db, sendTelegramMessageMock });

    const result = await couriers._testables.applyCourierOrderAction({ courierId: "c1", orderId: "o1", action: "declined" });

    expect(result.success).toBe(true);
    expect(db.__orderUpdates.o1.status).toBeUndefined();
    expect(db.__orderUpdates.o1.courierId).toBe("MOCK_DELETE");
    expect(db.__orderUpdates.o1.courierDeliveryStatus).toBe("MOCK_DELETE");
    expect(sendTelegramMessageMock).toHaveBeenCalledWith("platform-token", "s1", expect.stringContaining("rad etdi"));
  });

  test("'declined' — allaqachon 'picked_up' bosqichda bo'lsa rad etiladi (orqaga qaytarib bo'lmaydi)", async () => {
    const db = buildMockDb({
      orders: { o1: { sellerId: "s1", courierId: "c1", courierDeliveryStatus: "picked_up", status: "shipped" } },
      couriers: { c1: { name: "Aziz" } },
    });
    const couriers = loadCouriersModule({ db });
    await expect(
      couriers._testables.applyCourierOrderAction({ courierId: "c1", orderId: "o1", action: "declined" })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("sotuvchiga xabar yuborishda xato bo'lsa ham, funksiya MUVAFFAQIYATLI qaytadi", async () => {
    const db = buildMockDb({
      orders: { o1: { sellerId: "s1", courierId: "c1", status: "shipped" } },
      couriers: { c1: { name: "Aziz" } },
    });
    const couriers = loadCouriersModule({ db, sendTelegramMessageMock: jest.fn().mockRejectedValue(new Error("xato")) });

    await expect(
      couriers._testables.applyCourierOrderAction({ courierId: "c1", orderId: "o1", action: "failed" })
    ).resolves.toMatchObject({ success: true });
  });

  test("'delivered' — jonli joylashuv AYNAN 'custom' bot orqali yuborilgan bo'lsa, to'xtatish HAM O'SHA (shaxsiy) bot orqali amalga oshadi (v39.6)", async () => {
    const db = buildMockDb({
      orders: {
        o1: {
          sellerId: "s1", clientId: "client1", courierId: "c1", status: "shipped",
          courierLiveLocationMessageId: 555, courierLiveLocationBotSource: "custom",
        },
      },
      couriers: { c1: { name: "Aziz" } },
      customerBotTokens: { s1: "sellers-own-bot-token" },
    });
    const stopTelegramLiveLocationMock = jest.fn().mockResolvedValue(undefined);
    const couriers = loadCouriersModule({ db, stopTelegramLiveLocationMock });

    await couriers._testables.applyCourierOrderAction({ courierId: "c1", orderId: "o1", action: "delivered" });

    expect(stopTelegramLiveLocationMock).toHaveBeenCalledWith("sellers-own-bot-token", "client1", 555);
    expect(db.__orderUpdates.o1.courierLiveLocationMessageId).toBe("MOCK_DELETE");
    expect(db.__orderUpdates.o1.courierLiveLocationBotSource).toBe("MOCK_DELETE");
  });

  test("'delivered' — jonli joylashuv 'platform' bot orqali yuborilgan bo'lsa (sotuvchida shaxsiy bot ULANGAN bo'lsa ham), to'xtatish platforma boti orqali amalga oshadi", async () => {
    const db = buildMockDb({
      orders: {
        o1: {
          sellerId: "s1", clientId: "client1", courierId: "c1", status: "shipped",
          courierLiveLocationMessageId: 555, courierLiveLocationBotSource: "platform",
        },
      },
      couriers: { c1: { name: "Aziz" } },
      // Sotuvchida ENDI shaxsiy bot ulangan bo'lsa ham (masalan
      // shaxsiy bot yetkazma BOSHLANGANDAN keyin ulangan) — bu
      // xabar ALLAQACHON platforma boti orqali yuborilgan, shuning
      // uchun to'xtatish HAM albatta platforma boti orqali bo'lishi
      // kerak (`courierLiveLocationBotSource` belgisiga qarab).
      customerBotTokens: { s1: "sellers-own-bot-token" },
    });
    const stopTelegramLiveLocationMock = jest.fn().mockResolvedValue(undefined);
    const couriers = loadCouriersModule({ db, stopTelegramLiveLocationMock });

    await couriers._testables.applyCourierOrderAction({ courierId: "c1", orderId: "o1", action: "delivered" });

    expect(stopTelegramLiveLocationMock).toHaveBeenCalledWith("platform-token", "client1", 555);
  });
});

describe("handleResendTrackingLink", () => {
  test("faqat egasi, va faqat 'picked_up' bosqichida qayta yuborishi mumkin", async () => {
    const db = buildMockDb({ orders: { o1: { sellerId: "seller1", clientId: "client1", courierDeliveryStatus: "assigned" } } });
    const couriers = loadCouriersModule({ db });
    await expect(
      couriers._testables.handleResendTrackingLink({ auth: { uid: "seller1" }, data: { orderId: "o1" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("boshqa sotuvchi qayta yubora olmaydi", async () => {
    const db = buildMockDb({ orders: { o1: { sellerId: "seller-other", courierDeliveryStatus: "picked_up" } } });
    const couriers = loadCouriersModule({ db });
    await expect(
      couriers._testables.handleResendTrackingLink({ auth: { uid: "seller1" }, data: { orderId: "o1" } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("muvaffaqiyatli — mijozga havola qayta yuboriladi (sotuvchida shaxsiy bot yo'q — platforma boti ishlatiladi)", async () => {
    const db = buildMockDb({ orders: { o1: { sellerId: "seller1", clientId: "client1", courierDeliveryStatus: "picked_up" } } });
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const couriers = loadCouriersModule({ db, sendTelegramMessageMock });
    const result = await couriers._testables.handleResendTrackingLink({ auth: { uid: "seller1" }, data: { orderId: "o1" } });
    expect(result.success).toBe(true);
    expect(sendTelegramMessageMock).toHaveBeenCalledWith("platform-token", "client1", expect.any(String), expect.any(Object));
  });

  test("muvaffaqiyatli — sotuvchida shaxsiy bot ULANGAN bo'lsa, havola O'SHA bot orqali qayta yuboriladi (v39.6)", async () => {
    const db = buildMockDb({
      orders: { o1: { sellerId: "seller1", clientId: "client1", courierDeliveryStatus: "picked_up" } },
      customerBotTokens: { seller1: "sellers-own-bot-token" },
    });
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const couriers = loadCouriersModule({ db, sendTelegramMessageMock });
    const result = await couriers._testables.handleResendTrackingLink({ auth: { uid: "seller1" }, data: { orderId: "o1" } });
    expect(result.success).toBe(true);
    expect(sendTelegramMessageMock).toHaveBeenCalledWith("sellers-own-bot-token", "client1", expect.any(String), expect.any(Object));
  });

  test("`manageCouriers` ruxsatiga ega xodim ham kuzatuv havolasini qayta yubora oladi", async () => {
    const db = buildMockDb({
      orders: { o1: { sellerId: "seller1", clientId: "client1", courierDeliveryStatus: "picked_up" } },
      staff: { staff1: { sellerId: "seller1", status: "active", permissions: { manageCouriers: true } } },
    });
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const couriers = loadCouriersModule({ db, sendTelegramMessageMock });
    const result = await couriers._testables.handleResendTrackingLink({ auth: { uid: "staff1" }, data: { orderId: "o1" } });
    expect(result.success).toBe(true);
  });

  // XAVFSIZLIK (P1 fix, 2026-09 audit): mijozga Telegram orqali xabar
  // yuboradi — oldin rate-limit yo'q edi.
  test("do'kon EGASI bo'yicha rate-limit tekshiradi", async () => {
    const checkRateLimitMock = jest.fn().mockResolvedValue(undefined);
    const db = buildMockDb({ orders: { o1: { sellerId: "seller1", clientId: "client1", courierDeliveryStatus: "picked_up" } } });
    const couriers = loadCouriersModule({ db, checkRateLimitMock });
    await couriers._testables.handleResendTrackingLink({ auth: { uid: "seller1" }, data: { orderId: "o1" } });
    expect(checkRateLimitMock).toHaveBeenCalledWith("resendCourierTrackingLink:seller1", expect.any(Number), expect.any(Number));
  });

  test("rate-limit oshib ketgan bo'lsa, mijozga xabar YUBORILMASDAN rad etiladi", async () => {
    const { HttpsError } = require("firebase-functions/v2/https");
    const checkRateLimitMock = jest.fn().mockRejectedValue(new HttpsError("resource-exhausted", "Juda ko'p so'rov."));
    const db = buildMockDb({ orders: { o1: { sellerId: "seller1", clientId: "client1", courierDeliveryStatus: "picked_up" } } });
    const sendTelegramMessageMock = jest.fn();
    const couriers = loadCouriersModule({ db, checkRateLimitMock, sendTelegramMessageMock });
    await expect(
      couriers._testables.handleResendTrackingLink({ auth: { uid: "seller1" }, data: { orderId: "o1" } })
    ).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(sendTelegramMessageMock).not.toHaveBeenCalled();
  });
});

describe("handleUpdateCourierLocation", () => {
  test("faqat biriktirilgan kuryer, va faqat 'picked_up' bosqichida joylashuvni yangilaydi", async () => {
    const db = buildMockDb({ orders: { o1: { courierId: "c1", courierDeliveryStatus: "assigned" } } });
    const couriers = loadCouriersModule({ db });
    await expect(
      couriers._testables.handleUpdateCourierLocation({ auth: { uid: "c1" }, data: { orderId: "o1", lat: 41.3, lng: 69.2 } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("boshqa kuryer joylashuvni o'zgartira olmaydi", async () => {
    const db = buildMockDb({ orders: { o1: { courierId: "c1", courierDeliveryStatus: "picked_up" } } });
    const couriers = loadCouriersModule({ db });
    await expect(
      couriers._testables.handleUpdateCourierLocation({ auth: { uid: "c2" }, data: { orderId: "o1", lat: 41.3, lng: 69.2 } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("muvaffaqiyatli — joylashuv buyurtma hujjatiga yoziladi", async () => {
    const db = buildMockDb({ orders: { o1: { courierId: "c1", courierDeliveryStatus: "picked_up" } } });
    const couriers = loadCouriersModule({ db });
    const result = await couriers._testables.handleUpdateCourierLocation({ auth: { uid: "c1" }, data: { orderId: "o1", lat: 41.3111, lng: 69.2401 } });
    expect(result.success).toBe(true);
    expect(db.__orderUpdates.o1.courierLocation.lat).toBe(41.3111);
    expect(db.__orderUpdates.o1.courierLocation.lng).toBe(69.2401);
  });

  test("clientId bo'lsa — mijozga YANGI jonli joylashuv pufakchasi yuboriladi va ID saqlanadi", async () => {
    const db = buildMockDb({ orders: { o1: { courierId: "c1", clientId: "client1", courierDeliveryStatus: "picked_up" } } });
    const sendTelegramLiveLocationMock = jest.fn().mockResolvedValue(777);
    const couriers = loadCouriersModule({ db, sendTelegramLiveLocationMock });
    await couriers._testables.handleUpdateCourierLocation({ auth: { uid: "c1" }, data: { orderId: "o1", lat: 41.3, lng: 69.2 } });
    expect(sendTelegramLiveLocationMock).toHaveBeenCalledWith("platform-token", "client1", 41.3, 69.2, couriers._testables.LIVE_LOCATION_PERIOD_SECONDS);
    expect(db.__orderUpdates.o1.courierLiveLocationMessageId).toBe(777);
  });
});

describe("writeCourierLocationAndNotifyClient — mijozga NATIV jonli joylashuv pufakchasi", () => {
  test("clientId bo'lmasa — Telegram funksiyalari UMUMAN chaqirilmaydi", async () => {
    const db = buildMockDb({ orders: { o1: { courierId: "c1", courierDeliveryStatus: "picked_up" } } });
    const sendTelegramLiveLocationMock = jest.fn();
    const editTelegramLiveLocationMock = jest.fn();
    const couriers = loadCouriersModule({ db, sendTelegramLiveLocationMock, editTelegramLiveLocationMock });
    const orderRef = db.collection("orders").doc("o1");
    await couriers._testables.writeCourierLocationAndNotifyClient(orderRef, { courierId: "c1" }, "o1", 1, 2);
    expect(sendTelegramLiveLocationMock).not.toHaveBeenCalled();
    expect(editTelegramLiveLocationMock).not.toHaveBeenCalled();
    expect(db.__orderUpdates.o1.courierLocation.lat).toBe(1);
  });

  test("courierLiveLocationMessageId ALLAQACHON mavjud bo'lsa — YANGI xabar EMAS, TAHRIRLANADI", async () => {
    const db = buildMockDb({ orders: { o1: { courierId: "c1", clientId: "client1", courierLiveLocationMessageId: 999 } } });
    const sendTelegramLiveLocationMock = jest.fn();
    const editTelegramLiveLocationMock = jest.fn().mockResolvedValue(undefined);
    const couriers = loadCouriersModule({ db, sendTelegramLiveLocationMock, editTelegramLiveLocationMock });
    const orderRef = db.collection("orders").doc("o1");
    await couriers._testables.writeCourierLocationAndNotifyClient(orderRef, { clientId: "client1", courierLiveLocationMessageId: 999 }, "o1", 3, 4);
    expect(sendTelegramLiveLocationMock).not.toHaveBeenCalled();
    expect(editTelegramLiveLocationMock).toHaveBeenCalledWith("platform-token", "client1", 999, 3, 4);
  });

  test("Telegramga xabar yuborishda xato bo'lsa ham, funksiya XATO TASHLAMAYDI (Firestore yozuvi allaqachon saqlangan)", async () => {
    const db = buildMockDb({ orders: { o1: { courierId: "c1", clientId: "client1" } } });
    const sendTelegramLiveLocationMock = jest.fn().mockRejectedValue(new Error("tarmoq xatosi"));
    const couriers = loadCouriersModule({ db, sendTelegramLiveLocationMock });
    const orderRef = db.collection("orders").doc("o1");
    await expect(
      couriers._testables.writeCourierLocationAndNotifyClient(orderRef, { clientId: "client1" }, "o1", 5, 6)
    ).resolves.toBeUndefined();
    expect(db.__orderUpdates.o1.courierLocation.lat).toBe(5);
  });

  test("YANGI pufakcha — sotuvchida shaxsiy bot ULANGAN bo'lsa, O'SHA bot orqali yuboriladi va botSource='custom' saqlanadi (v39.6)", async () => {
    const db = buildMockDb({
      orders: { o1: { sellerId: "s1", courierId: "c1", clientId: "client1" } },
      customerBotTokens: { s1: "sellers-own-bot-token" },
    });
    const sendTelegramLiveLocationMock = jest.fn().mockResolvedValue(777);
    const couriers = loadCouriersModule({ db, sendTelegramLiveLocationMock });
    const orderRef = db.collection("orders").doc("o1");
    await couriers._testables.writeCourierLocationAndNotifyClient(orderRef, { sellerId: "s1", clientId: "client1" }, "o1", 5, 6);
    expect(sendTelegramLiveLocationMock).toHaveBeenCalledTimes(1);
    expect(sendTelegramLiveLocationMock).toHaveBeenCalledWith(
      "sellers-own-bot-token", "client1", 5, 6, couriers._testables.LIVE_LOCATION_PERIOD_SECONDS
    );
    expect(db.__orderUpdates.o1.courierLiveLocationMessageId).toBe(777);
    expect(db.__orderUpdates.o1.courierLiveLocationBotSource).toBe("custom");
  });

  test("YANGI pufakcha — shaxsiy bot orqali yuborish muvaffaqiyatsiz bo'lsa (null qaytarsa), platforma botiga ZAXIRA sifatida o'tiladi, botSource='platform' saqlanadi", async () => {
    const db = buildMockDb({
      orders: { o1: { sellerId: "s1", courierId: "c1", clientId: "client1" } },
      customerBotTokens: { s1: "sellers-own-bot-token" },
    });
    const sendTelegramLiveLocationMock = jest.fn()
      .mockResolvedValueOnce(null) // shaxsiy bot - muvaffaqiyatsiz ("chat not found" kabi)
      .mockResolvedValueOnce(888); // platforma boti - zaxira, muvaffaqiyatli
    const couriers = loadCouriersModule({ db, sendTelegramLiveLocationMock });
    const orderRef = db.collection("orders").doc("o1");
    await couriers._testables.writeCourierLocationAndNotifyClient(orderRef, { sellerId: "s1", clientId: "client1" }, "o1", 5, 6);
    expect(sendTelegramLiveLocationMock).toHaveBeenCalledTimes(2);
    expect(sendTelegramLiveLocationMock).toHaveBeenNthCalledWith(
      1, "sellers-own-bot-token", "client1", 5, 6, couriers._testables.LIVE_LOCATION_PERIOD_SECONDS
    );
    expect(sendTelegramLiveLocationMock).toHaveBeenNthCalledWith(
      2, "platform-token", "client1", 5, 6, couriers._testables.LIVE_LOCATION_PERIOD_SECONDS
    );
    expect(db.__orderUpdates.o1.courierLiveLocationMessageId).toBe(888);
    expect(db.__orderUpdates.o1.courierLiveLocationBotSource).toBe("platform");
  });

  test("TAHRIRLASH — courierLiveLocationBotSource='custom' bo'lsa, sotuvchining shaxsiy boti QAYTA o'qilib ishlatiladi (hatto boshqa custom token endi mavjud bo'lsa ham)", async () => {
    const db = buildMockDb({
      orders: { o1: { sellerId: "s1", courierId: "c1", clientId: "client1", courierLiveLocationMessageId: 999, courierLiveLocationBotSource: "custom" } },
      customerBotTokens: { s1: "sellers-own-bot-token" },
    });
    const editTelegramLiveLocationMock = jest.fn().mockResolvedValue(undefined);
    const couriers = loadCouriersModule({ db, editTelegramLiveLocationMock });
    const orderRef = db.collection("orders").doc("o1");
    await couriers._testables.writeCourierLocationAndNotifyClient(
      orderRef,
      { sellerId: "s1", clientId: "client1", courierLiveLocationMessageId: 999, courierLiveLocationBotSource: "custom" },
      "o1", 3, 4
    );
    expect(editTelegramLiveLocationMock).toHaveBeenCalledWith("sellers-own-bot-token", "client1", 999, 3, 4);
  });
});

describe("handleCourierLiveLocationUpdate — Telegramning O'ZINING jonli joylashuv relesi", () => {
  test("kuryerning HOZIR 'picked_up' buyurtmasi bo'lmasa — JIM (xatosiz) qaytadi", async () => {
    const db = buildMockDb({ orders: { o1: { courierId: "c1", courierDeliveryStatus: "assigned" } } });
    const couriers = loadCouriersModule({ db });
    await expect(
      couriers._testables.handleCourierLiveLocationUpdate({ courierId: "c1", lat: 1, lng: 2 })
    ).resolves.toBeUndefined();
    expect(db.__orderUpdates.o1).toBeUndefined();
  });

  test("mos 'picked_up' buyurtma topilsa — joylashuv O'SHA buyurtmaga yoziladi", async () => {
    const db = buildMockDb({
      orders: {
        o1: { courierId: "c1", courierDeliveryStatus: "assigned" },
        o2: { courierId: "c1", clientId: "client1", courierDeliveryStatus: "picked_up" },
      },
    });
    const couriers = loadCouriersModule({ db });
    await couriers._testables.handleCourierLiveLocationUpdate({ courierId: "c1", lat: 41.3, lng: 69.2 });
    expect(db.__orderUpdates.o2.courierLocation.lat).toBe(41.3);
    expect(db.__orderUpdates.o1).toBeUndefined();
  });

  test("courierId yoki koordinatalar noto'g'ri bo'lsa — hech narsa qilmaydi (Firestore'ga so'rov ham yubormaydi)", async () => {
    const db = buildMockDb({});
    const couriers = loadCouriersModule({ db });
    await expect(couriers._testables.handleCourierLiveLocationUpdate({ courierId: null, lat: 1, lng: 2 })).resolves.toBeUndefined();
    await expect(couriers._testables.handleCourierLiveLocationUpdate({ courierId: "c1", lat: "1", lng: 2 })).resolves.toBeUndefined();
  });
});

describe("applyCourierOrderAction — yakunlanganda jonli joylashuv pufakchasini TO'XTATISH (v39.5)", () => {
  test("'delivered' — courierLiveLocationMessageId mavjud bo'lsa, stopTelegramLiveLocation chaqiriladi va maydon o'chiriladi", async () => {
    const db = buildMockDb({
      orders: { o1: { sellerId: "s1", clientId: "client1", courierId: "c1", status: "shipped", courierLiveLocationMessageId: 42 } },
      couriers: { c1: { name: "Aziz" } },
    });
    const stopTelegramLiveLocationMock = jest.fn().mockResolvedValue(undefined);
    const couriers = loadCouriersModule({ db, stopTelegramLiveLocationMock });

    await couriers._testables.applyCourierOrderAction({ courierId: "c1", orderId: "o1", action: "delivered" });

    expect(stopTelegramLiveLocationMock).toHaveBeenCalledWith("platform-token", "client1", 42);
    expect(db.__orderUpdates.o1.courierLiveLocationMessageId).toBe("MOCK_DELETE");
  });

  test("'failed' — HAM xuddi shunday to'xtatiladi", async () => {
    const db = buildMockDb({
      orders: { o1: { sellerId: "s1", clientId: "client1", courierId: "c1", status: "shipped", courierLiveLocationMessageId: 7 } },
      couriers: { c1: { name: "Aziz" } },
    });
    const stopTelegramLiveLocationMock = jest.fn().mockResolvedValue(undefined);
    const couriers = loadCouriersModule({ db, stopTelegramLiveLocationMock });

    await couriers._testables.applyCourierOrderAction({ courierId: "c1", orderId: "o1", action: "failed" });

    expect(stopTelegramLiveLocationMock).toHaveBeenCalledWith("platform-token", "client1", 7);
  });

  test("courierLiveLocationMessageId YO'Q bo'lsa — stopTelegramLiveLocation UMUMAN chaqirilmaydi", async () => {
    const db = buildMockDb({
      orders: { o1: { sellerId: "s1", clientId: "client1", courierId: "c1", status: "shipped" } },
      couriers: { c1: { name: "Aziz" } },
    });
    const stopTelegramLiveLocationMock = jest.fn();
    const couriers = loadCouriersModule({ db, stopTelegramLiveLocationMock });

    await couriers._testables.applyCourierOrderAction({ courierId: "c1", orderId: "o1", action: "delivered" });

    expect(stopTelegramLiveLocationMock).not.toHaveBeenCalled();
  });
});
