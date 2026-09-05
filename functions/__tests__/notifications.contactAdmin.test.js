/**
 * `notifications.js`dagi `contactAdmin` (`handleContactAdmin`) uchun
 * testlar — asosan 2026-09'da qo'shilgan `tariffRequests` yozuvi
 * mantig'ini tekshiradi (Telegram xabari + Firestore yozuvi bir vaqtda
 * ketishi kerak, lekin faqat haqiqiy tarif so'rovi bo'lganda).
 */

function buildMockDb({ adminIds = ["admin-1"], sellerData = null, tariffRequestsAddMock } = {}) {
  const addMock = tariffRequestsAddMock || jest.fn(async () => ({ id: "mock-request-id" }));

  return {
    collection: (name) => {
      if (name === "sellers") {
        return {
          doc: () => ({
            get: async () => (
              sellerData ? { exists: true, data: () => sellerData } : { exists: false }
            ),
          }),
        };
      }
      if (name === "admins") {
        return {
          get: async () => ({
            empty: adminIds.length === 0,
            docs: adminIds.map((id) => ({ id })),
          }),
        };
      }
      if (name === "tariffRequests") {
        return { add: addMock };
      }
      throw new Error(`Kutilmagan kolleksiya so'raldi: ${name}`);
    },
  };
}

