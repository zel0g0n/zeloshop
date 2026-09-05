/**
 * `staffBot.js` uchun testlar — xodim botining `/start` orqali
 * taklif kodini redemption qilish oqimi (shu jumladan Z-Tariflar
 * xodim limitini QAYTA tekshirish), menyu
 * yo'naltirish, callback_query (bitta bosish bilan qabul qilish), va
 * webhook ro'yxatga olish (`registerStaffBotWebhook`).
 *
 * Haqiqiy Firestore/Telegram API'ga ULANMAYDI — barchasi taqlid
 * qilingan (mock). `applyStaffOrderAction`ning O'ZI `staff.test.js`da
 * alohida sinaladi — bu yerda faqat MOCK qilinadi.
 */

function buildMockDb({ staff = {}, staffInvites = {}, sellers = {}, admins = {} } = {}) {
  const staffSets = {};
  const inviteUpdates = {};
  return {
    collection: (name) => {
      if (name === "staff") {
        return {
          doc: (id) => ({
            get: async () => (staff[id] ? { exists: true, data: () => staff[id] } : { exists: false }),
            set: async (data) => { staffSets[id] = data; },
          }),
          // `handleStaffStartCommand`ning limit tekshiruvi uchun -
          // `couriers.test.js`/`staff.test.js`dagi bilan bir xil
          // soddalashtirish (faqat bitta `.where(field,"==",value).get()`).
          where: (field, op, value) => ({
            get: async () => {
              if (op !== "==") throw new Error(`Kutilmagan operator: ${op}`);
              const docs = Object.entries(staff).filter(([, data]) => data[field] === value);
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
                  get: async () => (staffInvites[token] ? { exists: true, data: () => staffInvites[token] } : { exists: false }),
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
    __staffSets: staffSets,
    __inviteUpdates: inviteUpdates,
  };
}

function loadStaffBotModule({
  db, sendTelegramMessageMock, answerCallbackQueryMock, editTelegramMessageTextMock,
  applyStaffOrderActionMock, fetchMock,
} = {}) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: { firestore: { FieldValue: { serverTimestamp: () => "MOCK_TS" } } },
    db,
    STAFF_BOT_TOKEN: { value: () => "staff-token" },
    STAFF_TELEGRAM_WEBHOOK_SECRET: { value: () => "webhook-secret" },
  }));
  jest.doMock("../lib/helpers", () => ({
    sendTelegramMessage: sendTelegramMessageMock || jest.fn().mockResolvedValue({ ok: true }),
    answerCallbackQuery: answerCallbackQueryMock || jest.fn().mockResolvedValue(undefined),
    editTelegramMessageText: editTelegramMessageTextMock || jest.fn().mockResolvedValue(undefined),
    buildSellerAppLink: (path) => `https://commerce-zelo.web.app${path}`,
  }));
  jest.doMock("../staff", () => ({
    applyStaffOrderAction: applyStaffOrderActionMock || jest.fn().mockResolvedValue({ success: true, status: "processing" }),
  }));
  if (fetchMock) global.fetch = fetchMock;
  return require("../staffBot");
}

describe("SOF funksiyalar", () => {
  const bot = loadStaffBotModule({ db: buildMockDb({}) });

  test("parseInvitePayload — sellerId prefiksini to'g'ri ajratadi", () => {
    expect(bot._testables.parseInvitePayload("seller1_abcdef")).toEqual({ sellerId: "seller1", token: "seller1_abcdef" });
  });
  test("parseInvitePayload — bo'sh/noto'g'ri qiymatlar uchun null", () => {
    expect(bot._testables.parseInvitePayload(null)).toBeNull();
    expect(bot._testables.parseInvitePayload("notoken")).toBeNull();
  });

  test("parseStaffCallbackData — to'g'ri ajratadi", () => {
    expect(bot._testables.parseStaffCallbackData("stf:confirm:abc123")).toEqual({ action: "confirm", orderId: "abc123" });
  });
  test("parseStaffCallbackData — noto'g'ri prefiks/format bo'lsa null", () => {
    expect(bot._testables.parseStaffCallbackData("cor:picked_up:abc123")).toBeNull();
    expect(bot._testables.parseStaffCallbackData(null)).toBeNull();
    expect(bot._testables.parseStaffCallbackData("stf:confirm")).toBeNull();
  });

  test("buildStaffMenuKeyboard — bitta tugmali reply keyboard", () => {
    const keyboard = bot._testables.buildStaffMenuKeyboard();
    expect(keyboard.keyboard[0][0].text).toBe(bot._testables.MENU_OPEN_APP_TEXT);
    expect(keyboard.resize_keyboard).toBe(true);
  });
});

describe("handleStaffStartCommand", () => {
  test("allaqachon ulangan xodim uchun — menyuni qayta ko'rsatadi", async () => {
    const db = buildMockDb({ staff: { st1: { name: "Vali", sellerId: "s1", status: "active" } } });
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const bot = loadStaffBotModule({ db, sendTelegramMessageMock });
    await bot._testables.handleStaffStartCommand("staff-token", "st1", 111, null);
    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    expect(sendTelegramMessageMock.mock.calls[0][2]).toContain("Vali");
  });

  test("payload yo'q, ulanmagan bo'lsa — taklif havolasi kerakligini aytadi", async () => {
    const db = buildMockDb({});
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const bot = loadStaffBotModule({ db, sendTelegramMessageMock });
    await bot._testables.handleStaffStartCommand("staff-token", "st1", 111, null);
    expect(sendTelegramMessageMock.mock.calls[0][2]).toContain("TAKLIF HAVOLASI");
  });

  test("taklif topilmasa yoki allaqachon ishlatilgan bo'lsa — yaroqsiz xabari", async () => {
    const db = buildMockDb({
      staffInvites: { s1_abc: { used: true, name: "Vali", permissions: { manageOrders: true } } },
      sellers: { s1: { storeName: "Do'kon" } },
    });
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const bot = loadStaffBotModule({ db, sendTelegramMessageMock });
    await bot._testables.handleStaffStartCommand("staff-token", "st1", 111, "s1_abc");
    expect(sendTelegramMessageMock.mock.calls[0][2]).toContain("yaroqsiz");
  });

  test("sotuvchida (Z-Pro, limit 2) ALLAQACHON 2 ta xodim bo'lsa (poyga holati) — limit to'lgani aytiladi, YANGI hujjat YARATILMAYDI", async () => {
    const db = buildMockDb({
      staff: {
        e1: { sellerId: "s1" }, e2: { sellerId: "s1" },
      },
      staffInvites: { s1_abc: { used: false, name: "Vali", permissions: { manageOrders: true } } },
      sellers: { s1: { storeName: "Do'kon", tariffPlan: "pro" } },
    });
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const bot = loadStaffBotModule({ db, sendTelegramMessageMock });
    await bot._testables.handleStaffStartCommand("staff-token", "new-staff", 111, "s1_abc");
    expect(sendTelegramMessageMock.mock.calls[0][2]).toContain("limiti");
    expect(db.__staffSets["new-staff"]).toBeUndefined();
    expect(db.__inviteUpdates.s1_abc).toBeUndefined();
  });

  test("muvaffaqiyatli redemptsiya — xodim hujjati (ruxsatlar bilan) yaratiladi, taklif ISHLATILGAN deb belgilanadi", async () => {
    const db = buildMockDb({
      staffInvites: { s1_abc: { used: false, name: "Vali", phone: "+998", permissions: { manageProducts: true, manageOrders: false } } },
      sellers: { s1: { storeName: "Go'zallik Do'koni", tariffPlan: "pro" } },
    });
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const bot = loadStaffBotModule({ db, sendTelegramMessageMock });
    await bot._testables.handleStaffStartCommand("staff-token", "st1", 111, "s1_abc");

    expect(db.__staffSets.st1.sellerId).toBe("s1");
    expect(db.__staffSets.st1.name).toBe("Vali");
    expect(db.__staffSets.st1.status).toBe("active");
    expect(db.__staffSets.st1.permissions).toEqual({
      manageProducts: true, manageOrders: false, manageCouriers: false,
      manageCustomers: false, viewFinance: false, manageStaff: false,
    });
    expect(db.__inviteUpdates.s1_abc.used).toBe(true);
    expect(db.__inviteUpdates.s1_abc.staffId).toBe("st1");
    expect(sendTelegramMessageMock.mock.calls[0][2]).toContain("Vali");
    expect(sendTelegramMessageMock.mock.calls[0][2]).toContain("Go'zallik Do'koni");
  });
});

describe("handleStaffTelegramMessage — yo'naltirish", () => {
  test("'/start' matni — handleStaffStartCommand chaqiriladi", async () => {
    const db = buildMockDb({ staff: { 123: { name: "Aziz" } } });
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const bot = loadStaffBotModule({ db, sendTelegramMessageMock });
    await bot._testables.handleStaffTelegramMessage("staff-token", { from: { id: 123 }, chat: { id: 999 }, text: "/start" });
    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
  });

  test("menyu tugmasi bosilsa — Mini App havolasi bilan javob beradi", async () => {
    const db = buildMockDb({});
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const bot = loadStaffBotModule({ db, sendTelegramMessageMock });
    await bot._testables.handleStaffTelegramMessage("staff-token", {
      from: { id: 123 }, chat: { id: 999 }, text: bot._testables.MENU_OPEN_APP_TEXT,
    });
    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    const opts = sendTelegramMessageMock.mock.calls[0][3];
    expect(opts.inlineKeyboard[0][0].web_app.url).toBe("https://commerce-zelo.web.app/staff");
  });

  test("noma'lum matn — faqat ULANGAN xodimga menyuni eslatadi, ulanmaganga JIM qoladi", async () => {
    const dbLinked = buildMockDb({ staff: { 123: { name: "Aziz" } } });
    const sendTelegramMessageMockLinked = jest.fn().mockResolvedValue({ ok: true });
    const botLinked = loadStaffBotModule({ db: dbLinked, sendTelegramMessageMock: sendTelegramMessageMockLinked });
    await botLinked._testables.handleStaffTelegramMessage("staff-token", { from: { id: 123 }, chat: { id: 999 }, text: "salom" });
    expect(sendTelegramMessageMockLinked).toHaveBeenCalledTimes(1);

    const dbUnlinked = buildMockDb({});
    const sendTelegramMessageMockUnlinked = jest.fn().mockResolvedValue({ ok: true });
    const botUnlinked = loadStaffBotModule({ db: dbUnlinked, sendTelegramMessageMock: sendTelegramMessageMockUnlinked });
    await botUnlinked._testables.handleStaffTelegramMessage("staff-token", { from: { id: 456 }, chat: { id: 999 }, text: "salom" });
    expect(sendTelegramMessageMockUnlinked).not.toHaveBeenCalled();
  });
});

describe("handleRegisterStaffBotWebhook", () => {
  test("auth yo'q bo'lsa unauthenticated", async () => {
    const bot = loadStaffBotModule({ db: buildMockDb({}) });
    await expect(bot._testables.handleRegisterStaffBotWebhook({})).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("admin bo'lmasa permission-denied", async () => {
    const db = buildMockDb({ admins: {} });
    const bot = loadStaffBotModule({ db });
    await expect(bot._testables.handleRegisterStaffBotWebhook({ auth: { uid: "u1" } })).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("admin bo'lsa — Telegram setWebhook chaqiriladi va webhookUrl qaytadi", async () => {
    const db = buildMockDb({ admins: { u1: true } });
    process.env.GCLOUD_PROJECT = "commerce-zelo";
    const fetchMock = jest.fn().mockResolvedValue({ json: async () => ({ ok: true }) });
    const bot = loadStaffBotModule({ db, fetchMock });
    const result = await bot._testables.handleRegisterStaffBotWebhook({ auth: { uid: "u1" } });
    expect(result.ok).toBe(true);
    expect(result.webhookUrl).toContain("staffBotWebhook");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
