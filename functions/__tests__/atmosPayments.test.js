/**
 * `atmosPayments.js` uchun testlar — Atmos hosted-checkout orqali
 * HAQIQIY tarif to'lovi oqimi: tranzaksiya yaratish (idempotentlik
 * bilan), Callback webhook (imzo/summasi tekshiruvi), reconciliation
 * (`getTariffPaymentStatus`), va kunlik eslatma yuborish.
 *
 * `tariffs.test.js`dagi BIR XIL mock-db naqshi ishlatiladi
 * (`jest.doMock("../lib/admin", ...)` va h.k.) — `./lib/atmosClient`
 * esa (haqiqiy tarmoq so'rovi yuboradigan modul) to'liq mock qilinadi,
 * `./lib/tariffs` esa SOF (pure) funksiyalar bo'lgani uchun HAQIQIY
 * modul ishlatiladi (integratsiyani ham sinash uchun).
 */

function makeQueryStub(docs) {
  const stub = {
    where: () => stub,
    limit: () => stub,
    get: async () => ({ empty: docs.length === 0, docs }),
  };
  return stub;
}

function buildMockDb({ sellers = {}, atmosPayments = {}, pendingPaymentDocs = [], sellersQueryDocs = null } = {}) {
  const updateCalls = [];
  const setCalls = [];

  function makeDocRef(store, id) {
    return {
      id,
      get: async () => (store[id] ? { exists: true, id, data: () => store[id] } : { exists: false, id }),
      set: async (data) => {
        setCalls.push({ id, data });
        store[id] = data;
      },
      update: async (data) => {
        updateCalls.push({ id, data });
        store[id] = { ...(store[id] || {}), ...data };
      },
    };
  }

  const sellersCol = {
    doc: (id) => makeDocRef(sellers, id),
    where: () => makeQueryStub(sellersQueryDocs || []),
  };
  const atmosPaymentsCol = {
    doc: (id) => makeDocRef(atmosPayments, id),
    where: () => makeQueryStub(pendingPaymentDocs),
  };

  return {
    __sellers: sellers,
    __atmosPayments: atmosPayments,
    __updateCalls: updateCalls,
    __setCalls: setCalls,
    collection: (name) => {
      if (name === "sellers") return sellersCol;
      if (name === "atmosPayments") return atmosPaymentsCol;
      throw new Error(`Kutilmagan kolleksiya: ${name}`);
    },
    runTransaction: async (fn) => {
      const tx = {
        get: async (ref) => ref.get(),
        update: (ref, data) => {
          ref.update(data);
        },
      };
      return fn(tx);
    },
  };
}

function loadModule(db, { checkRateLimitMock, sendTelegramMessageMock, atmosClientMock } = {}) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => "SERVER_TIMESTAMP",
          delete: () => ({ __delete: true }),
        },
        Timestamp: {
          now: () => ({ toMillis: () => Date.now() }),
          fromMillis: (ms) => ({ toMillis: () => ms }),
        },
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
  jest.doMock("../lib/atmosClient", () => ({
    ATMOS_CONSUMER_KEY: { value: () => "mock-key" },
    ATMOS_CONSUMER_SECRET: { value: () => "mock-secret" },
    ATMOS_STORE_ID: { value: () => "1234" },
    ATMOS_API_KEY: { value: () => "mock-api-key" },
    ATMOS_ENV: { value: () => "production" },
    ATMOS_PROXY_TOKEN: { value: () => "mock-proxy-token" },
    createCheckoutInvoice: jest.fn().mockResolvedValue({
      storeId: 1234,
      paymentId: 272,
      token: "invoice-token",
      url: "https://checkout.atmos.uz/ru/invoice?id=invoice-token",
    }),
    getCheckoutInvoiceStatus: jest.fn().mockResolvedValue({ success: false, final: false, state: "PENDING", raw: {} }),
    verifyCallbackSign: jest.fn(() => true),
    ...atmosClientMock,
  }));
  return require("../atmosPayments");
}

function fakeRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn((body) => {
    res.body = body;
    return res;
  });
  return res;
}

