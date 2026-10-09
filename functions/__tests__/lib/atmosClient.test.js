/**
 * `lib/atmosClient.js` uchun testlar — Atmos hosted-checkout API
 * mijozi (token olish/keshlash, tranzaksiya yaratish/so'rash, checkout
 * havolasi qurish, Callback `sign` hisoblash/tekshirish).
 *
 * `defineSecret`/`defineString`ning `.value()` metodi HAQIQATDA
 * `process.env[NAME]`ni o'qiydi (`firebase-functions/params`, ishlab
 * chiqaruvchi SDK manbai — `SecretParam`/`StringParam.runtimeValue()`)
 * — shuning uchun bu yerda alohida mock shart emas, testlar oddiy
 * `process.env`ni sozlaydi. `cachedToken` MODUL darajasidagi
 * o'zgaruvchi bo'lgani uchun har bir testdan oldin `jest.resetModules()`
 * bilan modul QAYTADAN yuklanadi (toza kesh holati uchun).
 */

const ENV_KEYS = [
  "ATMOS_CONSUMER_KEY", "ATMOS_CONSUMER_SECRET", "ATMOS_STORE_ID", "ATMOS_API_KEY", "ATMOS_ENV",
  "ATMOS_PROXY_URL", "ATMOS_PROXY_TOKEN",
];

function setEnv(overrides = {}) {
  const defaults = {
    ATMOS_CONSUMER_KEY: "test-consumer-key",
    ATMOS_CONSUMER_SECRET: "test-consumer-secret",
    ATMOS_STORE_ID: "1234",
    ATMOS_API_KEY: "test-api-key",
  };
  const merged = { ...defaults, ...overrides };
  for (const key of ENV_KEYS) {
    if (merged[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = merged[key];
    }
  }
}

function loadModule(envOverrides = {}) {
  jest.resetModules();
  setEnv(envOverrides);
  return require("../../lib/atmosClient");
}

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  delete global.fetch;
});

describe("getAccessToken", () => {
  test("Basic auth header bilan to'g'ri so'rov yuboradi va tokenni qaytaradi", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "abc123", expires_in: 3600 }),
    });
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    const token = await atmosClient.getAccessToken();

    expect(token).toBe("abc123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://apigw.atmos.uz/token?grant_type=client_credentials");
    expect(options.method).toBe("POST");
    const expectedBasic = Buffer.from("test-consumer-key:test-consumer-secret").toString("base64");
    expect(options.headers.Authorization).toBe(`Basic ${expectedBasic}`);
    expect(options.body).toBe("grant_type=client_credentials");
  });

  test("ikkinchi chaqiruvda keshlangan tokenni qaytaradi (qayta so'rov YUBORMAYDI)", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "cached-token", expires_in: 3600 }),
    });
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    const first = await atmosClient.getAccessToken();
    const second = await atmosClient.getAccessToken();

    expect(first).toBe("cached-token");
    expect(second).toBe("cached-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("consumer key/secret sozlanmagan bo'lsa - aniq xato tashlaydi", async () => {
    const atmosClient = loadModule({ ATMOS_CONSUMER_KEY: undefined, ATMOS_CONSUMER_SECRET: undefined });
    await expect(atmosClient.getAccessToken()).rejects.toThrow(/ATMOS_CONSUMER_KEY/);
  });

  // 2026-09-13: real production xatosi — `firebase functions:secrets:set`
  // terminalda (Windows/Git Bash) qo'lda kiritilganda kalitga bilinmas
  // boshi/oxiri probel/qator ko'chirish qo'shilib qolgan, Atmos esa buni
  // "OAuth mijoz (client_id) topilmadi" (401) deb chalg'ituvchi tarzda
  // qaytargan edi. Endi HAR BIR Atmos sekreti/parametri ishlatilishidan
  // oldin tozalanadi — bu test aynan shu holatni qamrab oladi.
  test("consumer key/secret atrofidagi bo'sh joylarni tozalaydi (Basic Auth to'g'ri hisoblanadi)", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "abc123", expires_in: 3600 }),
    });
    global.fetch = fetchMock;
    const atmosClient = loadModule({
      ATMOS_CONSUMER_KEY: " test-consumer-key\n",
      ATMOS_CONSUMER_SECRET: "\ttest-consumer-secret ",
    });

    await atmosClient.getAccessToken();

    const [, options] = fetchMock.mock.calls[0];
    const expectedBasic = Buffer.from("test-consumer-key:test-consumer-secret").toString("base64");
    expect(options.headers.Authorization).toBe(`Basic ${expectedBasic}`);
  });

  test("Atmos HTTP xato qaytarsa - tavsiflovchi xato tashlaydi", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error_description: "invalid_client" }),
    });
    const atmosClient = loadModule();
    await expect(atmosClient.getAccessToken()).rejects.toThrow(/HTTP 401/);
  });
});

