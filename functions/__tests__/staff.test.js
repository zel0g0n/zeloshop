/**
 * `staff.js` uchun testlar — sotuvchi tomonidan xodim
 * qo'shish/ruxsat berish/faollashtirish/o'chirish, va xodimning
 * buyurtmani "bitta bosish bilan qabul qilish" (`applyStaffOrderAction`,
 * bot VA Mini App IKKALASI HAM shu funksiyani chaqiradi) mantig'i.
 *
 * Haqiqiy Firestore/Telegram API'ga ULANMAYDI — barchasi taqlid
 * qilingan (mock).
 */

function buildMockDb({ orders = {}, staff = {}, sellers = { seller1: { tariffPlan: "pro" } } } = {}) {
  const orderUpdates = {};
  const staffUpdates = {};
  const staffDeletes = [];
  const inviteSets = {};

  const buildOrderRef = (id) => ({
    get: async () => (orders[id] ? { exists: true, data: () => orders[id] } : { exists: false }),
    update: async (data) => { orderUpdates[id] = { ...(orderUpdates[id] || {}), ...data }; },
  });

  const buildStaffRef = (id) => ({
    get: async () => (staff[id] ? { exists: true, data: () => staff[id] } : { exists: false }),
    update: async (data) => { staffUpdates[id] = { ...(staffUpdates[id] || {}), ...data }; },
    delete: async () => { staffDeletes.push(id); },
  });

  return {
    collection: (name) => {
      if (name === "orders") {
        return { doc: (id) => buildOrderRef(id) };
      }
      if (name === "staff") {
        return {
          doc: (id) => buildStaffRef(id),
          // FAQAT bitta `.where(field, "==", value).get()` ko'rinishini
          // qo'llab-quvvatlaydi (`handleCreateStaffInvite`ning limit
          // tekshiruvi uchun) — `couriers.test.js`dagi bilan bir xil
          // soddalashtirish.
          where: (field, op, value) => ({
            get: async () => {
              if (op !== "==") throw new Error(`Kutilmagan operator: ${op}`);
              const docs = Object.entries(staff)
                .filter(([, data]) => data[field] === value)
                .map(([id, data]) => ({ id, data: () => data, ref: buildStaffRef(id) }));
              return { docs, empty: docs.length === 0, size: docs.length };
            },
          }),
        };
      }
      if (name === "sellers") {
        return {
          doc: (sellerId) => ({
            get: async () => (sellers[sellerId] ? { exists: true, data: () => sellers[sellerId] } : { exists: false }),
            collection: (sub) => {
              if (sub !== "staffInvites") throw new Error(`Kutilmagan quyi kolleksiya: ${sub}`);
              return {
                doc: (token) => ({
                  set: async (data) => { inviteSets[token] = data; },
                }),
              };
            },
          }),
        };
      }
      throw new Error(`Kutilmagan kolleksiya: ${name}`);
    },
    __orderUpdates: orderUpdates,
    __staffUpdates: staffUpdates,
    __staffDeletes: staffDeletes,
    __inviteSets: inviteSets,
  };
}

function loadStaffModule({ db, checkRateLimitMock } = {}) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: { firestore: { FieldValue: { serverTimestamp: () => "MOCK_TS" } } },
    db,
    STAFF_BOT_TOKEN: { value: () => "staff-token" },
  }));
  jest.doMock("../lib/rateLimit", () => ({ checkRateLimit: checkRateLimitMock || jest.fn().mockResolvedValue(undefined) }));
  return require("../staff");
}

