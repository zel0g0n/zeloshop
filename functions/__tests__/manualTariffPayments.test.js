/**
 * `manualTariffPayments.js` uchun testlar - Z-tarif uchun "qo'lda
 * tasdiqlash" (to'lov cheki + admin ko'rib chiqish) oqimi.
 *
 * `./tariffPayments` BU YERDA TO'LIQ MOCK QILINADI - `activateTariffPayment`
 * `tariffPayments.test.js`da sinalgan, bu yerda faqat u TO'G'RI
 * chaqirilayotganini tekshiramiz.
 */

function makeDocRef(store, id) {
  return {
    id,
    get: async () => (store[id] !== undefined ? { exists: true, id, data: () => store[id] } : { exists: false, id }),
    set: async (data, opts) => {
      store[id] = opts && opts.merge ? { ...(store[id] || {}), ...data } : data;
    },
    update: async (data) => {
      store[id] = { ...(store[id] || {}), ...data };
    },
  };
}

function buildMockDb({ sellers = {}, atmosPayments = {}, settings = {}, admins = {} } = {}) {
  const collections = { sellers, atmosPayments, settings, admins };
  return {
    __sellers: sellers,
    __atmosPayments: atmosPayments,
    __settings: settings,
    __admins: admins,
    collection: (name) => {
      const store = collections[name];
      if (!store) throw new Error(`Kutilmagan kolleksiya: ${name}`);
      return {
        doc: (id) => makeDocRef(store, id),
        get: async () => ({ docs: Object.keys(store).map((id) => ({ id, data: () => store[id] })) }),
      };
    },
  };
}

function loadModule(db, { checkRateLimitMock, sendTelegramMessageMock, activateTariffPaymentMock } = {}) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: {
      firestore: {
        FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
      },
    },
    db,
    BOT_TOKEN: { value: () => "mock-bot-token" },
  }));
  jest.doMock("../lib/helpers", () => ({
    sendTelegramMessage: sendTelegramMessageMock || jest.fn().mockResolvedValue({ ok: true }),
    buildSellerAppLink: (path) => `https://commerce-zelo.web.app${path || ""}`,
  }));
  jest.doMock("../lib/rateLimit", () => ({ checkRateLimit: checkRateLimitMock || jest.fn().mockResolvedValue(undefined) }));
  jest.doMock("../lib/sentry", () => ({
    SENTRY_DSN: { value: () => "mock-dsn" },
    initSentry: jest.fn(),
    Sentry: { captureException: jest.fn() },
    withSentry: (fn) => fn,
  }));
  jest.doMock("../tariffPayments", () => ({
    activateTariffPayment: activateTariffPaymentMock || jest.fn(),
    TARIFF_PAYMENTS_COLLECTION: "atmosPayments",
  }));
  return require("../manualTariffPayments");
}