describe("STATIK-IP PROKSI (ATMOS_PROXY_URL / ATMOS_PROXY_TOKEN)", () => {
  test("ATMOS_PROXY_URL sozlanmagan bo'lsa - dispatcher'siz (proksisiz) so'rov yuboradi", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "abc", expires_in: 3600 }),
    });
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    await atmosClient.getAccessToken();

    const [, options] = fetchMock.mock.calls[0];
    expect(options.dispatcher).toBeUndefined();
  });

  test("ATMOS_PROXY_URL sozlangan, lekin ATMOS_PROXY_TOKEN yo'q - aniq xato tashlaydi (so'rov yubormasdan)", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const atmosClient = loadModule({ ATMOS_PROXY_URL: "http://35.211.129.224:3128", ATMOS_PROXY_TOKEN: undefined });

    await expect(atmosClient.getAccessToken()).rejects.toThrow(/ATMOS_PROXY_TOKEN/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("ATMOS_PROXY_URL + ATMOS_PROXY_TOKEN ikkalasi ham bor - fetch'ga proksi dispatcher uzatiladi", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "abc", expires_in: 3600 }),
    });
    global.fetch = fetchMock;
    const atmosClient = loadModule({
      ATMOS_PROXY_URL: "http://35.211.129.224:3128",
      ATMOS_PROXY_TOKEN: "sekret-token",
    });

    await atmosClient.getAccessToken();

    const [, options] = fetchMock.mock.calls[0];
    expect(options.dispatcher).toBeDefined();
    expect(options.dispatcher.constructor.name).toBe("ProxyAgent");
  });

  test("bir xil proksi URL/token uchun dispatcher QAYTA YASALMAYDI (keshlanadi)", () => {
    const atmosClient = loadModule({
      ATMOS_PROXY_URL: "http://35.211.129.224:3128",
      ATMOS_PROXY_TOKEN: "sekret-token",
    });

    const first = atmosClient._testables.getProxyDispatcher();
    const second = atmosClient._testables.getProxyDispatcher();

    expect(first).toBe(second);
  });

  test("createTransaction (atmosPost orqali) ham proksi dispatcher'idan foydalanadi", async () => {
    const fetchMock = jest.fn().mockImplementation((url) => {
      if (String(url).includes("/token")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ access_token: "abc", expires_in: 3600 }) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ transaction_id: 999, result: { code: "OK" } }),
      });
    });
    global.fetch = fetchMock;
    const atmosClient = loadModule({
      ATMOS_PROXY_URL: "http://35.211.129.224:3128",
      ATMOS_PROXY_TOKEN: "sekret-token",
    });

    await atmosClient.createTransaction({ amountSom: 1000, account: "order-1" });

    expect(fetchMock).toHaveBeenCalledTimes(2); // token + pay/create
    for (const [, options] of fetchMock.mock.calls) {
      expect(options.dispatcher).toBeDefined();
    }
  });
});

