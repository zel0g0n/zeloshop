/**
 * `tariffPayments.js` uchun testlar - qo'lda tasdiqlangan tarif to'lovini
 * faollashtirish, to'lov holatini so'rash va kunlik eslatma.
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

function loadModule(db, { checkRateLimitMock, sendTelegramMessageMock } = {}) {
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
  return require("../tariffPayments");
}

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

  test("allaqachon 'paid' bo'lsa - keshlangan natijani qaytaradi", async () => {
    const db = buildMockDb({
      atmosPayments: { 555: { sellerId: "s1", plan: "pro", status: "paid", sellerPaidUntilAtActivation: 999 } },
    });
    const { _testables } = loadModule(db);

    const result = await _testables.handleGetTariffPaymentStatus({ auth: { uid: "s1" }, data: { transactionId: "555" } });

    expect(result).toEqual({ status: "paid", plan: "pro", paidUntilMs: 999 });
  });

  // `manualTariffPayments.js`dagi "qo'lda tasdiqlash" oqimi uchun yozuvlar.
  test("method:'manual' bo'lsa - saqlangan holatni ('pending_review') qaytaradi", async () => {
    const db = buildMockDb({
      atmosPayments: { manual_s1_1: { sellerId: "s1", plan: "start", status: "pending_review", amountSom: 49000, method: "manual" } },
    });
    const { _testables } = loadModule(db);

    const result = await _testables.handleGetTariffPaymentStatus({ auth: { uid: "s1" }, data: { transactionId: "manual_s1_1" } });

    expect(result).toEqual({ status: "pending_review", plan: "start", amountSom: 49000 });
  });

  test("method:'manual' VA admin rad etgan bo'lsa - 'rejected' holatini sababi bilan qaytaradi", async () => {
    const db = buildMockDb({
      atmosPayments: { manual_s1_1: { sellerId: "s1", plan: "start", status: "rejected", amountSom: 49000, method: "manual", rejectReason: "Kartaga pul tushmagan" } },
    });
    const { _testables } = loadModule(db);

    const result = await _testables.handleGetTariffPaymentStatus({ auth: { uid: "s1" }, data: { transactionId: "manual_s1_1" } });

    expect(result).toEqual({ status: "rejected", plan: "start", amountSom: 49000, rejectReason: "Kartaga pul tushmagan" });
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
