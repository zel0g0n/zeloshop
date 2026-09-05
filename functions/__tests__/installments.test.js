/**
 * `installments.js`ning `submitInstallmentPayment`i uchun testlar -
 * "bo'lib to'lash" rejasidagi KEYINGI qism chekini biriktirish onCall
 * funksiyasi. Shuningdek `lib/installments.js`dagi sof
 * `computeInstallmentAmounts` funksiyasi ham shu yerda sinaladi -
 * hech qanday tashqi bog'liqligi yo'q, alohida mock kerak emas.
 *
 * Haqiqiy Firestore'ga ULANMAYDI - barchasi taqlid qilingan (mock).
 */
const { computeInstallmentAmounts } = require("../lib/installments");

describe("computeInstallmentAmounts", () => {
  test("summani berilgan songa TENG qismlarga bo'ladi (qoldiqsiz)", () => {
    expect(computeInstallmentAmounts(100000, 2)).toEqual([50000, 50000]);
  });

  test("teng bo'linmaydigan summada - OXIRGI qism qoldiqni o'ziga oladi", () => {
    expect(computeInstallmentAmounts(100000, 3)).toEqual([33333, 33333, 33334]);
  });

  test("yig'indi HAR DOIM asl summaga TENG bo'ladi (yaxlitlash xatosi yo'qoladi)", () => {
    const amounts = computeInstallmentAmounts(100001, 7);
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(100001);
    expect(amounts).toHaveLength(7);
  });

  test("1 qism so'ralsa - butun summani o'z ichiga olgan bitta elementli massiv qaytaradi", () => {
    expect(computeInstallmentAmounts(50000, 1)).toEqual([50000]);
  });

  test("noto'g'ri/manfiy qiymatlar uchun ham xato bermaydi (0/1ga yaxlitlaydi)", () => {
    expect(computeInstallmentAmounts(-500, 2)).toEqual([0, 0]);
    expect(computeInstallmentAmounts(100000, 0)).toEqual([100000]);
    expect(computeInstallmentAmounts(100000, -3)).toEqual([100000]);
  });
});

function buildMockDb({ orderData = null } = {}) {
  const updateCalls = [];
  const orderRef = { __path: ["orders", "order-1"] };

  return {
    collection: (name) => {
      if (name !== "orders") throw new Error(`Kutilmagan kolleksiya: ${name}`);
      return {
        doc: () => orderRef,
      };
    },
    runTransaction: async (callback) => {
      const transaction = {
        get: async (ref) => (
          ref === orderRef && orderData
            ? { exists: true, data: () => orderData }
            : { exists: false }
        ),
        update: (ref, data) => updateCalls.push({ ref, data }),
      };
      return callback(transaction);
    },
    __updateCalls: updateCalls,
  };
}

function loadModule({ db } = {}) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({ db }));
  jest.doMock("../lib/rateLimit", () => ({ checkRateLimit: jest.fn(async () => undefined) }));
  return require("../installments");
}

describe("handleSubmitInstallmentPayment", () => {
  test("autentifikatsiyasiz chaqiruvni rad etadi", async () => {
    const { _testables } = loadModule({ db: buildMockDb({}) });
    await expect(
      _testables.handleSubmitInstallmentPayment({ auth: null, data: { orderId: "order-1", receiptUrl: "url" } })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("orderId yoki receiptUrl berilmasa rad etadi", async () => {
    const { _testables } = loadModule({ db: buildMockDb({}) });
    await expect(
      _testables.handleSubmitInstallmentPayment({ auth: { uid: "client-1" }, data: { orderId: "order-1" } })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("mavjud bo'lmagan buyurtma - 'not-found' beradi", async () => {
    const { _testables } = loadModule({ db: buildMockDb({ orderData: null }) });
    await expect(
      _testables.handleSubmitInstallmentPayment({ auth: { uid: "client-1" }, data: { orderId: "order-1", receiptUrl: "url" } })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  test("boshqa mijozning buyurtmasiga urinish - 'permission-denied' beradi", async () => {
    const { _testables } = loadModule({
      db: buildMockDb({ orderData: { clientId: "boshqa-mijoz", installmentPlan: { totalParts: 2, partsPaid: 1, amounts: [50000, 50000] } } }),
    });
    await expect(
      _testables.handleSubmitInstallmentPayment({ auth: { uid: "client-1" }, data: { orderId: "order-1", receiptUrl: "url" } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("bo'lib to'lash rejasi yo'q buyurtmaga urinish - 'failed-precondition' beradi", async () => {
    const { _testables } = loadModule({
      db: buildMockDb({ orderData: { clientId: "client-1", installmentPlan: null } }),
    });
    await expect(
      _testables.handleSubmitInstallmentPayment({ auth: { uid: "client-1" }, data: { orderId: "order-1", receiptUrl: "url" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("barcha qismlar allaqachon to'langan bo'lsa - 'failed-precondition' beradi", async () => {
    const { _testables } = loadModule({
      db: buildMockDb({
        orderData: { clientId: "client-1", installmentPlan: { totalParts: 2, partsPaid: 2, amounts: [50000, 50000] } },
      }),
    });
    await expect(
      _testables.handleSubmitInstallmentPayment({ auth: { uid: "client-1" }, data: { orderId: "order-1", receiptUrl: "url" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("haqiqiy, yaroqli holatda - keyingi qism chekini biriktiradi va `partsPaid`ni oshiradi", async () => {
    const db = buildMockDb({
      orderData: {
        clientId: "client-1",
        installmentPlan: {
          totalParts: 3,
          partsPaid: 1,
          amounts: [40000, 30000, 30000],
          payments: [{ index: 0, amount: 40000, receiptUrl: "receipt-1", submittedAtMs: 111 }],
        },
      },
    });
    const { _testables } = loadModule({ db });

    const result = await _testables.handleSubmitInstallmentPayment({
      auth: { uid: "client-1" },
      data: { orderId: "order-1", receiptUrl: "receipt-2" },
    });

    expect(result).toEqual({ partsPaid: 2, totalParts: 3, isFullyPaid: false });
    expect(db.__updateCalls.length).toBe(1);
    const updatedPlan = db.__updateCalls[0].data.installmentPlan;
    expect(updatedPlan.partsPaid).toBe(2);
    expect(updatedPlan.payments).toHaveLength(2);
    expect(updatedPlan.payments[1]).toEqual({ index: 1, amount: 30000, receiptUrl: "receipt-2", submittedAtMs: expect.any(Number) });
  });

  test("SO'NGGI qism to'langanda - `isFullyPaid: true` qaytaradi", async () => {
    const db = buildMockDb({
      orderData: {
        clientId: "client-1",
        installmentPlan: { totalParts: 2, partsPaid: 1, amounts: [50000, 50000], payments: [{ index: 0, amount: 50000, receiptUrl: "r1" }] },
      },
    });
    const { _testables } = loadModule({ db });

    const result = await _testables.handleSubmitInstallmentPayment({
      auth: { uid: "client-1" },
      data: { orderId: "order-1", receiptUrl: "receipt-2" },
    });

    expect(result.isFullyPaid).toBe(true);
    expect(result.partsPaid).toBe(2);
  });
});