describe("createTransaction", () => {
  function fetchSequence({ tokenBody, createBody }) {
    return jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => tokenBody })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => createBody });
  }

  test("summani so'mdan tiyinga aylantirib, to'g'ri so'rov yuboradi", async () => {
    const fetchMock = fetchSequence({
      tokenBody: { access_token: "tok", expires_in: 3600 },
      createBody: { result: { code: "OK" }, transaction_id: 555 },
    });
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    const result = await atmosClient.createTransaction({ amountSom: 49000, account: "acc-1" });

    expect(result).toEqual({ transactionId: 555 });
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe("https://apigw.atmos.uz/merchant/pay/create");
    const payload = JSON.parse(options.body);
    expect(payload).toEqual({ amount: 4900000, account: "acc-1", store_id: "1234", lang: "uz" });
    expect(options.headers.Authorization).toBe("Bearer tok");
  });

  test("amountSom musbat bo'lmasa - so'rov yubormasdan xato tashlaydi", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    await expect(atmosClient.createTransaction({ amountSom: 0, account: "acc-1" })).rejects.toThrow(/amountSom/);
    await expect(atmosClient.createTransaction({ amountSom: -10, account: "acc-1" })).rejects.toThrow(/amountSom/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("account bo'lmasa - xato tashlaydi", async () => {
    const atmosClient = loadModule();
    await expect(atmosClient.createTransaction({ amountSom: 1000, account: "" })).rejects.toThrow(/account/);
  });

  test("javobda transaction_id yo'q bo'lsa - xato tashlaydi", async () => {
    const fetchMock = fetchSequence({
      tokenBody: { access_token: "tok", expires_in: 3600 },
      createBody: { result: { code: "OK" } },
    });
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    await expect(atmosClient.createTransaction({ amountSom: 1000, account: "acc-1" })).rejects.toThrow(
      /transaction_id/
    );
  });

  test("Atmos `result.code !== 'OK'` qaytarsa - tavsiflovchi xato tashlaydi", async () => {
    const fetchMock = fetchSequence({
      tokenBody: { access_token: "tok", expires_in: 3600 },
      createBody: { result: { code: "ERROR", description: "Noto'g'ri store" } },
    });
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    await expect(atmosClient.createTransaction({ amountSom: 1000, account: "acc-1" })).rejects.toThrow(
      /Noto'g'ri store/
    );
  });

  // 2026-09-18: bog'langan-karta (card linking) diagnostikasi uchun qo'shildi.
  test("cardToken berilsa - payloadga card_token qo'shadi", async () => {
    const fetchMock = fetchSequence({
      tokenBody: { access_token: "tok", expires_in: 3600 },
      createBody: { result: { code: "OK" }, transaction_id: 777 },
    });
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    await atmosClient.createTransaction({ amountSom: 1000, account: "acc-1", cardToken: "card-tok-abc" });

    const payload = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(payload.card_token).toBe("card-tok-abc");
  });

  test("cardToken berilmasa - payloadda card_token maydoni bo'lmaydi", async () => {
    const fetchMock = fetchSequence({
      tokenBody: { access_token: "tok", expires_in: 3600 },
      createBody: { result: { code: "OK" }, transaction_id: 777 },
    });
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    await atmosClient.createTransaction({ amountSom: 1000, account: "acc-1" });

    const payload = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(payload).not.toHaveProperty("card_token");
  });
});