function loadModule({ adminIds, sellerData, tariffRequestsAddMock, sendResult = { ok: true } } = {}) {
  jest.resetModules();

  const mockDb = buildMockDb({ adminIds, sellerData, tariffRequestsAddMock });
  const sendTelegramMessageMock = jest.fn(async () => sendResult);

  jest.doMock("../lib/admin", () => ({
    admin: {
      firestore: Object.assign(() => mockDb, { FieldValue: { serverTimestamp: () => "MOCK_TS" } }),
    },
    BOT_TOKEN: { value: () => "platform-token" },
    STAFF_BOT_TOKEN: { value: () => "staff-token" },
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
  return { notifications, sendTelegramMessageMock, mockDb };
}

describe("contactAdmin — tarif so'rovini Firestore'ga yozish", () => {
  test("tizimga kirmagan bo'lsa, xatolik qaytaradi", async () => {
    const { notifications } = loadModule({});
    await expect(
      notifications._testables.handleContactAdmin({ auth: null, data: { message: "salom" } })
    ).rejects.toThrow(/Tizimga kirgan/);
  });

  test("xabar matni bo'lmasa, xatolik qaytaradi", async () => {
    const { notifications } = loadModule({});
    await expect(
      notifications._testables.handleContactAdmin({ auth: { uid: "seller-1" }, data: {} })
    ).rejects.toThrow(/Xabar matni/);
  });

  test("faol admin topilmasa, xatolik qaytaradi", async () => {
    const { notifications } = loadModule({ adminIds: [] });
    await expect(
      notifications._testables.handleContactAdmin({
        auth: { uid: "seller-1" },
        data: { message: "yordam kerak", category: "support" },
      })
    ).rejects.toThrow(/admin topilmadi/);
  });

  test("oddiy qo'llab-quvvatlash so'rovi — Telegram xabari ketadi, LEKIN tariffRequests'ga yozilmaydi", async () => {
    const addMock = jest.fn(async () => ({ id: "x" }));
    const { notifications, sendTelegramMessageMock } = loadModule({
      sellerData: { storeName: "Gulnora Kosmetika", phone: "+998901234567", tariffPlan: "start" },
      tariffRequestsAddMock: addMock,
    });

    const result = await notifications._testables.handleContactAdmin({
      auth: { uid: "seller-1" },
      data: { message: "Ilova ishlamayapti", category: "support" },
    });

    expect(result.sent).toBe(true);
    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    expect(addMock).not.toHaveBeenCalled();
  });

  test("Z-Pro'ga qiziqish bildirilganda — Telegram xabari VA tariffRequests yozuvi ikkalasi ham ketadi, to'g'ri maydonlar bilan", async () => {
    const addMock = jest.fn(async () => ({ id: "req-1" }));
    const { notifications, sendTelegramMessageMock } = loadModule({
      sellerData: { storeName: "Gulnora Kosmetika", phone: "+998901234567", tariffPlan: "start" },
      tariffRequestsAddMock: addMock,
    });

    const result = await notifications._testables.handleContactAdmin({
      auth: { uid: "seller-1" },
      data: { message: "Z-Pro tarifiga o'tmoqchiman", category: "pro-interest", requestedPlan: "pro" },
    });

    expect(result.sent).toBe(true);
    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    expect(addMock).toHaveBeenCalledTimes(1);
    expect(addMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sellerId: "seller-1",
        storeName: "Gulnora Kosmetika",
        phone: "+998901234567",
        requestedPlan: "pro",
        currentPlan: "start",
        message: "Z-Pro tarifiga o'tmoqchiman",
        status: "pending",
        resolvedAt: null,
        resolvedBy: null,
      })
    );
  });

  test("Z-Biznes'ga qiziqish bildirilganda ham tariffRequests'ga yoziladi (currentPlan='pro' bo'lsa ham to'g'ri o'tadi)", async () => {
    const addMock = jest.fn(async () => ({ id: "req-2" }));
    const { notifications } = loadModule({
      sellerData: { storeName: "Gulnora Kosmetika", phone: null, tariffPlan: "pro" },
      tariffRequestsAddMock: addMock,
    });

    await notifications._testables.handleContactAdmin({
      auth: { uid: "seller-2" },
      data: { message: "Z-Biznes'ni sinab ko'rmoqchiman", category: "pro-interest", requestedPlan: "biznes" },
    });

    expect(addMock).toHaveBeenCalledWith(
      expect.objectContaining({ requestedPlan: "biznes", currentPlan: "pro", phone: null })
    );
  });

  test("noto'g'ri/bo'sh requestedPlan bo'lsa (masalan 'start' yoki umuman yo'q), tariffRequests'ga yozilmaydi", async () => {
    const addMock = jest.fn(async () => ({ id: "x" }));
    const { notifications } = loadModule({
      sellerData: { storeName: "Do'kon", tariffPlan: "start" },
      tariffRequestsAddMock: addMock,
    });

    await notifications._testables.handleContactAdmin({
      auth: { uid: "seller-3" },
      data: { message: "qiziqaman", category: "pro-interest", requestedPlan: "start" },
    });
    await notifications._testables.handleContactAdmin({
      auth: { uid: "seller-3" },
      data: { message: "qiziqaman", category: "pro-interest" },
    });

    expect(addMock).not.toHaveBeenCalled();
  });

  test("sotuvchi hujjati topilmasa ham, xabar baribir yuboriladi (xom UID hech qachon ko'rsatilmaydi)", async () => {
    const { notifications, sendTelegramMessageMock } = loadModule({ sellerData: null });

    const result = await notifications._testables.handleContactAdmin({
      auth: { uid: "unknown-seller" },
      data: { message: "salom", category: "support" },
    });

    expect(result.sent).toBe(true);
    const sentText = sendTelegramMessageMock.mock.calls[0][2];
    expect(sentText).toContain("Noma'lum foydalanuvchi");
    expect(sentText).not.toContain("unknown-seller");
  });

  test("Firestore'ga yozish muvaffaqiyatsiz bo'lsa ham, funksiya xato tashlamaydi (Telegram xabari muhimroq)", async () => {
    const addMock = jest.fn(async () => { throw new Error("Firestore vaqtincha ishlamayapti"); });
    const { notifications } = loadModule({
      sellerData: { storeName: "Do'kon", tariffPlan: "start" },
      tariffRequestsAddMock: addMock,
    });

    const result = await notifications._testables.handleContactAdmin({
      auth: { uid: "seller-4" },
      data: { message: "Z-Pro kerak", category: "pro-interest", requestedPlan: "pro" },
    });

    expect(result.sent).toBe(true);
  });
});