describe("SOF funksiyalar", () => {
  const staff = loadStaffModule({ db: buildMockDb({}) });

  test("normalizeStaffPermissions — noto'g'ri/aralash qiymatlarni true/false'ga keltiradi", () => {
    const allFalseExceptProducts = {
      manageProducts: true, manageOrders: false, manageCouriers: false,
      manageCustomers: false, viewFinance: false, manageStaff: false,
    };
    const allFalse = {
      manageProducts: false, manageOrders: false, manageCouriers: false,
      manageCustomers: false, viewFinance: false, manageStaff: false,
    };
    expect(staff._testables.normalizeStaffPermissions({ manageProducts: true, manageOrders: "true" }))
      .toEqual(allFalseExceptProducts);
    expect(staff._testables.normalizeStaffPermissions(null)).toEqual(allFalse);
    expect(staff._testables.normalizeStaffPermissions(undefined)).toEqual(allFalse);
  });

  // YANGI (2026-09 punkt-royxati, 3-band): uchinchi ruxsat -
  // `manageCouriers` (kuryerlarni boshqarish/buyurtmani topshirish).
  test("normalizeStaffPermissions — `manageCouriers`ni ham to'g'ri normallashtiradi", () => {
    expect(staff._testables.normalizeStaffPermissions({ manageCouriers: true }))
      .toEqual({
        manageProducts: false, manageOrders: false, manageCouriers: true,
        manageCustomers: false, viewFinance: false, manageStaff: false,
      });
    expect(staff._testables.normalizeStaffPermissions({ manageCouriers: "true" }))
      .toEqual({
        manageProducts: false, manageOrders: false, manageCouriers: false,
        manageCustomers: false, viewFinance: false, manageStaff: false,
      });
  });

  test("buildStaffInviteLink — to'g'ri bot username bilan havola yasaydi", () => {
    expect(staff._testables.buildStaffInviteLink("seller1_abc123")).toBe(
      `https://t.me/${staff._testables.STAFF_BOT_USERNAME}?start=seller1_abc123`
    );
  });

  test("buildStaffNewOrderMessage — mijoz va summani o'z ichiga oladi", () => {
    const text = staff._testables.buildStaffNewOrderMessage({ customer: { fullName: "Vali" }, totalAmount: 25000 });
    expect(text).toContain("Vali");
    expect(text).toContain("25,000");
  });

  // 2026-09 punkt-royxati, 89-band (bildirishnoma boyitish) + 97-band
  // (yetkazib berish vaqt-oralig'i): xodim ham, sotuvchi kabi, mijoz
  // tanlagan vaqtni bildirishnomaning O'ZIDAN ko'rishi kerak.
  test("buildStaffNewOrderMessage — `deliveryTimeSlot` mavjud bo'lsa, kelishilgan vaqtni ko'rsatadi", () => {
    const text = staff._testables.buildStaffNewOrderMessage({
      customer: { fullName: "Vali" },
      totalAmount: 25000,
      deliveryTimeSlot: { start: Date.UTC(2026, 8, 2, 9, 0, 0), end: Date.UTC(2026, 8, 2, 10, 0, 0) },
    });
    expect(text).toContain("Kelishilgan vaqt:");
    expect(text).toContain("02.09, 14:00–15:00");
  });

  test("buildStaffOrderNotifyKeyboard — 'Buyurtmalarni ochish' (web_app) tugmasi bilan bitta tugma", () => {
    const keyboard = staff._testables.buildStaffOrderNotifyKeyboard("abc123");
    expect(keyboard).toHaveLength(1);
    expect(keyboard[0]).toHaveLength(1);
    expect(keyboard[0][0].text).toContain("Buyurtmalarni ochish");
    expect(keyboard[0][0].web_app.url).toContain("/staff");
  });
});