describe("handleCreateTariffPayment", () => {
  test("tizimga kirmagan foydalanuvchi rad etiladi", async () => {
    const { _testables } = loadModule(buildMockDb());
    await expect(_testables.handleCreateTariffPayment({ auth: null, data: { plan: "start" } })).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  test("sotib olib bo'lmaydigan tarif (masalan 'biznes') rad etiladi", async () => {
    const db = buildMockDb({ sellers: { s1: {} } });
    const { _testables } = loadModule(db);
    await expect(
      _testables.handleCreateTariffPayment({ auth: { uid: "s1" }, data: { plan: "biznes" } })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("sotuvchi hujjati topilmasa rad etiladi", async () => {
    const db = buildMockDb();
    const { _testables } = loadModule(db);
    await expect(
      _testables.handleCreateTariffPayment({ auth: { uid: "s1" }, data: { plan: "start" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("yangi tranzaksiya yaratadi va atmosPayments hujjatini to'g'ri yozadi", async () => {
    const db = buildMockDb({ sellers: { s1: { storeName: "Do'kon" } } });
    const dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(1700000000000);
    const { _testables } = loadModule(db);

    let result;
    try {
      result = await _testables.handleCreateTariffPayment({ auth: { uid: "s1" }, data: { plan: "start" } });
    } finally {
      dateNowSpy.mockRestore();
    }

    const expectedRequestId = "tariff-s1-1700000000000";
    expect(result).toEqual({
      transactionId: expectedRequestId,
      checkoutUrl: "https://checkout.atmos.uz/ru/invoice?id=invoice-token",
      amountSom: 49000,
    });
    expect(db.__atmosPayments[expectedRequestId]).toMatchObject({
      sellerId: "s1",
      plan: "start",
      amountSom: 49000,
      amountTiyin: 4900000,
      status: "created",
      paymentId: 272,
      paymentToken: "invoice-token",
      checkoutUrl: "https://checkout.atmos.uz/ru/invoice?id=invoice-token",
    });
  });

  test("createCheckoutInvoice'ga to'g'ri items[] (ИКПУ/STIR) va success_url yuboradi", async () => {
    const db = buildMockDb({ sellers: { s1: {} } });
    const createCheckoutInvoiceMock = jest.fn().mockResolvedValue({
      storeId: 1234, paymentId: 1, token: "t", url: "https://checkout.atmos.uz/x",
    });
    const { _testables } = loadModule(db, { atmosClientMock: { createCheckoutInvoice: createCheckoutInvoiceMock } });

    await _testables.handleCreateTariffPayment({ auth: { uid: "s1" }, data: { plan: "pro" } });

    expect(createCheckoutInvoiceMock).toHaveBeenCalledTimes(1);
    const callArgs = createCheckoutInvoiceMock.mock.calls[0][0];
    expect(callArgs.amountSom).toBe(199000);
    expect(callArgs.successUrl).toMatch(/\/seller\/tariffs\?atmosTxn=tariff-s1-/);
    expect(callArgs.items).toHaveLength(1);
    expect(callArgs.items[0]).toMatchObject({
      code: "10305008003000000",
      amount: 19900000,
      quantity: 1,
    });
    const tinDetail = callArgs.items[0].details.find((d) => d.name === "tin");
    expect(tinDetail.values).toBe("313278793");
  });

  test("30 daqiqa ichida yaratilgan, hali to'lanmagan tranzaksiya bo'lsa - YANGISINI yaratmasdan uni qayta ishlatadi", async () => {
    const pendingDoc = {
      id: "tariff-s1-999",
      data: () => ({ checkoutUrl: "https://checkout.atmos.uz/ru/invoice?id=old-token", amountSom: 49000 }),
    };
    const db = buildMockDb({ sellers: { s1: {} }, pendingPaymentDocs: [pendingDoc] });
    const createCheckoutInvoiceMock = jest.fn();
    const { _testables } = loadModule(db, { atmosClientMock: { createCheckoutInvoice: createCheckoutInvoiceMock } });

    const result = await _testables.handleCreateTariffPayment({ auth: { uid: "s1" }, data: { plan: "start" } });

    expect(result).toEqual({
      transactionId: "tariff-s1-999",
      checkoutUrl: "https://checkout.atmos.uz/ru/invoice?id=old-token",
      amountSom: 49000,
    });
    expect(createCheckoutInvoiceMock).not.toHaveBeenCalled();
  });

  test("rate-limit tekshiruvini to'g'ri chaqiradi", async () => {
    const checkRateLimitMock = jest.fn().mockResolvedValue(undefined);
    const db = buildMockDb({ sellers: { s1: {} } });
    const { _testables } = loadModule(db, { checkRateLimitMock });
    await _testables.handleCreateTariffPayment({ auth: { uid: "s1" }, data: { plan: "pro" } });
    expect(checkRateLimitMock).toHaveBeenCalledWith("createTariffPayment:s1", 10, 3600);
  });

  test("Z-Pro uchun to'g'ri summani (199 000 so'm) yuboradi", async () => {
    const db = buildMockDb({ sellers: { s1: {} } });
    const createCheckoutInvoiceMock = jest.fn().mockResolvedValue({
      storeId: 1234, paymentId: 777, token: "t", url: "https://checkout.atmos.uz/y",
    });
    const { _testables } = loadModule(db, { atmosClientMock: { createCheckoutInvoice: createCheckoutInvoiceMock } });

    await _testables.handleCreateTariffPayment({ auth: { uid: "s1" }, data: { plan: "pro" } });

    expect(createCheckoutInvoiceMock).toHaveBeenCalledWith(
      expect.objectContaining({ amountSom: 199000 })
    );
  });
});

describe("activateTariffPayment", () => {
  test("to'lovni faollashtiradi: sellerga tariffPlan/tariffPaidUntil yozadi, IDEMPOTENT emas bo'lgani qaytadi", async () => {
    const now = Date.now();
    const db = buildMockDb({
      sellers: { s1: { tariffPlan: "start" } },
      atmosPayments: { 555: { sellerId: "s1", plan: "pro", status: "created" } },
    });
    const { _testables } = loadModule(db);

    const result = await _testables.activateTariffPayment({ paymentDocId: 555 });

    expect(result.alreadyProcessed).toBe(false);
    expect(result.plan).toBe("pro");
    expect(db.__sellers.s1.tariffPlan).toBe("pro");
    expect(db.__sellers.s1.tariffPaidUntil.toMillis()).toBeGreaterThan(now + 29 * 24 * 60 * 60 * 1000);
    expect(db.__sellers.s1.tariffLastPaymentAt).toBe("SERVER_TIMESTAMP");
    expect(db.__atmosPayments["555"].status).toBe("paid");
  });

  test("Z-Pro to'lovi AI CEO'ni hali yoqilmagan bo'lsa yoqadi va bayroq qo'yadi", async () => {
    const db = buildMockDb({
      sellers: { s1: { tariffPlan: "start", aiCeoEnabled: false } },
      atmosPayments: { 555: { sellerId: "s1", plan: "pro", status: "created" } },
    });
    const { _testables } = loadModule(db);
    await _testables.activateTariffPayment({ paymentDocId: 555 });

    expect(db.__sellers.s1.aiCeoEnabled).toBe(true);
    expect(db.__sellers.s1.aiCeoGrantedViaPaidTariff).toBe(true);
  });

  test("ALLAQACHON to'langan tranzaksiya - IDEMPOTENT (qayta ishlov bermaydi)", async () => {
    const db = buildMockDb({
      sellers: { s1: { tariffPlan: "pro" } },
      atmosPayments: { 555: { sellerId: "s1", plan: "pro", status: "paid", sellerPaidUntilAtActivation: 123456 } },
    });
    const { _testables } = loadModule(db);

    const result = await _testables.activateTariffPayment({ paymentDocId: 555 });

    expect(result.alreadyProcessed).toBe(true);
    expect(result.paidUntilMs).toBe(123456);
  });

  test("joriy to'langan muddat kelajakda bo'lsa - shu muddatdan (hozirdan emas) 30 kun qo'shadi", async () => {
    const now = Date.now();
    const futurePaidUntil = now + 20 * 24 * 60 * 60 * 1000; // 20 kundan keyin tugaydi
    const db = buildMockDb({
      sellers: { s1: { tariffPlan: "start", tariffPaidUntil: { toMillis: () => futurePaidUntil } } },
      atmosPayments: { 555: { sellerId: "s1", plan: "start", status: "created" } },
    });
    const { _testables } = loadModule(db);

    await _testables.activateTariffPayment({ paymentDocId: 555 });

    const newPaidUntil = db.__sellers.s1.tariffPaidUntil.toMillis();
    expect(newPaidUntil).toBeGreaterThanOrEqual(futurePaidUntil + 30 * 24 * 60 * 60 * 1000 - 1000);
  });

  test("to'lov hujjati topilmasa - xato tashlaydi", async () => {
    const db = buildMockDb({ sellers: { s1: {} } });
    const { _testables } = loadModule(db);
    await expect(_testables.activateTariffPayment({ paymentDocId: 999 })).rejects.toThrow(/topilmadi/);
  });
});

describe("handleAtmosPaymentCallback", () => {
  test("imzo noto'g'ri bo'lsa - HTTP 200 + status:0 qaytaradi (Atmos shartiga ko'ra)", async () => {
    const db = buildMockDb();
    const { _testables } = loadModule(db, { atmosClientMock: { verifyCallbackSign: jest.fn(() => false) } });
    const res = fakeRes();

    await _testables.handleAtmosPaymentCallback(
      { body: { store_id: "1234", transaction_id: 555, amount: 4900000, invoice: "inv-1", sign: "bad" } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.status).toBe(0);
  });

  test("majburiy maydonlar yetishmasa - status:0 qaytaradi", async () => {
    const db = buildMockDb();
    const { _testables } = loadModule(db);
    const res = fakeRes();

    await _testables.handleAtmosPaymentCallback({ body: { store_id: "1234" } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.status).toBe(0);
  });

  test("noto'g'ri store_id - status:0 qaytaradi", async () => {
    const db = buildMockDb();
    const { _testables } = loadModule(db);
    const res = fakeRes();

    await _testables.handleAtmosPaymentCallback(
      { body: { store_id: "9999", transaction_id: 555, amount: 4900000, invoice: "inv-1", sign: "x" } },
      res
    );

    expect(res.body.status).toBe(0);
    expect(res.body.message).toMatch(/merchant/);
  });

  test("tranzaksiya tizimda topilmasa - status:0 qaytaradi", async () => {
    const db = buildMockDb();
    const { _testables } = loadModule(db);
    const res = fakeRes();

    await _testables.handleAtmosPaymentCallback(
      { body: { store_id: "1234", transaction_id: 555, amount: 4900000, invoice: "inv-1", sign: "x" } },
      res
    );

    expect(res.body.status).toBe(0);
    expect(res.body.message).toMatch(/topilmadi/);
  });

  test("summa mos kelmasa - status:0 qaytaradi", async () => {
    const paymentDoc = { id: "tariff-s1-555", data: () => ({ sellerId: "s1", plan: "start", amountTiyin: 4900000, paymentId: 555 }) };
    const db = buildMockDb({ pendingPaymentDocs: [paymentDoc] });
    const { _testables } = loadModule(db);
    const res = fakeRes();

    await _testables.handleAtmosPaymentCallback(
      { body: { store_id: "1234", transaction_id: 999, amount: 1000000, invoice: 555, sign: "x" } },
      res
    );

    expect(res.body.status).toBe(0);
    expect(res.body.message).toMatch(/Summalar/);
  });

  test("hammasi to'g'ri bo'lsa - to'lovni faollashtiradi va status:1 qaytaradi", async () => {
    const paymentDoc = {
      id: "tariff-s1-555",
      data: () => ({ sellerId: "s1", plan: "pro", amountTiyin: 19900000, status: "created", paymentId: 555 }),
    };
    const db = buildMockDb({
      sellers: { s1: { tariffPlan: "start" } },
      atmosPayments: { "tariff-s1-555": { sellerId: "s1", plan: "pro", amountTiyin: 19900000, status: "created", paymentId: 555 } },
      pendingPaymentDocs: [paymentDoc],
    });
    const { _testables } = loadModule(db);
    const res = fakeRes();

    await _testables.handleAtmosPaymentCallback(
      { body: { store_id: "1234", transaction_id: 999, amount: 19900000, invoice: 555, sign: "x" } },
      res
    );

    expect(res.body).toEqual({ status: 1, message: "Успешно" });
    expect(db.__sellers.s1.tariffPlan).toBe("pro");
    expect(db.__atmosPayments["tariff-s1-555"].status).toBe("paid");
  });

  // 2026-09-13: real production xatosi — terminalda qo'lda kiritilgan
  // Atmos sekret/parametrlariga (bu yerda `ATMOS_STORE_ID`) bilinmas
  // boshi/oxiri probel qo'shilib qolishi mumkin. Bu holatda ham webhook
  // "noto'g'ri merchant" deb RAD ETMASLIGI kerak — `.trim()` orqali.
  test("ATMOS_STORE_ID atrofida bo'sh joy bo'lsa ham store_id'ni to'g'ri taniydi", async () => {
    const paymentDoc = {
      id: "tariff-s1-555",
      data: () => ({ sellerId: "s1", plan: "pro", amountTiyin: 19900000, status: "created", paymentId: 555 }),
    };
    const db = buildMockDb({
      sellers: { s1: { tariffPlan: "start" } },
      atmosPayments: { "tariff-s1-555": { sellerId: "s1", plan: "pro", amountTiyin: 19900000, status: "created", paymentId: 555 } },
      pendingPaymentDocs: [paymentDoc],
    });
    const { _testables } = loadModule(db, {
      atmosClientMock: { ATMOS_STORE_ID: { value: () => "  1234\n" } },
    });
    const res = fakeRes();

    await _testables.handleAtmosPaymentCallback(
      { body: { store_id: "1234", transaction_id: 999, amount: 19900000, invoice: 555, sign: "x" } },
      res
    );

    expect(res.body).toEqual({ status: 1, message: "Успешно" });
  });

  test("kutilmagan ichki xatolik bo'lsa ham HTTP 200 qaytaradi (Atmos qayta urinishining oldini olish)", async () => {
    const db = buildMockDb();
    db.collection = () => {
      throw new Error("kutilmagan Firestore xatosi");
    };
    const { _testables } = loadModule(db);
    const res = fakeRes();

    await _testables.handleAtmosPaymentCallback(
      { body: { store_id: "1234", transaction_id: 555, amount: 1000, invoice: "inv-1", sign: "x" } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.status).toBe(0);
  });
});

describe("handleGetTariffPaymentStatus", () => {
  test("tizimga kirmagan foydalanuvchi rad etiladi", async () => {
    const { _testables } = loadModule(buildMockDb());
    await expect(_testables.handleGetTariffPaymentStatus({ auth: null, data: { transactionId: "555" } })).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  test("transactionId berilmasa rad etiladi", async () => {
    const { _testables } = loadModule(buildMockDb());
    await expect(_testables.handleGetTariffPaymentStatus({ auth: { uid: "s1" }, data: {} })).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  test("to'lov topilmasa rad etiladi", async () => {
    const { _testables } = loadModule(buildMockDb());
    await expect(
      _testables.handleGetTariffPaymentStatus({ auth: { uid: "s1" }, data: { transactionId: "555" } })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  test("boshqa sotuvchining to'lovini so'rasa rad etiladi", async () => {
    const db = buildMockDb({ atmosPayments: { 555: { sellerId: "s2", plan: "start" } } });
    const { _testables } = loadModule(db);
    await expect(
      _testables.handleGetTariffPaymentStatus({ auth: { uid: "s1" }, data: { transactionId: "555" } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("allaqachon 'paid' bo'lsa - Atmos'ga murojaat qilmasdan keshlangan natijani qaytaradi", async () => {
    const db = buildMockDb({
      atmosPayments: { 555: { sellerId: "s1", plan: "pro", status: "paid", sellerPaidUntilAtActivation: 999 } },
    });
    const getCheckoutInvoiceStatusMock = jest.fn();
    const { _testables } = loadModule(db, { atmosClientMock: { getCheckoutInvoiceStatus: getCheckoutInvoiceStatusMock } });

    const result = await _testables.handleGetTariffPaymentStatus({ auth: { uid: "s1" }, data: { transactionId: "555" } });

    expect(result).toEqual({ status: "paid", plan: "pro", paidUntilMs: 999 });
    expect(getCheckoutInvoiceStatusMock).not.toHaveBeenCalled();
  });

  test("hali 'created' holatda, LEKIN Atmos'da success:true bo'lsa - ZAXIRA yo'l bilan faollashtiradi", async () => {
    const db = buildMockDb({
      sellers: { s1: { tariffPlan: "start" } },
      atmosPayments: { 555: { sellerId: "s1", plan: "pro", status: "created", amountSom: 199000, paymentId: 272 } },
    });
    const { _testables } = loadModule(db, {
      atmosClientMock: { getCheckoutInvoiceStatus: jest.fn().mockResolvedValue({ success: true, final: true, state: "SUCCESS", raw: {} }) },
    });

    const result = await _testables.handleGetTariffPaymentStatus({ auth: { uid: "s1" }, data: { transactionId: "555" } });

    expect(result.status).toBe("paid");
    expect(result.plan).toBe("pro");
    expect(db.__sellers.s1.tariffPlan).toBe("pro");
  });

  test("hali 'created' holatda VA Atmos'da ham tasdiqlanmagan - 'created' qaytaradi (xato TASHLAMAYDI)", async () => {
    const db = buildMockDb({
      atmosPayments: { 555: { sellerId: "s1", plan: "start", status: "created", amountSom: 49000, paymentId: 1 } },
    });
    const { _testables } = loadModule(db, {
      atmosClientMock: { getCheckoutInvoiceStatus: jest.fn().mockResolvedValue({ success: false, final: false, state: "PENDING", raw: {} }) },
    });

    const result = await _testables.handleGetTariffPaymentStatus({ auth: { uid: "s1" }, data: { transactionId: "555" } });

    expect(result).toEqual({ status: "created", plan: "start", amountSom: 49000 });
  });

  test("Atmos so'rovi xato bersa ham - 'created' holatini qaytaradi (frontend buzilmaydi)", async () => {
    const db = buildMockDb({
      atmosPayments: { 555: { sellerId: "s1", plan: "start", status: "created", amountSom: 49000, paymentId: 1 } },
    });
    const { _testables } = loadModule(db, {
      atmosClientMock: { getCheckoutInvoiceStatus: jest.fn().mockRejectedValue(new Error("Atmos vaqtincha ishlamayapti")) },
    });

    const result = await _testables.handleGetTariffPaymentStatus({ auth: { uid: "s1" }, data: { transactionId: "555" } });

    expect(result).toEqual({ status: "created", plan: "start", amountSom: 49000 });
  });

  test("payment hujjatida paymentId hali yo'q bo'lsa - reconciliation'ni o'tkazib yuboradi ('created' qaytaradi)", async () => {
    const db = buildMockDb({
      atmosPayments: { 555: { sellerId: "s1", plan: "start", status: "created", amountSom: 49000 } },
    });
    const getCheckoutInvoiceStatusMock = jest.fn();
    const { _testables } = loadModule(db, { atmosClientMock: { getCheckoutInvoiceStatus: getCheckoutInvoiceStatusMock } });

    const result = await _testables.handleGetTariffPaymentStatus({ auth: { uid: "s1" }, data: { transactionId: "555" } });

    expect(result).toEqual({ status: "created", plan: "start", amountSom: 49000 });
    expect(getCheckoutInvoiceStatusMock).not.toHaveBeenCalled();
  });
});

describe("handleSendTariffPaymentReminders", () => {
  test("past-due sotuvchiga 'bepul davr tugadi' xabarini yuboradi va belgi qo'yadi", async () => {
    const cutoffMs = Date.parse("2026-09-11T00:00:00+05:00");
    const createdAtMs = cutoffMs + 20 * 24 * 60 * 60 * 1000; // billing rejimida, cutoff'dan 20 kun keyin ro'yxatdan o'tgan
    const fixedNowMs = cutoffMs + 200 * 24 * 60 * 60 * 1000; // "hozir" - ro'yxatdan o'tgandan ANCHA keyin (grace muddati aniq tugagan)
    const dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(fixedNowMs);

    const sellerDoc = {
      id: "s1",
      data: () => ({ createdAt: { toMillis: () => createdAtMs } }),
      ref: null,
    };
    const db = buildMockDb({ sellers: { s1: { createdAt: { toMillis: () => createdAtMs } } } });
    sellerDoc.ref = { update: (data) => db.collection("sellers").doc("s1").update(data) };
    const originalCollection = db.collection;
    db.collection = (name) => {
      if (name === "sellers") {
        return {
          ...originalCollection(name),
          where: () => makeQueryStub([sellerDoc]),
        };
      }
      return originalCollection(name);
    };

    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const { _testables } = loadModule(db, { sendTelegramMessageMock });

    try {
      await _testables.handleSendTariffPaymentReminders();
    } finally {
      dateNowSpy.mockRestore();
    }

    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    const [, chatId, text] = sendTelegramMessageMock.mock.calls[0];
    expect(chatId).toBe("s1");
    expect(text).toMatch(/Bepul davr tugadi/);
    expect(db.__sellers.s1.tariffPaymentReminderSentAt).toBe("SERVER_TIMESTAMP");
  });

  test("allaqachon eslatma yuborilgan sotuvchini qayta o'tkazib yuboradi", async () => {
    const createdAtMs = Date.parse("2026-09-11T00:00:00+05:00") + 20 * 24 * 60 * 60 * 1000;
    const sellerDoc = {
      id: "s1",
      data: () => ({ createdAt: { toMillis: () => createdAtMs }, tariffPaymentReminderSentAt: "SERVER_TIMESTAMP" }),
      ref: { update: jest.fn() },
    };
    const db = buildMockDb({ sellers: {} });
    const originalCollection = db.collection;
    db.collection = (name) => {
      if (name === "sellers") {
        return { ...originalCollection(name), where: () => makeQueryStub([sellerDoc]) };
      }
      return originalCollection(name);
    };
    const sendTelegramMessageMock = jest.fn();
    const { _testables } = loadModule(db, { sendTelegramMessageMock });

    await _testables.handleSendTariffPaymentReminders();

    expect(sendTelegramMessageMock).not.toHaveBeenCalled();
    expect(sellerDoc.ref.update).not.toHaveBeenCalled();
  });

  test("grandfathered (cutoff'dan OLDIN yaratilgan) sotuvchi - so'rovga umuman kirmaydi (query cutoff bilan filtrlaydi)", async () => {
    // Bu holat query darajasida filtrlanadi (`where("createdAt", ">=", cutoff)`)
    // - shuning uchun testda oddiy bo'sh natija qaytarilishini tekshiramiz.
    const db = buildMockDb({ sellersQueryDocs: [] });
    const sendTelegramMessageMock = jest.fn();
    const { _testables } = loadModule(db, { sendTelegramMessageMock });

    await _testables.handleSendTariffPaymentReminders();

    expect(sendTelegramMessageMock).not.toHaveBeenCalled();
  });
});

describe("buildTariffInvoiceItems", () => {
  test("ИКПУ kodi va STIR'ni to'g'ri items[] shaklida quradi", () => {
    const { _testables } = loadModule(buildMockDb());
    const items = _testables.buildTariffInvoiceItems({ plan: "pro", amountTiyin: 19900000 });

    expect(items).toHaveLength(1);
    expect(items[0].code).toBe("10305008003000000");
    expect(items[0].amount).toBe(19900000);
    expect(items[0].quantity).toBe(1);
    expect(items[0].details).toEqual(
      expect.arrayContaining([
        { name: "tin", values: "313278793" },
        { name: "discount", values: "0" },
      ])
    );
  });

  test("package_code/mark_code neytral placeholder ('0') bilan yuboriladi (jismoniy tovarga xos, xizmatga tegishli emas — lekin Atmos BO'SH qatorni 'Invalid request format' deb rad etgani uchun 2026-09-14'da o'zgartirildi)", () => {
    const { _testables } = loadModule(buildMockDb());
    const items = _testables.buildTariffInvoiceItems({ plan: "start", amountTiyin: 4900000 });

    const packageDetail = items[0].details.find((d) => d.name === "package_code");
    const markDetail = items[0].details.find((d) => d.name === "mark_code");
    expect(packageDetail.values).toBe("0");
    expect(markDetail.values).toBe("0");
  });
});

describe("amountTiyinFor", () => {
  test("so'mni tiyinga to'g'ri aylantiradi", () => {
    const { _testables } = loadModule(buildMockDb());
    expect(_testables.amountTiyinFor("start")).toBe(4900000);
    expect(_testables.amountTiyinFor("pro")).toBe(19900000);
  });
});