describe("bindCardInit", () => {
  function fetchSequence({ tokenBody, initBody }) {
    return jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => tokenBody })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => initBody });
  }

  test("to'g'ri so'rov yuboradi va transactionId/phone'ni qaytaradi", async () => {
    const fetchMock = fetchSequence({
      tokenBody: { access_token: "tok", expires_in: 3600 },
      initBody: { result: { code: "OK" }, transaction_id: 111, phone: "+998 90 *** ** 45" },
    });
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    const result = await atmosClient.bindCardInit({ cardNumber: "8600123456781234", expiry: "2712" });

    expect(result).toEqual({ transactionId: 111, phone: "+998 90 *** ** 45" });
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe("https://apigw.atmos.uz/partner/bind-card/init");
    expect(JSON.parse(options.body)).toEqual({ card_number: "8600123456781234", expiry: "2712" });
  });

  test("cardNumber/expiry bo'lmasa - so'rov yubormasdan xato tashlaydi", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    await expect(atmosClient.bindCardInit({ cardNumber: "", expiry: "2712" })).rejects.toThrow(/cardNumber/);
    await expect(atmosClient.bindCardInit({ cardNumber: "8600123456781234", expiry: "" })).rejects.toThrow(/expiry/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("javobda transaction_id yo'q bo'lsa - xato tashlaydi", async () => {
    const fetchMock = fetchSequence({
      tokenBody: { access_token: "tok", expires_in: 3600 },
      initBody: { result: { code: "OK" } },
    });
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    await expect(
      atmosClient.bindCardInit({ cardNumber: "8600123456781234", expiry: "2712" })
    ).rejects.toThrow(/transaction_id/);
  });
});

describe("bindCardConfirm", () => {
  function fetchSequence({ tokenBody, confirmBody }) {
    return jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => tokenBody })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => confirmBody });
  }

  test("to'g'ri so'rov yuboradi va cardToken'ni qaytaradi", async () => {
    const fetchMock = fetchSequence({
      tokenBody: { access_token: "tok", expires_in: 3600 },
      confirmBody: { result: { code: "OK" }, data: { card_token: "card-tok-xyz", pan: "8600 12** **** 1234" } },
    });
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    const result = await atmosClient.bindCardConfirm({ transactionId: 111, otp: "111111" });

    expect(result.cardToken).toBe("card-tok-xyz");
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe("https://apigw.atmos.uz/partner/bind-card/confirm");
    expect(JSON.parse(options.body)).toEqual({ transaction_id: 111, otp: "111111" });
  });

  test("transactionId/otp bo'lmasa - so'rov yubormasdan xato tashlaydi", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    await expect(atmosClient.bindCardConfirm({ transactionId: null, otp: "111111" })).rejects.toThrow(
      /transactionId/
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("javobda data.card_token yo'q bo'lsa - cardToken:null qaytaradi (xato tashlamaydi)", async () => {
    const fetchMock = fetchSequence({
      tokenBody: { access_token: "tok", expires_in: 3600 },
      confirmBody: { result: { code: "OK" }, data: {} },
    });
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    const result = await atmosClient.bindCardConfirm({ transactionId: 111, otp: "111111" });
    expect(result.cardToken).toBeNull();
  });
});

describe("listLinkedCards", () => {
  test("bog'langan kartalar ro'yxatini qaytaradi", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "tok", expires_in: 3600 }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: { code: "OK" }, cardDataSmallList: [{ card_token: "t1" }] }),
      });
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    const cards = await atmosClient.listLinkedCards({});

    expect(cards).toEqual([{ card_token: "t1" }]);
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe("https://apigw.atmos.uz/partner/list-cards");
    expect(JSON.parse(options.body)).toEqual({});
  });

  test("ro'yxat bo'lmasa - bo'sh massiv qaytaradi", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "tok", expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ result: { code: "OK" } }) });
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    expect(await atmosClient.listLinkedCards({})).toEqual([]);
  });
});