describe("handleSetManualTariffPaymentInfo", () => {
  test("tizimga kirmagan foydalanuvchi rad etiladi", async () => {
    const { _testables } = loadModule(buildMockDb());
    await expect(
      _testables.handleSetManualTariffPaymentInfo({ auth: null, data: {} })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("admin bo'lmagan foydalanuvchi rad etiladi", async () => {
    const db = buildMockDb();
    const { _testables } = loadModule(db);
    await expect(
      _testables.handleSetManualTariffPaymentInfo({ auth: { uid: "s1" }, data: { cardNumber: "8600123412341234", cardHolderName: "A A" } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("noto'g'ri (16 ta raqamdan iborat bo'lmagan) karta raqami rad etiladi", async () => {
    const db = buildMockDb({ admins: { admin1: {} } });
    const { _testables } = loadModule(db);
    await expect(
      _testables.handleSetManualTariffPaymentInfo({ auth: { uid: "admin1" }, data: { cardNumber: "123", cardHolderName: "A A" } })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("F.I.Sh. berilmasa rad etiladi", async () => {
    const db = buildMockDb({ admins: { admin1: {} } });
    const { _testables } = loadModule(db);
    await expect(
      _testables.handleSetManualTariffPaymentInfo({ auth: { uid: "admin1" }, data: { cardNumber: "8600 1234 1234 1234", cardHolderName: "  " } })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("admin to'g'ri ma'lumot bilan sozlamani muvaffaqiyatli o'rnatadi (bo'sh joylarni olib tashlab)", async () => {
    const db = buildMockDb({ admins: { admin1: {} } });
    const { _testables } = loadModule(db);

    const result = await _testables.handleSetManualTariffPaymentInfo({
      auth: { uid: "admin1" },
      data: { cardNumber: "8600 1234 1234 1234", cardHolderName: "Aliyev Ali" },
    });

    expect(result).toEqual({ success: true });
    expect(db.__settings.manualTariffPayment).toMatchObject({
      cardNumber: "8600123412341234",
      cardHolderName: "Aliyev Ali",
      enabled: true,
      updatedBy: "admin1",
    });
  });

  test("enabled:false yuborilsa - validatsiyasiz, mavjud ma'lumotni o'chirmasdan yashiradi", async () => {
    const db = buildMockDb({
      admins: { admin1: {} },
      settings: { manualTariffPayment: { enabled: true, cardNumber: "8600123412341234", cardHolderName: "Aliyev Ali" } },
    });
    const { _testables } = loadModule(db);

    const result = await _testables.handleSetManualTariffPaymentInfo({
      auth: { uid: "admin1" },
      data: { enabled: false },
    });

    expect(result).toEqual({ success: true });
    expect(db.__settings.manualTariffPayment.enabled).toBe(false);
  });
});

describe("handleSubmitManualTariffPayment", () => {
  const enabledSettings = { manualTariffPayment: { enabled: true, cardNumber: "8600123412341234", cardHolderName: "Aliyev Ali" } };

  test("tizimga kirmagan foydalanuvchi rad etiladi", async () => {
    const { _testables } = loadModule(buildMockDb());
    await expect(
      _testables.handleSubmitManualTariffPayment({ auth: null, data: { plan: "start", receiptUrl: "https://x" } })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("sotib olib bo'lmaydigan tarif rad etiladi", async () => {
    const db = buildMockDb({ sellers: { s1: {} }, settings: enabledSettings });
    const { _testables } = loadModule(db);
    await expect(
      _testables.handleSubmitManualTariffPayment({ auth: { uid: "s1" }, data: { plan: "biznes", receiptUrl: "https://x" } })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("receiptUrl berilmasa rad etiladi", async () => {
    const db = buildMockDb({ sellers: { s1: {} }, settings: enabledSettings });
    const { _testables } = loadModule(db);
    await expect(
      _testables.handleSubmitManualTariffPayment({ auth: { uid: "s1" }, data: { plan: "start" } })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("sotuvchi hujjati topilmasa rad etiladi", async () => {
    const db = buildMockDb({ settings: enabledSettings });
    const { _testables } = loadModule(db);
    await expect(
      _testables.handleSubmitManualTariffPayment({ auth: { uid: "s1" }, data: { plan: "start", receiptUrl: "https://x" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("qo'lda to'lov sozlamasi yoqilmagan bo'lsa rad etiladi", async () => {
    const db = buildMockDb({ sellers: { s1: {} } });
    const { _testables } = loadModule(db);
    await expect(
      _testables.handleSubmitManualTariffPayment({ auth: { uid: "s1" }, data: { plan: "start", receiptUrl: "https://x" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("to'g'ri so'rov - atmosPayments hujjatini method:manual/status:pending_review bilan yaratadi", async () => {
    const db = buildMockDb({ sellers: { s1: { storeName: "Mening do'konim", phone: "+998901234567" } }, settings: enabledSettings, admins: { admin1: {} } });
    const dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(1700000000000);
    const { _testables } = loadModule(db);

    let result;
    try {
      result = await _testables.handleSubmitManualTariffPayment({
        auth: { uid: "s1" },
        data: { plan: "pro", receiptUrl: "https://storage/receipt.jpg" },
      });
    } finally {
      dateNowSpy.mockRestore();
    }

    const expectedDocId = "manual_s1_1700000000000";
    expect(result).toEqual({ paymentDocId: expectedDocId, status: "pending_review", amountSom: 199000 });
    expect(db.__atmosPayments[expectedDocId]).toMatchObject({
      sellerId: "s1",
      plan: "pro",
      amountSom: 199000,
      amountTiyin: 19900000,
      method: "manual",
      status: "pending_review",
      receiptUrl: "https://storage/receipt.jpg",
      storeName: "Mening do'konim",
      sellerPhone: "+998901234567",
    });
  });

  test("rate-limit tekshiruvini to'g'ri chaqiradi", async () => {
    const checkRateLimitMock = jest.fn().mockResolvedValue(undefined);
    const db = buildMockDb({ sellers: { s1: {} }, settings: enabledSettings });
    const { _testables } = loadModule(db, { checkRateLimitMock });
    await _testables.handleSubmitManualTariffPayment({ auth: { uid: "s1" }, data: { plan: "start", receiptUrl: "https://x" } });
    expect(checkRateLimitMock).toHaveBeenCalledWith("submitManualTariffPayment:s1", 10, 3600);
  });

  test("adminlarga Telegram xabari yuboriladi, lekin xabar yuborilmasa ham so'rov muvaffaqiyatli qoladi", async () => {
    const db = buildMockDb({ sellers: { s1: {} }, settings: enabledSettings, admins: { admin1: {}, admin2: {} } });
    const sendTelegramMessageMock = jest.fn().mockRejectedValue(new Error("Telegram vaqtincha ishlamayapti"));
    const { _testables } = loadModule(db, { sendTelegramMessageMock });

    const result = await _testables.handleSubmitManualTariffPayment({
      auth: { uid: "s1" },
      data: { plan: "start", receiptUrl: "https://x" },
    });

    expect(result.status).toBe("pending_review");
    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(2);
  });
});

describe("handleReviewManualTariffPayment", () => {
  test("tizimga kirmagan foydalanuvchi rad etiladi", async () => {
    const { _testables } = loadModule(buildMockDb());
    await expect(
      _testables.handleReviewManualTariffPayment({ auth: null, data: {} })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("admin bo'lmagan foydalanuvchi rad etiladi", async () => {
    const db = buildMockDb();
    const { _testables } = loadModule(db);
    await expect(
      _testables.handleReviewManualTariffPayment({ auth: { uid: "s1" }, data: { paymentDocId: "manual_1", action: "approve" } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("noto'g'ri amal (action) rad etiladi", async () => {
    const db = buildMockDb({ admins: { admin1: {} } });
    const { _testables } = loadModule(db);
    await expect(
      _testables.handleReviewManualTariffPayment({ auth: { uid: "admin1" }, data: { paymentDocId: "manual_1", action: "delete" } })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("to'lov topilmasa rad etiladi", async () => {
    const db = buildMockDb({ admins: { admin1: {} } });
    const { _testables } = loadModule(db);
    await expect(
      _testables.handleReviewManualTariffPayment({ auth: { uid: "admin1" }, data: { paymentDocId: "manual_1", action: "approve" } })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  test("method:manual bo'lmagan yozuvga tegilmaydi", async () => {
    const db = buildMockDb({
      admins: { admin1: {} },
      atmosPayments: { 999: { sellerId: "s1", plan: "start", status: "created" } }, // `method` yo'q
    });
    const { _testables } = loadModule(db);
    await expect(
      _testables.handleReviewManualTariffPayment({ auth: { uid: "admin1" }, data: { paymentDocId: "999", action: "approve" } })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("tasdiqlash: activateTariffPayment'ni chaqiradi, hujjatni belgilaydi va sotuvchiga xabar yuboradi", async () => {
    const db = buildMockDb({
      admins: { admin1: {} },
      atmosPayments: { manual_s1_1: { sellerId: "s1", plan: "pro", status: "pending_review", method: "manual" } },
    });
    const activateTariffPaymentMock = jest.fn().mockResolvedValue({ alreadyProcessed: false, plan: "pro", paidUntilMs: 123456789 });
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const { _testables } = loadModule(db, { activateTariffPaymentMock, sendTelegramMessageMock });

    const result = await _testables.handleReviewManualTariffPayment({
      auth: { uid: "admin1" },
      data: { paymentDocId: "manual_s1_1", action: "approve" },
    });

    expect(activateTariffPaymentMock).toHaveBeenCalledWith({ paymentDocId: "manual_s1_1", callbackRaw: null });
    expect(result).toEqual({ status: "paid", plan: "pro", paidUntilMs: 123456789 });
    expect(db.__atmosPayments.manual_s1_1.reviewedBy).toBe("admin1");
    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    expect(sendTelegramMessageMock.mock.calls[0][1]).toBe("s1");
  });

  test("tasdiqlash: ALLAQACHON to'langan bo'lsa - activateTariffPayment qayta chaqirilmaydi (IDEMPOTENT)", async () => {
    const db = buildMockDb({
      admins: { admin1: {} },
      atmosPayments: { manual_s1_1: { sellerId: "s1", plan: "pro", status: "paid", method: "manual" } },
    });
    const activateTariffPaymentMock = jest.fn();
    const { _testables } = loadModule(db, { activateTariffPaymentMock });

    const result = await _testables.handleReviewManualTariffPayment({
      auth: { uid: "admin1" },
      data: { paymentDocId: "manual_s1_1", action: "approve" },
    });

    expect(result).toEqual({ status: "paid", alreadyProcessed: true });
    expect(activateTariffPaymentMock).not.toHaveBeenCalled();
  });

  test("rad etish: hujjatni status:rejected bilan belgilaydi, sababini saqlaydi va sotuvchiga xabar yuboradi", async () => {
    const db = buildMockDb({
      admins: { admin1: {} },
      atmosPayments: { manual_s1_1: { sellerId: "s1", plan: "start", status: "pending_review", method: "manual" } },
    });
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const { _testables } = loadModule(db, { sendTelegramMessageMock });

    const result = await _testables.handleReviewManualTariffPayment({
      auth: { uid: "admin1" },
      data: { paymentDocId: "manual_s1_1", action: "reject", rejectReason: "Kartaga pul tushmagan" },
    });

    expect(result).toEqual({ status: "rejected" });
    expect(db.__atmosPayments.manual_s1_1).toMatchObject({
      status: "rejected",
      rejectedBy: "admin1",
      rejectReason: "Kartaga pul tushmagan",
    });
    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
  });

  test("rad etish: ALLAQACHON to'langan bo'lsa - xato tashlaydi", async () => {
    const db = buildMockDb({
      admins: { admin1: {} },
      atmosPayments: { manual_s1_1: { sellerId: "s1", plan: "start", status: "paid", method: "manual" } },
    });
    const { _testables } = loadModule(db);
    await expect(
      _testables.handleReviewManualTariffPayment({ auth: { uid: "admin1" }, data: { paymentDocId: "manual_s1_1", action: "reject" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("rad etish: ALLAQACHON rad etilgan bo'lsa - IDEMPOTENT natija qaytaradi", async () => {
    const db = buildMockDb({
      admins: { admin1: {} },
      atmosPayments: { manual_s1_1: { sellerId: "s1", plan: "start", status: "rejected", method: "manual" } },
    });
    const { _testables } = loadModule(db);
    const result = await _testables.handleReviewManualTariffPayment({
      auth: { uid: "admin1" },
      data: { paymentDocId: "manual_s1_1", action: "reject" },
    });
    expect(result).toEqual({ status: "rejected", alreadyProcessed: true });
  });
});
