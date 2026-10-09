/**
 * `atmosProxyTest.js` — ATMOS uchun statik-IP proksi-VM'ni tekshiruvchi
 * VAQTINCHALIK diagnostika funksiyasi uchun testlar.
 */

function buildMockDb({ isAdmin = true } = {}) {
  return {
    collection: (name) => {
      if (name === "admins") {
        return { doc: () => ({ get: async () => ({ exists: isAdmin }) }) };
      }
      return { doc: () => ({ get: async () => ({ exists: false }) }) };
    },
  };
}

function loadModule(db, atmosClientMock = {}) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({ db }));
  jest.doMock("../lib/sentry", () => ({
    withSentry: (fn) => fn,
    initSentry: jest.fn(),
    Sentry: { captureException: jest.fn() },
    SENTRY_DSN: { value: () => null },
  }));
  jest.doMock("../lib/atmosClient", () => ({
    ATMOS_CONSUMER_KEY: { value: () => "mock-key" },
    ATMOS_CONSUMER_SECRET: { value: () => "mock-secret" },
    ATMOS_STORE_ID: { value: () => "1234" },
    ATMOS_API_KEY: { value: () => "mock-api-key" },
    ATMOS_PROXY_TOKEN: { value: () => "mock-proxy-token" },
    createTransaction: jest.fn().mockResolvedValue({ transactionId: 999 }),
    buildCheckoutUrl: jest.fn(() => "https://checkout.pays.uz/invoice/get?storeId=1234&transactionId=999"),
    createCheckoutInvoice: jest.fn().mockResolvedValue({
      paymentId: "diag-payment-1",
      token: "mock-token",
      url: "https://checkout.pays.uz/invoice/get?storeId=1234&transactionId=888",
    }),
    bindCardInit: jest.fn().mockResolvedValue({ transactionId: 111, phone: "+998 90 *** ** 45" }),
    bindCardConfirm: jest.fn().mockResolvedValue({ cardToken: "card-tok-abc" }),
    listLinkedCards: jest.fn().mockResolvedValue([{ card_token: "card-tok-abc" }]),
    removeLinkedCard: jest.fn().mockResolvedValue({ success: true }),
    ...atmosClientMock,
  }));
  return require("../atmosProxyTest");
}

describe("handleTestAtmosProxyIp", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("auth bo'lmasa - unauthenticated xatosi", async () => {
    const { _testables } = loadModule(buildMockDb());
    await expect(_testables.handleTestAtmosProxyIp({ auth: null, data: {} })).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  test("admin bo'lmasa - permission-denied xatosi", async () => {
    const { _testables } = loadModule(buildMockDb({ isAdmin: false }));
    await expect(
      _testables.handleTestAtmosProxyIp({ auth: { uid: "client-1" }, data: {} })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("VM kutilgan statik IP'ni qaytarsa - matches:true", async () => {
    const { _testables } = loadModule(buildMockDb());
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ vmOutboundIp: _testables.EXPECTED_STATIC_IP }),
    });

    const result = await _testables.handleTestAtmosProxyIp({ auth: { uid: "admin-1" }, data: {} });

    expect(result).toEqual({
      vmOutboundIp: _testables.EXPECTED_STATIC_IP,
      expectedStaticIp: _testables.EXPECTED_STATIC_IP,
      matches: true,
    });
  });

  test("VM boshqa IP qaytarsa - matches:false (lekin xato tashlamaydi)", async () => {
    const { _testables } = loadModule(buildMockDb());
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ vmOutboundIp: "1.2.3.4" }),
    });

    const result = await _testables.handleTestAtmosProxyIp({ auth: { uid: "admin-1" }, data: {} });
    expect(result.matches).toBe(false);
  });

  test("VM'ga ulanib bo'lmasa - unavailable xatosi", async () => {
    const { _testables } = loadModule(buildMockDb());
    global.fetch = jest.fn().mockRejectedValue(new Error("connect ECONNREFUSED"));

    await expect(
      _testables.handleTestAtmosProxyIp({ auth: { uid: "admin-1" }, data: {} })
    ).rejects.toMatchObject({ code: "unavailable" });
  });

  test("VM 500 status qaytarsa - internal xatosi", async () => {
    const { _testables } = loadModule(buildMockDb());
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });

    await expect(
      _testables.handleTestAtmosProxyIp({ auth: { uid: "admin-1" }, data: {} })
    ).rejects.toMatchObject({ code: "internal" });
  });
});