describe("removeLinkedCard", () => {
  test("to'g'ri so'rov yuboradi", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "tok", expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ result: { code: "OK" } }) });
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    const result = await atmosClient.removeLinkedCard({ cardToken: "card-tok-abc" });

    expect(result).toEqual({ success: true });
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe("https://apigw.atmos.uz/partner/remove-card");
    expect(JSON.parse(options.body)).toEqual({ card_token: "card-tok-abc" });
  });

  test("cardToken bo'lmasa - so'rov yubormasdan xato tashlaydi", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    await expect(atmosClient.removeLinkedCard({})).rejects.toThrow(/cardToken/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getTransaction", () => {
  test("tasdiqlangan tranzaksiya uchun confirmed:true qaytaradi", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "tok", expires_in: 3600 }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          result: { code: "OK" },
          store_transaction: { confirmed: true, status_message: "To'landi" },
        }),
      });
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    const result = await atmosClient.getTransaction({ transactionId: 555 });

    expect(result.confirmed).toBe(true);
    expect(result.statusMessage).toBe("To'landi");
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe("https://apigw.atmos.uz/merchant/pay/get");
    expect(JSON.parse(options.body)).toEqual({ store_id: "1234", transaction_id: 555 });
  });

  test("tasdiqlanmagan tranzaksiya uchun confirmed:false qaytaradi", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "tok", expires_in: 3600 }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: { code: "OK" }, store_transaction: { confirmed: false } }),
      });
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    const result = await atmosClient.getTransaction({ transactionId: 555 });
    expect(result.confirmed).toBe(false);
  });
});

describe("createCheckoutInvoice", () => {
  function fetchSequence({ tokenBody, createBody }) {
    return jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => tokenBody })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => createBody });
  }
  const sampleItems = [{ items_id: "pro", code: "10305008003000000", name: "ZeloShop", amount: 19900000, quantity: 1, details: [] }];

  test("to'g'ri so'rov yuboradi va payment_id/url/token'ni qaytaradi", async () => {
    const fetchMock = fetchSequence({
      tokenBody: { access_token: "tok", expires_in: 3600 },
      createBody: {
        store_id: 1234,
        payment_id: 272,
        token: "9Y53Bh_hFirZgxxFqBTwtA==",
        url: "https://checkout.atmos.uz/ru/invoice?id=9Y53Bh_hFirZgxxFqBTwtA==",
        status: { code: "OK", description: "Success" },
      },
    });
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    const result = await atmosClient.createCheckoutInvoice({
      requestId: "req-1",
      account: "acc-1",
      amountSom: 199000,
      successUrl: "https://example.com/return",
      items: sampleItems,
    });

    expect(result).toEqual({
      storeId: 1234,
      paymentId: 272,
      token: "9Y53Bh_hFirZgxxFqBTwtA==",
      url: "https://checkout.atmos.uz/ru/invoice?id=9Y53Bh_hFirZgxxFqBTwtA==",
    });
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe("https://apigw.atmos.uz/checkout/invoice/create");
    expect(options.headers.Authorization).toBe("Bearer tok");
    // 2026-09-15: hujjatning umumiy kirish qismida talab qilingan `apikey`
    // sarlavhasi endi HAR BIR checkout/invoice so'roviga qo'shiladi.
    expect(options.headers.apikey).toBe("test-api-key");
    const payload = JSON.parse(options.body);
    expect(payload).toEqual({
      request_id: "req-1",
      store_id: 1234,
      account: "acc-1",
      amount: 19900000,
      success_url: "https://example.com/return",
      items: sampleItems,
    });
  });

  test("expirationMinutes/expirationDateIso berilsa qo'shimcha maydonlarni yuboradi", async () => {
    const fetchMock = fetchSequence({
      tokenBody: { access_token: "tok", expires_in: 3600 },
      createBody: { store_id: 1234, payment_id: 1, token: "t", url: "https://checkout.atmos.uz/x", status: { code: "OK" } },
    });
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    await atmosClient.createCheckoutInvoice({
      requestId: "req-1", account: "acc-1", amountSom: 1000, successUrl: "https://x.com",
      items: sampleItems, expirationMinutes: 10, expirationDateIso: "2024-07-11T11:12:12",
    });

    const payload = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(payload.expiration_time).toBe(10);
    expect(payload.expiration_date).toBe("2024-07-11T11:12:12");
  });

  test("majburiy maydonlar bo'lmasa - so'rov yubormasdan xato tashlaydi", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    await expect(
      atmosClient.createCheckoutInvoice({ account: "a", amountSom: 100, successUrl: "https://x.com", items: sampleItems })
    ).rejects.toThrow(/requestId/);
    await expect(
      atmosClient.createCheckoutInvoice({ requestId: "r", amountSom: 100, successUrl: "https://x.com", items: sampleItems })
    ).rejects.toThrow(/account/);
    await expect(
      atmosClient.createCheckoutInvoice({ requestId: "r", account: "a", amountSom: 0, successUrl: "https://x.com", items: sampleItems })
    ).rejects.toThrow(/amountSom/);
    await expect(
      atmosClient.createCheckoutInvoice({ requestId: "r", account: "a", amountSom: 100, items: sampleItems })
    ).rejects.toThrow(/successUrl/);
    await expect(
      atmosClient.createCheckoutInvoice({ requestId: "r", account: "a", amountSom: 100, successUrl: "https://x.com", items: [] })
    ).rejects.toThrow(/items/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("status.code !== 'OK' bo'lsa - tavsiflovchi xato tashlaydi", async () => {
    const fetchMock = fetchSequence({
      tokenBody: { access_token: "tok", expires_in: 3600 },
      createBody: { status: { code: "ERROR", description: "Noto'g'ri items" } },
    });
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    await expect(
      atmosClient.createCheckoutInvoice({ requestId: "r", account: "a", amountSom: 100, successUrl: "https://x.com", items: sampleItems })
    ).rejects.toThrow(/Noto'g'ri items/);
  });

  test("javobda payment_id/url yo'q bo'lsa - xato tashlaydi", async () => {
    const fetchMock = fetchSequence({
      tokenBody: { access_token: "tok", expires_in: 3600 },
      createBody: { status: { code: "OK" } },
    });
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    await expect(
      atmosClient.createCheckoutInvoice({ requestId: "r", account: "a", amountSom: 100, successUrl: "https://x.com", items: sampleItems })
    ).rejects.toThrow(/payment_id/);
  });
});