describe("handleCreateStaffInvite", () => {
  test("auth yo'q bo'lsa unauthenticated", async () => {
    const staff = loadStaffModule({ db: buildMockDb({}) });
    await expect(staff._testables.handleCreateStaffInvite({ data: { name: "Aziz" } }))
      .rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("ism bo'sh bo'lsa invalid-argument", async () => {
    const staff = loadStaffModule({ db: buildMockDb({}) });
    await expect(
      staff._testables.handleCreateStaffInvite({ auth: { uid: "seller1" }, data: { permissions: { manageOrders: true } } })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("hech qanday ruxsat tanlanmasa invalid-argument", async () => {
    const staff = loadStaffModule({ db: buildMockDb({}) });
    await expect(
      staff._testables.handleCreateStaffInvite({ auth: { uid: "seller1" }, data: { name: "Aziz", permissions: {} } })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("faqat `manageCouriers` tanlansa ham YETARLI (kamida bitta ruxsat talabini qanoatlantiradi)", async () => {
    const db = buildMockDb({});
    const staff = loadStaffModule({ db });
    const result = await staff._testables.handleCreateStaffInvite({
      auth: { uid: "seller1" },
      data: { name: "Aziz", permissions: { manageCouriers: true } },
    });
    expect(db.__inviteSets[result.token].permissions).toEqual({
      manageProducts: false, manageOrders: false, manageCouriers: true,
      manageCustomers: false, viewFinance: false, manageStaff: false,
    });
  });

  test("Z-Pro tarifning xodim limitiga (2 ta) yetgan bo'lsa failed-precondition", async () => {
    const db = buildMockDb({
      staff: {
        s1: { sellerId: "seller1" }, s2: { sellerId: "seller1" },
      },
    });
    const staff = loadStaffModule({ db });
    await expect(
      staff._testables.handleCreateStaffInvite({
        auth: { uid: "seller1" },
        data: { name: "Yangi xodim", permissions: { manageOrders: true } },
      })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("Z-Start (bepul) tarifda XODIM UMUMAN qo'sha olmaydi (limit 0)", async () => {
    const db = buildMockDb({ sellers: { seller1: { tariffPlan: "start" } } });
    const staff = loadStaffModule({ db });
    await expect(
      staff._testables.handleCreateStaffInvite({
        auth: { uid: "seller1" },
        data: { name: "Yangi xodim", permissions: { manageOrders: true } },
      })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("Z-Biznes tarifda 5 tagacha xodim qo'shish mumkin (Pro'dan yuqori limit)", async () => {
    const db = buildMockDb({
      sellers: { seller1: { tariffPlan: "biznes" } },
      staff: { s1: { sellerId: "seller1" }, s2: { sellerId: "seller1" }, s3: { sellerId: "seller1" } },
    });
    const staff = loadStaffModule({ db });
    const result = await staff._testables.handleCreateStaffInvite({
      auth: { uid: "seller1" },
      data: { name: "To'rtinchi xodim", permissions: { manageOrders: true } },
    });
    expect(result.token.startsWith("seller1_")).toBe(true);
  });

  test("boshqa sotuvchining xodimlari limitga hisoblanmaydi", async () => {
    const db = buildMockDb({ staff: { s1: { sellerId: "seller-other" }, s2: { sellerId: "seller-other" }, s3: { sellerId: "seller-other" } } });
    const staff = loadStaffModule({ db });
    const result = await staff._testables.handleCreateStaffInvite({
      auth: { uid: "seller1" },
      data: { name: "Aziz", permissions: { manageProducts: true } },
    });
    expect(result.token.startsWith("seller1_")).toBe(true);
  });

  test("token sellerId PREFIKSI bilan yaratiladi, ruxsatlar taklifga yoziladi, havola to'g'ri qaytadi", async () => {
    const db = buildMockDb({});
    const staff = loadStaffModule({ db });
    const result = await staff._testables.handleCreateStaffInvite({
      auth: { uid: "seller1" },
      data: { name: "Aziz", phone: "+998901234567", permissions: { manageProducts: true, manageOrders: false } },
    });
    expect(result.token.startsWith("seller1_")).toBe(true);
    expect(result.inviteLink).toBe(`https://t.me/${staff._testables.STAFF_BOT_USERNAME}?start=${result.token}`);
    expect(db.__inviteSets[result.token].name).toBe("Aziz");
    expect(db.__inviteSets[result.token].permissions).toEqual({
      manageProducts: true, manageOrders: false, manageCouriers: false,
      manageCustomers: false, viewFinance: false, manageStaff: false,
    });
    expect(db.__inviteSets[result.token].used).toBe(false);
  });

  test("rate limit funksiyasi chaqiriladi", async () => {
    const checkRateLimitMock = jest.fn().mockResolvedValue(undefined);
    const staff = loadStaffModule({ db: buildMockDb({}), checkRateLimitMock });
    await staff._testables.handleCreateStaffInvite({
      auth: { uid: "seller1" }, data: { name: "Aziz", permissions: { manageOrders: true } },
    });
    expect(checkRateLimitMock).toHaveBeenCalledWith("createStaffInvite:seller1", 20, 3600);
  });
});

describe("handleSetStaffPermissions", () => {
  test("mavjud bo'lmagan xodim uchun not-found", async () => {
    const staff = loadStaffModule({ db: buildMockDb({}) });
    await expect(
      staff._testables.handleSetStaffPermissions({ auth: { uid: "seller1" }, data: { staffId: "ghost", permissions: {} } })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  test("boshqa sotuvchining xodimini o'zgartirib bo'lmaydi", async () => {
    const db = buildMockDb({ staff: { st1: { sellerId: "seller-other" } } });
    const staff = loadStaffModule({ db });
    await expect(
      staff._testables.handleSetStaffPermissions({ auth: { uid: "seller1" }, data: { staffId: "st1", permissions: { manageOrders: true } } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("muvaffaqiyatli — ruxsatlar normallashtirilib yangilanadi", async () => {
    const db = buildMockDb({ staff: { st1: { sellerId: "seller1", permissions: { manageProducts: false, manageOrders: false } } } });
    const staff = loadStaffModule({ db });
    const result = await staff._testables.handleSetStaffPermissions({
      auth: { uid: "seller1" }, data: { staffId: "st1", permissions: { manageOrders: true, manageProducts: "yes" } },
    });
    expect(result.success).toBe(true);
    expect(db.__staffUpdates.st1.permissions).toEqual({
      manageProducts: false, manageOrders: true, manageCouriers: false,
      manageCustomers: false, viewFinance: false, manageStaff: false,
    });
  });

  // XAVFSIZLIK (P1 fix, 2026-09 audit): oldin bu yerda rate-limit yo'q
  // edi — `couriers.js`dagi opa-uka funksiyalar bilan izchillik uchun.
  test("chaqiruvchi sotuvchi bo'yicha rate-limit tekshiradi", async () => {
    const checkRateLimitMock = jest.fn().mockResolvedValue(undefined);
    const db = buildMockDb({ staff: { st1: { sellerId: "seller1", permissions: {} } } });
    const staff = loadStaffModule({ db, checkRateLimitMock });
    await staff._testables.handleSetStaffPermissions({ auth: { uid: "seller1" }, data: { staffId: "st1", permissions: {} } });
    expect(checkRateLimitMock).toHaveBeenCalledWith("setStaffPermissions:seller1", expect.any(Number), expect.any(Number));
  });
});

describe("handleSetStaffActive / handleRemoveStaff — egalik tekshiruvi", () => {
  test("boshqa sotuvchining xodimini faollashtirib/o'chirib bo'lmaydi", async () => {
    const db = buildMockDb({ staff: { st1: { sellerId: "seller-other", status: "active" } } });
    const staff = loadStaffModule({ db });
    await expect(
      staff._testables.handleSetStaffActive({ auth: { uid: "seller1" }, data: { staffId: "st1", active: false } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("o'z xodimini faolsizlantirish/faollashtirish ishlaydi", async () => {
    const db = buildMockDb({ staff: { st1: { sellerId: "seller1", status: "active" } } });
    const staff = loadStaffModule({ db });
    const result = await staff._testables.handleSetStaffActive({ auth: { uid: "seller1" }, data: { staffId: "st1", active: false } });
    expect(result.success).toBe(true);
    expect(db.__staffUpdates.st1.status).toBe("inactive");
  });

  test("removeStaff — faqat egasi (yoki o'zi) o'chira oladi", async () => {
    const db = buildMockDb({ staff: { st1: { sellerId: "seller1" } } });
    const staff = loadStaffModule({ db });
    const result = await staff._testables.handleRemoveStaff({ auth: { uid: "seller1" }, data: { staffId: "st1" } });
    expect(result.success).toBe(true);
    expect(db.__staffDeletes).toContain("st1");
  });

  test("xodim o'zi (auth.uid === staffId) o'zini o'chira oladi", async () => {
    const db = buildMockDb({ staff: { st1: { sellerId: "seller1" } } });
    const staff = loadStaffModule({ db });
    const result = await staff._testables.handleRemoveStaff({ auth: { uid: "st1" }, data: { staffId: "st1" } });
    expect(result.success).toBe(true);
    expect(db.__staffDeletes).toContain("st1");
  });

  test("na sotuvchi na o'zi bo'lsa removeStaff permission-denied", async () => {
    const db = buildMockDb({ staff: { st1: { sellerId: "seller1" } } });
    const staff = loadStaffModule({ db });
    await expect(
      staff._testables.handleRemoveStaff({ auth: { uid: "st2" }, data: { staffId: "st1" } })
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(db.__staffDeletes).not.toContain("st1");
  });

  test("mavjud bo'lmagan xodim uchun not-found", async () => {
    const staff = loadStaffModule({ db: buildMockDb({}) });
    await expect(
      staff._testables.handleSetStaffActive({ auth: { uid: "seller1" }, data: { staffId: "ghost", active: false } })
    ).rejects.toMatchObject({ code: "not-found" });
    await expect(
      staff._testables.handleRemoveStaff({ auth: { uid: "seller1" }, data: { staffId: "ghost" } })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  // XAVFSIZLIK (P1 fix, 2026-09 audit): ikkalasida ham oldin rate-limit
  // yo'q edi.
  test("setStaffActive — chaqiruvchi bo'yicha rate-limit tekshiradi", async () => {
    const checkRateLimitMock = jest.fn().mockResolvedValue(undefined);
    const db = buildMockDb({ staff: { st1: { sellerId: "seller1", status: "active" } } });
    const staff = loadStaffModule({ db, checkRateLimitMock });
    await staff._testables.handleSetStaffActive({ auth: { uid: "seller1" }, data: { staffId: "st1", active: false } });
    expect(checkRateLimitMock).toHaveBeenCalledWith("setStaffActive:seller1", expect.any(Number), expect.any(Number));
  });

  test("removeStaff — chaqiruvchi bo'yicha rate-limit tekshiradi", async () => {
    const checkRateLimitMock = jest.fn().mockResolvedValue(undefined);
    const db = buildMockDb({ staff: { st1: { sellerId: "seller1" } } });
    const staff = loadStaffModule({ db, checkRateLimitMock });
    await staff._testables.handleRemoveStaff({ auth: { uid: "seller1" }, data: { staffId: "st1" } });
    expect(checkRateLimitMock).toHaveBeenCalledWith("removeStaff:seller1", expect.any(Number), expect.any(Number));
  });
});

describe("handleUpdateStaffProfile — xodimning O'ZI, o'z ismi/telefonini tahrirlashi", () => {
  test("autentifikatsiyasiz rad etiladi", async () => {
    const staff = loadStaffModule({ db: buildMockDb({}) });
    await expect(
      staff._testables.handleUpdateStaffProfile({ auth: null, data: { name: "Aziz" } })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("bo'sh ism bilan invalid-argument", async () => {
    const db = buildMockDb({ staff: { st1: { sellerId: "seller1", name: "Eski ism" } } });
    const staff = loadStaffModule({ db });
    await expect(
      staff._testables.handleUpdateStaffProfile({ auth: { uid: "st1" }, data: { name: "   " } })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("mavjud bo'lmagan xodim hujjati uchun not-found", async () => {
    const staff = loadStaffModule({ db: buildMockDb({}) });
    await expect(
      staff._testables.handleUpdateStaffProfile({ auth: { uid: "ghost" }, data: { name: "Aziz" } })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  test("o'zining ism/telefonini muvaffaqiyatli yangilaydi", async () => {
    const db = buildMockDb({ staff: { st1: { sellerId: "seller1", name: "Eski ism", phone: "+998900000000" } } });
    const staff = loadStaffModule({ db });
    const result = await staff._testables.handleUpdateStaffProfile({
      auth: { uid: "st1" }, data: { name: "  Yangi Ism  ", phone: "+998901234567" },
    });
    expect(result.success).toBe(true);
    expect(db.__staffUpdates.st1).toEqual({ name: "Yangi Ism", phone: "+998901234567" });
  });

  // XAVFSIZLIK (P1 fix, 2026-09 audit): `couriers.js`dagi bevosita
  // o'xshash `updateCourierProfile`da rate-limit BOR edi, bu yerda
  // YO'Q edi — izchillik uchun qo'shildi.
  test("chaqiruvchi xodim bo'yicha rate-limit tekshiradi", async () => {
    const checkRateLimitMock = jest.fn().mockResolvedValue(undefined);
    const db = buildMockDb({ staff: { st1: { sellerId: "seller1", name: "Aziz" } } });
    const staff = loadStaffModule({ db, checkRateLimitMock });
    await staff._testables.handleUpdateStaffProfile({ auth: { uid: "st1" }, data: { name: "Aziz" } });
    expect(checkRateLimitMock).toHaveBeenCalledWith("updateStaffProfile:st1", expect.any(Number), expect.any(Number));
  });
});

describe("applyStaffOrderAction / handleConfirmOrderAsStaff — buyurtmani bitta bosish bilan qabul qilish", () => {
  test("auth yo'q bo'lsa handleConfirmOrderAsStaff unauthenticated", async () => {
    const staff = loadStaffModule({ db: buildMockDb({}) });
    await expect(staff._testables.handleConfirmOrderAsStaff({ data: { orderId: "o1" } }))
      .rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("xodim hisobi topilmasa permission-denied", async () => {
    const staff = loadStaffModule({ db: buildMockDb({}) });
    await expect(
      staff._testables.applyStaffOrderAction({ staffId: "ghost", orderId: "o1" })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("xodim nofaol bo'lsa permission-denied", async () => {
    const db = buildMockDb({ staff: { st1: { sellerId: "seller1", status: "inactive", permissions: { manageOrders: true } } } });
    const staff = loadStaffModule({ db });
    await expect(
      staff._testables.applyStaffOrderAction({ staffId: "st1", orderId: "o1" })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("manageOrders ruxsati bo'lmasa permission-denied", async () => {
    const db = buildMockDb({ staff: { st1: { sellerId: "seller1", status: "active", permissions: { manageOrders: false } } } });
    const staff = loadStaffModule({ db });
    await expect(
      staff._testables.applyStaffOrderAction({ staffId: "st1", orderId: "o1" })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("buyurtma topilmasa not-found", async () => {
    const db = buildMockDb({ staff: { st1: { sellerId: "seller1", status: "active", permissions: { manageOrders: true } } } });
    const staff = loadStaffModule({ db });
    await expect(
      staff._testables.applyStaffOrderAction({ staffId: "st1", orderId: "missing" })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  test("boshqa sotuvchining buyurtmasini qabul qila olmaydi", async () => {
    const db = buildMockDb({
      staff: { st1: { sellerId: "seller1", status: "active", permissions: { manageOrders: true } } },
      orders: { o1: { sellerId: "seller-other", status: "new" } },
    });
    const staff = loadStaffModule({ db });
    await expect(
      staff._testables.applyStaffOrderAction({ staffId: "st1", orderId: "o1" })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("buyurtma allaqachon 'new' bosqichida bo'lmasa failed-precondition", async () => {
    const db = buildMockDb({
      staff: { st1: { sellerId: "seller1", status: "active", permissions: { manageOrders: true } } },
      orders: { o1: { sellerId: "seller1", status: "processing" } },
    });
    const staff = loadStaffModule({ db });
    await expect(
      staff._testables.applyStaffOrderAction({ staffId: "st1", orderId: "o1" })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("muvaffaqiyatli — status 'processing'ga o'tadi", async () => {
    const db = buildMockDb({
      staff: { st1: { sellerId: "seller1", status: "active", permissions: { manageOrders: true } } },
      orders: { o1: { sellerId: "seller1", status: "new" } },
    });
    const staff = loadStaffModule({ db });
    const result = await staff._testables.applyStaffOrderAction({ staffId: "st1", orderId: "o1" });
    expect(result).toEqual({ success: true, status: "processing", orderNumber: null });
    expect(db.__orderUpdates.o1.status).toBe("processing");
    expect(db.__orderUpdates.o1.lastActionByStaffId).toBe("st1");
  });

  test("handleConfirmOrderAsStaff — request.auth.uid'ni staffId sifatida ishlatadi", async () => {
    const db = buildMockDb({
      staff: { st1: { sellerId: "seller1", status: "active", permissions: { manageOrders: true } } },
      orders: { o1: { sellerId: "seller1", status: "new" } },
    });
    const staff = loadStaffModule({ db });
    const result = await staff._testables.handleConfirmOrderAsStaff({ auth: { uid: "st1" }, data: { orderId: "o1" } });
    expect(result.success).toBe(true);
    expect(db.__orderUpdates.o1.status).toBe("processing");
  });

  // XAVFSIZLIK (P1 fix, 2026-09 audit): oldin `handleConfirmOrderAsStaff`
  // onCall qatlamida rate-limit yo'q edi (Mini App'dan TO'G'RIDAN-
  // TO'G'RI chaqiriladigan yagona yo'l).
  test("handleConfirmOrderAsStaff — chaqiruvchi xodim bo'yicha rate-limit tekshiradi", async () => {
    const checkRateLimitMock = jest.fn().mockResolvedValue(undefined);
    const db = buildMockDb({
      staff: { st1: { sellerId: "seller1", status: "active", permissions: { manageOrders: true } } },
      orders: { o1: { sellerId: "seller1", status: "new" } },
    });
    const staff = loadStaffModule({ db, checkRateLimitMock });
    await staff._testables.handleConfirmOrderAsStaff({ auth: { uid: "st1" }, data: { orderId: "o1" } });
    expect(checkRateLimitMock).toHaveBeenCalledWith("confirmOrderAsStaff:st1", expect.any(Number), expect.any(Number));
  });

  test("rate-limit oshib ketgan bo'lsa, buyurtma O'ZGARTIRILMASDAN rad etiladi", async () => {
    const { HttpsError } = require("firebase-functions/v2/https");
    const checkRateLimitMock = jest.fn().mockRejectedValue(new HttpsError("resource-exhausted", "Juda ko'p so'rov."));
    const db = buildMockDb({
      staff: { st1: { sellerId: "seller1", status: "active", permissions: { manageOrders: true } } },
      orders: { o1: { sellerId: "seller1", status: "new" } },
    });
    const staff = loadStaffModule({ db, checkRateLimitMock });
    await expect(
      staff._testables.handleConfirmOrderAsStaff({ auth: { uid: "st1" }, data: { orderId: "o1" } })
    ).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(db.__orderUpdates.o1).toBeUndefined();
  });
});

/**
 * ADVANCED TEAM & RBAC (2026-09 punkt-royxati, 2-band) — `manageStaff`
 * ruxsatiga ega XODIM ("Admin" roli, haqiqiy do'kon egasi EMAS) 4 ta
 * xodim-boshqaruv funksiyasini chaqirganda. Sof mantiq
 * (`sanitizeIncomingPermissionsForActor`/`canActorManageTargetStaff`)
 * `staffRoles.test.js`da alohida sinalgan — bu yerda ULARNING
 * Cloud Function darajasida (`resolveActingSellerContext` bilan
 * birga) TO'G'RI CHAQIRILISHI tekshiriladi.
 */
describe("manageStaff — xodim-administrator orqali eskalatsiyaning oldini olish", () => {
  test("manageStaff ruxsati bo'lmagan xodim handleCreateStaffInvite'ni chaqira olmaydi", async () => {
    const db = buildMockDb({
      staff: { admin1: { sellerId: "seller1", status: "active", permissions: { manageOrders: true } } },
    });
    const staff = loadStaffModule({ db });
    await expect(
      staff._testables.handleCreateStaffInvite({ auth: { uid: "admin1" }, data: { name: "Yangi", permissions: { manageOrders: true } } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("manageStaff'ga ega xodim yangi xodim taklif qila oladi, LEKIN yangi xodimga manageStaff HECH QACHON berilmaydi", async () => {
    const db = buildMockDb({
      staff: { admin1: { sellerId: "seller1", status: "active", permissions: { manageStaff: true } } },
      sellers: { seller1: { tariffPlan: "biznes" } },
    });
    const staff = loadStaffModule({ db });
    const result = await staff._testables.handleCreateStaffInvite({
      auth: { uid: "admin1" },
      data: { name: "Yangi xodim", permissions: { manageOrders: true, manageStaff: true } },
    });
    expect(db.__inviteSets[result.token].permissions).toEqual({
      manageProducts: false, manageOrders: true, manageCouriers: false,
      manageCustomers: false, viewFinance: false, manageStaff: false,
    });
  });

  test("haqiqiy do'kon egasi yangi xodimga manageStaff (yangi administrator) bera oladi", async () => {
    const db = buildMockDb({ sellers: { seller1: { tariffPlan: "biznes" } } });
    const staff = loadStaffModule({ db });
    const result = await staff._testables.handleCreateStaffInvite({
      auth: { uid: "seller1" },
      data: { name: "Yangi Admin", permissions: { manageStaff: true } },
    });
    expect(db.__inviteSets[result.token].permissions.manageStaff).toBe(true);
  });

  test("manageStaff'ga ega xodim, manageStaff'siz oddiy xodimning ruxsatlarini o'zgartira oladi", async () => {
    const db = buildMockDb({
      staff: {
        admin1: { sellerId: "seller1", status: "active", permissions: { manageStaff: true } },
        regular1: { sellerId: "seller1", permissions: { manageOrders: false } },
      },
    });
    const staff = loadStaffModule({ db });
    const result = await staff._testables.handleSetStaffPermissions({
      auth: { uid: "admin1" },
      data: { staffId: "regular1", permissions: { manageOrders: true } },
    });
    expect(result.success).toBe(true);
    expect(db.__staffUpdates.regular1.permissions.manageOrders).toBe(true);
  });

  test("manageStaff'ga ega xodim, ALLAQACHON manageStaff'ga ega BOSHQA xodimni (teng darajadagi) tahrirlay OLMAYDI", async () => {
    const db = buildMockDb({
      staff: {
        admin1: { sellerId: "seller1", status: "active", permissions: { manageStaff: true } },
        admin2: { sellerId: "seller1", permissions: { manageStaff: true } },
      },
    });
    const staff = loadStaffModule({ db });
    await expect(
      staff._testables.handleSetStaffPermissions({
        auth: { uid: "admin1" },
        data: { staffId: "admin2", permissions: { manageOrders: true } },
      })
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(db.__staffUpdates.admin2).toBeUndefined();
  });

  test("manageStaff'ga ega xodim, hatto O'ZINING ham ruxsatlarini setStaffPermissions orqali o'zgartira OLMAYDI (o'zi ham 'teng darajadagi admin' sifatida himoyalangan)", async () => {
    const db = buildMockDb({
      staff: { admin1: { sellerId: "seller1", status: "active", permissions: { manageStaff: true } } },
    });
    const staff = loadStaffModule({ db });
    // Bu — atayin: aks holda admin o'ziga qo'shimcha ruxsat qo'shib,
    // keyin ularni ishlatishi mumkin bo'lardi. Faqat HAQIQIY do'kon
    // egasi biror administratorning (o'zi ham kiradi) ruxsatlarini
    // o'zgartira oladi.
    await expect(
      staff._testables.handleSetStaffPermissions({
        auth: { uid: "admin1" },
        data: { staffId: "admin1", permissions: { manageStaff: true, manageOrders: true } },
      })
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(db.__staffUpdates.admin1).toBeUndefined();
  });

  test("haqiqiy do'kon egasi ALLAQACHON manageStaff'ga ega administratorni ham erkin tahrirlay oladi", async () => {
    const db = buildMockDb({
      staff: { admin1: { sellerId: "seller1", permissions: { manageStaff: true } } },
    });
    const staff = loadStaffModule({ db });
    const result = await staff._testables.handleSetStaffPermissions({
      auth: { uid: "seller1" },
      data: { staffId: "admin1", permissions: { manageStaff: false, manageOrders: true } },
    });
    expect(result.success).toBe(true);
    expect(db.__staffUpdates.admin1.permissions.manageStaff).toBe(false);
  });

  test("manageStaff'ga ega xodim, ALLAQACHON manageStaff'ga ega BOSHQA xodimni faolsizlantira OLMAYDI", async () => {
    const db = buildMockDb({
      staff: {
        admin1: { sellerId: "seller1", status: "active", permissions: { manageStaff: true } },
        admin2: { sellerId: "seller1", status: "active", permissions: { manageStaff: true } },
      },
    });
    const staff = loadStaffModule({ db });
    await expect(
      staff._testables.handleSetStaffActive({ auth: { uid: "admin1" }, data: { staffId: "admin2", active: false } })
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(db.__staffUpdates.admin2).toBeUndefined();
  });

  test("manageStaff'ga ega xodim, oddiy (manageStaff'siz) xodimni faolsizlantira oladi", async () => {
    const db = buildMockDb({
      staff: {
        admin1: { sellerId: "seller1", status: "active", permissions: { manageStaff: true } },
        regular1: { sellerId: "seller1", status: "active", permissions: {} },
      },
    });
    const staff = loadStaffModule({ db });
    const result = await staff._testables.handleSetStaffActive({ auth: { uid: "admin1" }, data: { staffId: "regular1", active: false } });
    expect(result.success).toBe(true);
    expect(db.__staffUpdates.regular1.status).toBe("inactive");
  });

  test("manageStaff'ga ega xodim, ALLAQACHON manageStaff'ga ega BOSHQA xodimni o'chira OLMAYDI", async () => {
    const db = buildMockDb({
      staff: {
        admin1: { sellerId: "seller1", status: "active", permissions: { manageStaff: true } },
        admin2: { sellerId: "seller1", permissions: { manageStaff: true } },
      },
    });
    const staff = loadStaffModule({ db });
    await expect(
      staff._testables.handleRemoveStaff({ auth: { uid: "admin1" }, data: { staffId: "admin2" } })
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(db.__staffDeletes).not.toContain("admin2");
  });

  test("manageStaff'ga ega xodim, oddiy xodimni o'chira oladi", async () => {
    const db = buildMockDb({
      staff: {
        admin1: { sellerId: "seller1", status: "active", permissions: { manageStaff: true } },
        regular1: { sellerId: "seller1", permissions: {} },
      },
    });
    const staff = loadStaffModule({ db });
    const result = await staff._testables.handleRemoveStaff({ auth: { uid: "admin1" }, data: { staffId: "regular1" } });
    expect(result.success).toBe(true);
    expect(db.__staffDeletes).toContain("regular1");
  });

  test("ALLAQACHON manageStaff'ga ega admin — teng darajadagi cheklovdan QAT'IY NAZAR o'zini-o'zi o'chira oladi", async () => {
    const db = buildMockDb({
      staff: { admin1: { sellerId: "seller1", status: "active", permissions: { manageStaff: true } } },
    });
    const staff = loadStaffModule({ db });
    const result = await staff._testables.handleRemoveStaff({ auth: { uid: "admin1" }, data: { staffId: "admin1" } });
    expect(result.success).toBe(true);
    expect(db.__staffDeletes).toContain("admin1");
  });

  test("boshqa sotuvchining xodim-administratori O'ZIGA tegishli bo'lmagan xodimni boshqara olmaydi", async () => {
    const db = buildMockDb({
      staff: {
        admin1: { sellerId: "seller-other", status: "active", permissions: { manageStaff: true } },
        regular1: { sellerId: "seller1", permissions: {} },
      },
    });
    const staff = loadStaffModule({ db });
    await expect(
      staff._testables.handleSetStaffPermissions({ auth: { uid: "admin1" }, data: { staffId: "regular1", permissions: { manageOrders: true } } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("role maydoni — taklifda saqlanadi va setStaffPermissions orqali yangilanadi", async () => {
    const db = buildMockDb({
      staff: { st1: { sellerId: "seller1", permissions: { manageOrders: true }, role: "operator" } },
    });
    const staff = loadStaffModule({ db });
    const result = await staff._testables.handleSetStaffPermissions({
      auth: { uid: "seller1" },
      data: { staffId: "st1", permissions: { manageOrders: true, manageCustomers: true }, role: "marketing_manager" },
    });
    expect(result.role).toBe("marketing_manager");
    expect(db.__staffUpdates.st1.role).toBe("marketing_manager");
  });

  test("role berilmasa (undefined), mavjud rol o'zgarishsiz qoladi", async () => {
    const db = buildMockDb({
      staff: { st1: { sellerId: "seller1", permissions: { manageOrders: true }, role: "operator" } },
    });
    const staff = loadStaffModule({ db });
    const result = await staff._testables.handleSetStaffPermissions({
      auth: { uid: "seller1" },
      data: { staffId: "st1", permissions: { manageOrders: true } },
    });
    expect(result.role).toBe("operator");
    expect(db.__staffUpdates.st1.role).toBeUndefined();
  });

  test("handleCreateStaffInvite — role taklifga to'g'ri yoziladi", async () => {
    const db = buildMockDb({ sellers: { seller1: { tariffPlan: "biznes" } } });
    const staff = loadStaffModule({ db });
    const result = await staff._testables.handleCreateStaffInvite({
      auth: { uid: "seller1" },
      data: { name: "Aziza", permissions: { manageOrders: true, manageCouriers: true }, role: "courier_manager" },
    });
    expect(db.__inviteSets[result.token].role).toBe("courier_manager");
  });

  test("handleCreateStaffInvite — noto'g'ri rol nomi null'ga tushadi", async () => {
    const db = buildMockDb({ sellers: { seller1: { tariffPlan: "biznes" } } });
    const staff = loadStaffModule({ db });
    const result = await staff._testables.handleCreateStaffInvite({
      auth: { uid: "seller1" },
      data: { name: "Aziza", permissions: { manageOrders: true }, role: "ceo" },
    });
    expect(db.__inviteSets[result.token].role).toBeNull();
  });
});