describe("handleTestAtmosLegacyPayment", () => {
  test("auth bo'lmasa - unauthenticated xatosi", async () => {
    const { _testables } = loadModule(buildMockDb());
    await expect(_testables.handleTestAtmosLegacyPayment({ auth: null, data: {} })).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  test("admin bo'lmasa - permission-denied xatosi", async () => {
    const { _testables } = loadModule(buildMockDb({ isAdmin: false }));
    await expect(
      _testables.handleTestAtmosLegacyPayment({ auth: { uid: "client-1" }, data: {} })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("Atmos muvaffaqiyatli javob bersa - success:true, transactionId/checkoutUrl qaytaradi", async () => {
    const { _testables } = loadModule(buildMockDb());
    const result = await _testables.handleTestAtmosLegacyPayment({ auth: { uid: "admin-1" }, data: {} });
    expect(result).toEqual({
      success: true,
      transactionId: 999,
      checkoutUrl: "https://checkout.pays.uz/invoice/get?storeId=1234&transactionId=999",
      amountSom: _testables.LEGACY_TEST_AMOUNT_SOM,
    });
  });

  test("Atmos xato qaytarsa - xato TASHLAMAYDI, success:false + tafsilotlar bilan qaytaradi", async () => {
    const atmosErr = new Error("Atmos createTransaction: Invalid request format...");
    atmosErr.atmosCode = "-999998";
    atmosErr.httpStatus = 200;
    const { _testables } = loadModule(buildMockDb(), {
      createTransaction: jest.fn().mockRejectedValue(atmosErr),
    });

    const result = await _testables.handleTestAtmosLegacyPayment({ auth: { uid: "admin-1" }, data: {} });

    expect(result).toEqual({
      success: false,
      errorMessage: "Atmos createTransaction: Invalid request format...",
      atmosCode: "-999998",
      httpStatus: 200,
    });
  });
});

function fakeRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe("handleTestAtmosLegacyPaymentHttp", () => {
  test("token noto'g'ri/yo'q bo'lsa - 403 qaytaradi, Atmos'ga so'rov yubormaydi", async () => {
    const createTransactionMock = jest.fn().mockResolvedValue({ transactionId: 999 });
    const { _testables } = loadModule(buildMockDb(), { createTransaction: createTransactionMock });
    const res = fakeRes();

    await _testables.handleTestAtmosLegacyPaymentHttp({ query: { token: "notogri" } }, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(createTransactionMock).not.toHaveBeenCalled();
  });

  test("token to'g'ri bo'lsa - diagnostika natijasini 200 bilan qaytaradi", async () => {
    const { _testables } = loadModule(buildMockDb());
    const res = fakeRes();

    await _testables.handleTestAtmosLegacyPaymentHttp({ query: { token: _testables.DIAG_HTTP_TOKEN } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      transactionId: 999,
      checkoutUrl: "https://checkout.pays.uz/invoice/get?storeId=1234&transactionId=999",
      amountSom: _testables.LEGACY_TEST_AMOUNT_SOM,
    });
  });
});

describe("buildVariantItems", () => {
  const AMOUNT_TIYIN = 100000;
  const BASE_FIELDS = { items_id: "diag", code: "10305008003000000", name: "Diagnostika", amount: AMOUNT_TIYIN };
  const FULL_DETAILS = [
    { name: "package_code", values: "0" },
    { name: "mark_code", values: "0" },
    { name: "tin", values: "313278793" },
    { name: "discount", values: "0" },
    { name: "quantity", values: "1" },
  ];

  test("baseline - to'liq details (values satr sifatida)", () => {
    const { _testables } = loadModule(buildMockDb());
    expect(_testables.buildVariantItems("baseline", AMOUNT_TIYIN)).toEqual([
      { ...BASE_FIELDS, quantity: 1, details: FULL_DETAILS },
    ]);
  });

  test("noma'lum variant - baseline'ga tushadi (default)", () => {
    const { _testables } = loadModule(buildMockDb());
    expect(_testables.buildVariantItems("boshqa-narsa", AMOUNT_TIYIN)).toEqual(
      _testables.buildVariantItems("baseline", AMOUNT_TIYIN)
    );
  });

  test("no_details - details maydoni umuman yo'q", () => {
    const { _testables } = loadModule(buildMockDb());
    const items = _testables.buildVariantItems("no_details", AMOUNT_TIYIN);
    expect(items).toEqual([{ ...BASE_FIELDS, quantity: 1 }]);
    expect(items[0]).not.toHaveProperty("details");
  });

  test("empty_details - details bo'sh massiv", () => {
    const { _testables } = loadModule(buildMockDb());
    expect(_testables.buildVariantItems("empty_details", AMOUNT_TIYIN)).toEqual([
      { ...BASE_FIELDS, quantity: 1, details: [] },
    ]);
  });

  test("values_array - details[].values massiv sifatida", () => {
    const { _testables } = loadModule(buildMockDb());
    const items = _testables.buildVariantItems("values_array", AMOUNT_TIYIN);
    expect(items).toEqual([
      {
        ...BASE_FIELDS,
        quantity: 1,
        details: FULL_DETAILS.map((d) => ({ name: d.name, values: [d.values] })),
      },
    ]);
  });

  test("minimal_item - faqat asosiy maydonlar, quantity/details yo'q", () => {
    const { _testables } = loadModule(buildMockDb());
    const items = _testables.buildVariantItems("minimal_item", AMOUNT_TIYIN);
    expect(items).toEqual([BASE_FIELDS]);
    expect(items[0]).not.toHaveProperty("quantity");
    expect(items[0]).not.toHaveProperty("details");
  });

  test("details_object - details massiv o'rniga kalit-qiymat obyekti", () => {
    const { _testables } = loadModule(buildMockDb());
    expect(_testables.buildVariantItems("details_object", AMOUNT_TIYIN)).toEqual([
      {
        ...BASE_FIELDS,
        quantity: 1,
        details: {
          package_code: "0",
          mark_code: "0",
          tin: "313278793",
          discount: "0",
          quantity: "1",
        },
      },
    ]);
  });

  test("flat_fields - details o'rovisiz, OFD maydonlari items[0]da bir darajali", () => {
    const { _testables } = loadModule(buildMockDb());
    const items = _testables.buildVariantItems("flat_fields", AMOUNT_TIYIN);
    expect(items).toEqual([
      {
        ...BASE_FIELDS,
        quantity: 1,
        package_code: "0",
        mark_code: "0",
        tin: "313278793",
        discount: "0",
      },
    ]);
    expect(items[0]).not.toHaveProperty("details");
  });
});

describe("handleTestAtmosCheckoutVariantHttp", () => {
  test("token noto'g'ri/yo'q bo'lsa - 403 qaytaradi, Atmos'ga so'rov yubormaydi", async () => {
    const createCheckoutInvoiceMock = jest.fn().mockResolvedValue({ paymentId: "x", token: "y", url: "z" });
    const { _testables } = loadModule(buildMockDb(), { createCheckoutInvoice: createCheckoutInvoiceMock });
    const res = fakeRes();

    await _testables.handleTestAtmosCheckoutVariantHttp(
      { query: { token: "notogri", variant: "baseline" } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(createCheckoutInvoiceMock).not.toHaveBeenCalled();
  });

  test("variant noma'lum bo'lsa - 400 qaytaradi, Atmos'ga so'rov yubormaydi", async () => {
    const createCheckoutInvoiceMock = jest.fn().mockResolvedValue({ paymentId: "x", token: "y", url: "z" });
    const { _testables } = loadModule(buildMockDb(), { createCheckoutInvoice: createCheckoutInvoiceMock });
    const res = fakeRes();

    await _testables.handleTestAtmosCheckoutVariantHttp(
      { query: { token: _testables.DIAG_HTTP_TOKEN, variant: "notogri-variant" } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(createCheckoutInvoiceMock).not.toHaveBeenCalled();
  });

  test("variant berilmasa - baseline sifatida qabul qilinadi", async () => {
    const createCheckoutInvoiceMock = jest.fn().mockResolvedValue({ paymentId: "x", token: "y", url: "z" });
    const { _testables } = loadModule(buildMockDb(), { createCheckoutInvoice: createCheckoutInvoiceMock });
    const res = fakeRes();

    await _testables.handleTestAtmosCheckoutVariantHttp({ query: { token: _testables.DIAG_HTTP_TOKEN } }, res);

    expect(createCheckoutInvoiceMock).toHaveBeenCalledTimes(1);
    const callArgs = createCheckoutInvoiceMock.mock.calls[0][0];
    expect(callArgs.items).toEqual(
      _testables.buildVariantItems("baseline", _testables.LEGACY_TEST_AMOUNT_SOM * 100)
    );
  });

  test("to'g'ri token va variant - createCheckoutInvoice'ni to'g'ri items bilan chaqiradi, 200 qaytaradi", async () => {
    const createCheckoutInvoiceMock = jest.fn().mockResolvedValue({
      paymentId: "diag-payment-1",
      token: "mock-token",
      url: "https://checkout.pays.uz/invoice/get?storeId=1234&transactionId=888",
    });
    const { _testables } = loadModule(buildMockDb(), { createCheckoutInvoice: createCheckoutInvoiceMock });
    const res = fakeRes();

    await _testables.handleTestAtmosCheckoutVariantHttp(
      { query: { token: _testables.DIAG_HTTP_TOKEN, variant: "no_details" } },
      res
    );

    expect(createCheckoutInvoiceMock).toHaveBeenCalledTimes(1);
    const callArgs = createCheckoutInvoiceMock.mock.calls[0][0];
    expect(callArgs.amountSom).toBe(_testables.LEGACY_TEST_AMOUNT_SOM);
    expect(callArgs.successUrl).toBe("https://commerce-zelo.web.app/seller/tariffs");
    expect(callArgs.requestId).toMatch(/^diag_no_details_\d+$/);
    expect(callArgs.account).toBe(callArgs.requestId);
    expect(callArgs.items).toEqual(_testables.buildVariantItems("no_details", _testables.LEGACY_TEST_AMOUNT_SOM * 100));

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      variant: "no_details",
      paymentId: "diag-payment-1",
      token: "mock-token",
      url: "https://checkout.pays.uz/invoice/get?storeId=1234&transactionId=888",
    });
  });

  test("Atmos xato qaytarsa - xato TASHLAMAYDI, success:false + tafsilotlar bilan 200 qaytaradi", async () => {
    const atmosErr = new Error("Atmos createCheckoutInvoice: Invalid request format...");
    atmosErr.atmosCode = "-999998";
    atmosErr.httpStatus = 200;
    const createCheckoutInvoiceMock = jest.fn().mockRejectedValue(atmosErr);
    const { _testables } = loadModule(buildMockDb(), { createCheckoutInvoice: createCheckoutInvoiceMock });
    const res = fakeRes();

    await _testables.handleTestAtmosCheckoutVariantHttp(
      { query: { token: _testables.DIAG_HTTP_TOKEN, variant: "baseline" } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      variant: "baseline",
      errorMessage: "Atmos createCheckoutInvoice: Invalid request format...",
      atmosCode: "-999998",
      httpStatus: 200,
    });
  });
});

describe("handleTestAtmosCardLinkInitHttp", () => {
  test("token noto'g'ri bo'lsa - 403, Atmos'ga so'rov yubormaydi", async () => {
    const bindCardInitMock = jest.fn();
    const { _testables } = loadModule(buildMockDb(), { bindCardInit: bindCardInitMock });
    const res = fakeRes();

    await _testables.handleTestAtmosCardLinkInitHttp(
      { method: "POST", query: { token: "notogri" }, body: { cardNumber: "8600123456781234", expiry: "2712" } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(bindCardInitMock).not.toHaveBeenCalled();
  });

  test("GET so'rov bo'lsa - 405 (karta raqami URL'da ko'rinmasin uchun FAQAT POST)", async () => {
    const bindCardInitMock = jest.fn();
    const { _testables } = loadModule(buildMockDb(), { bindCardInit: bindCardInitMock });
    const res = fakeRes();

    await _testables.handleTestAtmosCardLinkInitHttp(
      { method: "GET", query: { token: _testables.DIAG_HTTP_TOKEN } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(405);
    expect(bindCardInitMock).not.toHaveBeenCalled();
  });

  test("cardNumber/expiry bo'lmasa - 400", async () => {
    const { _testables } = loadModule(buildMockDb());
    const res = fakeRes();

    await _testables.handleTestAtmosCardLinkInitHttp(
      { method: "POST", query: { token: _testables.DIAG_HTTP_TOKEN }, body: {} },
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("to'g'ri so'rov - bindCardInit'ni chaqiradi, 200 + transactionId/phone qaytaradi", async () => {
    const { _testables } = loadModule(buildMockDb());
    const res = fakeRes();

    await _testables.handleTestAtmosCardLinkInitHttp(
      {
        method: "POST",
        query: { token: _testables.DIAG_HTTP_TOKEN },
        body: { cardNumber: "8600123456781234", expiry: "2712" },
      },
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, transactionId: 111, phone: "+998 90 *** ** 45" });
  });

  test("Atmos xato qaytarsa - success:false bilan 200 qaytaradi", async () => {
    const atmosErr = new Error("Atmos bindCardInit: Karta rad etildi.");
    atmosErr.atmosCode = "-100";
    const { _testables } = loadModule(buildMockDb(), { bindCardInit: jest.fn().mockRejectedValue(atmosErr) });
    const res = fakeRes();

    await _testables.handleTestAtmosCardLinkInitHttp(
      {
        method: "POST",
        query: { token: _testables.DIAG_HTTP_TOKEN },
        body: { cardNumber: "8600123456781234", expiry: "2712" },
      },
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      errorMessage: "Atmos bindCardInit: Karta rad etildi.",
      atmosCode: "-100",
      httpStatus: null,
    });
  });
});

describe("handleTestAtmosCardLinkConfirmHttp", () => {
  test("token noto'g'ri bo'lsa - 403", async () => {
    const bindCardConfirmMock = jest.fn();
    const { _testables } = loadModule(buildMockDb(), { bindCardConfirm: bindCardConfirmMock });
    const res = fakeRes();

    await _testables.handleTestAtmosCardLinkConfirmHttp(
      { method: "POST", query: { token: "notogri" }, body: { transactionId: 111, otp: "111111" } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(bindCardConfirmMock).not.toHaveBeenCalled();
  });

  test("transactionId/otp bo'lmasa - 400", async () => {
    const { _testables } = loadModule(buildMockDb());
    const res = fakeRes();

    await _testables.handleTestAtmosCardLinkConfirmHttp(
      { method: "POST", query: { token: _testables.DIAG_HTTP_TOKEN }, body: {} },
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("to'g'ri so'rov - cardToken'ni 200 bilan qaytaradi", async () => {
    const { _testables } = loadModule(buildMockDb());
    const res = fakeRes();

    await _testables.handleTestAtmosCardLinkConfirmHttp(
      { method: "POST", query: { token: _testables.DIAG_HTTP_TOKEN }, body: { transactionId: 111, otp: "111111" } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, cardToken: "card-tok-abc" });
  });
});

describe("handleTestAtmosCardChargeHttp", () => {
  test("token noto'g'ri bo'lsa - 403, createTransaction chaqirmaydi", async () => {
    const createTransactionMock = jest.fn();
    const { _testables } = loadModule(buildMockDb(), { createTransaction: createTransactionMock });
    const res = fakeRes();

    await _testables.handleTestAtmosCardChargeHttp(
      { method: "POST", query: { token: "notogri" }, body: { cardToken: "card-tok-abc", amountSom: 49000 } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(createTransactionMock).not.toHaveBeenCalled();
  });

  test("cardToken/amountSom bo'lmasa - 400", async () => {
    const { _testables } = loadModule(buildMockDb());
    const res = fakeRes();

    await _testables.handleTestAtmosCardChargeHttp(
      { method: "POST", query: { token: _testables.DIAG_HTTP_TOKEN }, body: {} },
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("to'g'ri so'rov - createTransaction'ni cardToken bilan chaqiradi, 200 + transactionId qaytaradi", async () => {
    const createTransactionMock = jest.fn().mockResolvedValue({ transactionId: 321 });
    const { _testables } = loadModule(buildMockDb(), { createTransaction: createTransactionMock });
    const res = fakeRes();

    await _testables.handleTestAtmosCardChargeHttp(
      { method: "POST", query: { token: _testables.DIAG_HTTP_TOKEN }, body: { cardToken: "card-tok-abc", amountSom: 49000 } },
      res
    );

    expect(createTransactionMock).toHaveBeenCalledTimes(1);
    const callArgs = createTransactionMock.mock.calls[0][0];
    expect(callArgs.cardToken).toBe("card-tok-abc");
    expect(callArgs.amountSom).toBe(49000);
    expect(callArgs.account).toMatch(/^diag_card_\d+$/);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, transactionId: 321 });
  });

  test("Atmos xato qaytarsa (masalan qo'shimcha OTP kerak bo'lsa) - success:false bilan 200 qaytaradi", async () => {
    const atmosErr = new Error("Atmos createTransaction: Pre-apply kerak.");
    atmosErr.atmosCode = "-200";
    const { _testables } = loadModule(buildMockDb(), { createTransaction: jest.fn().mockRejectedValue(atmosErr) });
    const res = fakeRes();

    await _testables.handleTestAtmosCardChargeHttp(
      { method: "POST", query: { token: _testables.DIAG_HTTP_TOKEN }, body: { cardToken: "card-tok-abc", amountSom: 49000 } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      errorMessage: "Atmos createTransaction: Pre-apply kerak.",
      atmosCode: "-200",
      httpStatus: null,
    });
  });
});

describe("handleTestAtmosListCardsHttp", () => {
  test("token noto'g'ri bo'lsa - 403", async () => {
    const listLinkedCardsMock = jest.fn();
    const { _testables } = loadModule(buildMockDb(), { listLinkedCards: listLinkedCardsMock });
    const res = fakeRes();

    await _testables.handleTestAtmosListCardsHttp({ query: { token: "notogri" } }, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(listLinkedCardsMock).not.toHaveBeenCalled();
  });

  test("token to'g'ri bo'lsa - kartalar ro'yxatini 200 bilan qaytaradi", async () => {
    const { _testables } = loadModule(buildMockDb());
    const res = fakeRes();

    await _testables.handleTestAtmosListCardsHttp({ query: { token: _testables.DIAG_HTTP_TOKEN } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, cards: [{ card_token: "card-tok-abc" }] });
  });
});

describe("handleTestAtmosRemoveCardHttp", () => {
  test("token noto'g'ri bo'lsa - 403", async () => {
    const removeLinkedCardMock = jest.fn();
    const { _testables } = loadModule(buildMockDb(), { removeLinkedCard: removeLinkedCardMock });
    const res = fakeRes();

    await _testables.handleTestAtmosRemoveCardHttp(
      { method: "POST", query: { token: "notogri" }, body: { cardToken: "card-tok-abc" } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(removeLinkedCardMock).not.toHaveBeenCalled();
  });

  test("cardToken bo'lmasa - 400", async () => {
    const { _testables } = loadModule(buildMockDb());
    const res = fakeRes();

    await _testables.handleTestAtmosRemoveCardHttp(
      { method: "POST", query: { token: _testables.DIAG_HTTP_TOKEN }, body: {} },
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("to'g'ri so'rov - removeLinkedCard'ni chaqiradi, 200 qaytaradi", async () => {
    const removeLinkedCardMock = jest.fn().mockResolvedValue({ success: true });
    const { _testables } = loadModule(buildMockDb(), { removeLinkedCard: removeLinkedCardMock });
    const res = fakeRes();

    await _testables.handleTestAtmosRemoveCardHttp(
      { method: "POST", query: { token: _testables.DIAG_HTTP_TOKEN }, body: { cardToken: "card-tok-abc" } },
      res
    );

    expect(removeLinkedCardMock).toHaveBeenCalledWith({ cardToken: "card-tok-abc" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});