describe("getCheckoutInvoiceStatus", () => {
  function fetchSequence({ tokenBody, getBody }) {
    return jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => tokenBody })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => getBody });
  }

  test("paymentId bilan so'rov yuboradi va success/final/state'ni qaytaradi", async () => {
    const fetchMock = fetchSequence({
      tokenBody: { access_token: "tok", expires_in: 3600 },
      getBody: {
        status: { code: "0", description: "Success" },
        state: "SUCCESS",
        amount: 100000,
        account: "acc-1",
        success: true,
        final: true,
      },
    });
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    const result = await atmosClient.getCheckoutInvoiceStatus({ paymentId: 598 });

    expect(result.success).toBe(true);
    expect(result.final).toBe(true);
    expect(result.state).toBe("SUCCESS");
    expect(result.amount).toBe(100000);
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe("https://apigw.atmos.uz/checkout/invoice/get");
    expect(JSON.parse(options.body)).toEqual({ payment_id: 598 });
  });

  test("token bilan so'rov yuboradi", async () => {
    const fetchMock = fetchSequence({
      tokenBody: { access_token: "tok", expires_in: 3600 },
      getBody: { status: { code: "0" }, success: false, final: false },
    });
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    await atmosClient.getCheckoutInvoiceStatus({ token: "abc" });

    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ token: "abc" });
  });

  test("paymentId va token ikkalasi ham berilmasa/ikkalasi ham berilsa - xato tashlaydi", async () => {
    const atmosClient = loadModule();
    await expect(atmosClient.getCheckoutInvoiceStatus({})).rejects.toThrow(/paymentId yoki token/);
    await expect(atmosClient.getCheckoutInvoiceStatus({ paymentId: 1, token: "a" })).rejects.toThrow(/bir vaqtda/);
  });

  test("hali yakunlanmagan (success:false) invoys uchun success:false qaytaradi", async () => {
    const fetchMock = fetchSequence({
      tokenBody: { access_token: "tok", expires_in: 3600 },
      getBody: { status: { code: "0" }, state: "PENDING", success: false, final: false },
    });
    global.fetch = fetchMock;
    const atmosClient = loadModule();

    const result = await atmosClient.getCheckoutInvoiceStatus({ paymentId: 1 });
    expect(result.success).toBe(false);
    expect(result.final).toBe(false);
  });
});

describe("buildCheckoutUrl", () => {
  test("production muhitida to'g'ri host va parametrlarni quradi", () => {
    const atmosClient = loadModule();
    const url = atmosClient.buildCheckoutUrl({ transactionId: 555, redirectLink: "https://t.me/bot/app?startapp=x" });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://checkout.pays.uz/invoice/get");
    expect(parsed.searchParams.get("storeId")).toBe("1234");
    expect(parsed.searchParams.get("transactionId")).toBe("555");
    expect(parsed.searchParams.get("redirectLink")).toBe("https://t.me/bot/app?startapp=x");
  });

  test("sandbox muhitida test-checkout hostini ishlatadi", () => {
    const atmosClient = loadModule({ ATMOS_ENV: "sandbox" });
    const url = atmosClient.buildCheckoutUrl({ transactionId: 555, redirectLink: "https://example.com" });
    expect(url.startsWith("http://test-checkout.pays.uz/invoice/get")).toBe(true);
  });

  test("redirectLink berilmasa - parametr qo'shmaydi", () => {
    const atmosClient = loadModule();
    const url = atmosClient.buildCheckoutUrl({ transactionId: 555 });
    const parsed = new URL(url);
    expect(parsed.searchParams.has("redirectLink")).toBe(false);
  });
});

describe("computeCallbackSign / verifyCallbackSign", () => {
  test("MD5(store_id+transaction_id+invoice+amount+api_key) formulasiga mos", () => {
    const atmosClient = loadModule();
    const crypto = require("crypto");
    const expected = crypto
      .createHash("md5")
      .update("1234555inv-14900000test-api-key", "utf8")
      .digest("hex");
    const sign = atmosClient.computeCallbackSign({
      storeId: "1234",
      transactionId: 555,
      invoice: "inv-1",
      amount: 4900000,
    });
    expect(sign).toBe(expected);
  });

  test("verifyCallbackSign - to'g'ri imzo uchun true", () => {
    const atmosClient = loadModule();
    const params = { storeId: "1234", transactionId: 555, invoice: "inv-1", amount: 4900000 };
    const sign = atmosClient.computeCallbackSign(params);
    expect(atmosClient.verifyCallbackSign({ ...params, sign })).toBe(true);
  });

  test("verifyCallbackSign - katta/kichik harf farqiga sezgir emas", () => {
    const atmosClient = loadModule();
    const params = { storeId: "1234", transactionId: 555, invoice: "inv-1", amount: 4900000 };
    const sign = atmosClient.computeCallbackSign(params);
    expect(atmosClient.verifyCallbackSign({ ...params, sign: sign.toUpperCase() })).toBe(true);
  });

  test("verifyCallbackSign - noto'g'ri imzo uchun false", () => {
    const atmosClient = loadModule();
    const params = { storeId: "1234", transactionId: 555, invoice: "inv-1", amount: 4900000 };
    expect(atmosClient.verifyCallbackSign({ ...params, sign: "0".repeat(32) })).toBe(false);
  });

  test("verifyCallbackSign - sign yo'q/noto'g'ri turdagi bo'lsa false", () => {
    const atmosClient = loadModule();
    const params = { storeId: "1234", transactionId: 555, invoice: "inv-1", amount: 4900000 };
    expect(atmosClient.verifyCallbackSign({ ...params, sign: undefined })).toBe(false);
    expect(atmosClient.verifyCallbackSign({ ...params, sign: 12345 })).toBe(false);
  });
});
