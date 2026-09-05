/**
 * `lib/notificationRetryQueue.js` uchun testlar — 4-BOT EKOTIZIM
 * AUDITI (P2): `sendTelegramMessage`ning o'z ICHKI qayta urinishlari
 * tugagandan keyin ham muvaffaqiyatsiz bo'lgan, MUHIM bildirishnomalar
 * uchun "o'lik xat" (dead-letter) navbati.
 */
function buildMockDb() {
  const docs = new Map();
  let counter = 0;

  const makeDocRef = (id) => ({
    id,
    delete: async () => { docs.delete(id); },
    update: async (patch) => { docs.set(id, { ...docs.get(id), ...patch }); },
  });

  return {
    __docs: docs,
    collection: () => ({
      doc: (id) => makeDocRef(id),
      add: async (data) => {
        const id = `doc${counter++}`;
        docs.set(id, data);
        return { id };
      },
      where: (field, op, value) => ({
        get: async () => {
          const matching = Array.from(docs.entries()).filter(([, data]) => {
            if (field !== "status" || op !== "==") return true;
            return data[field] === value;
          });
          return {
            docs: matching.map(([id, data]) => ({
              id,
              ref: makeDocRef(id),
              data: () => data,
            })),
          };
        },
      }),
    }),
  };
}

function loadModule(mockDb) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: {
      firestore: {
        FieldValue: { serverTimestamp: () => "MOCK_TS" },
        Timestamp: { fromMillis: (ms) => ({ toMillis: () => ms }) },
      },
    },
    db: mockDb,
  }));
  return require("../lib/notificationRetryQueue");
}

describe("enqueueRetry", () => {
  test("berilgan kontekst bilan navbatga hujjat qo'shadi, XOM TOKEN saqlamaydi", async () => {
    const mockDb = buildMockDb();
    const { enqueueRetry, COLLECTION } = loadModule(mockDb);

    await enqueueRetry({
      kind: "customerNotification",
      payload: { sellerId: "s1", clientId: "c1", text: "Salom" },
      reason: "chat not found",
    });

    expect(mockDb.__docs.size).toBe(1);
    const [doc] = mockDb.__docs.values();
    expect(doc.kind).toBe("customerNotification");
    expect(doc.payload).toEqual({ sellerId: "s1", clientId: "c1", text: "Salom" });
    expect(doc.status).toBe("pending");
    expect(doc.attempts).toBe(0);
    expect(JSON.stringify(doc)).not.toMatch(/bot.*token/i);
    expect(COLLECTION).toBe("notificationRetryQueue");
  });

  test("kind yoki payload berilmasa, hech narsa yozmaydi (xato ham tashlamaydi)", async () => {
    const mockDb = buildMockDb();
    const { enqueueRetry } = loadModule(mockDb);

    await enqueueRetry({ kind: null, payload: { a: 1 } });
    await enqueueRetry({ kind: "x", payload: null });

    expect(mockDb.__docs.size).toBe(0);
  });

  test("Firestore xato bersa, xato TASHLAMAYDI (ikkinchi darajali, fail-safe)", async () => {
    const throwingDb = { collection: () => ({ add: async () => { throw new Error("Firestore ishlamayapti"); } }) };
    const { enqueueRetry } = loadModule(throwingDb);

    await expect(enqueueRetry({ kind: "sellerMessage", payload: { chatId: "1", text: "x" } })).resolves.toBeUndefined();
  });
});

describe("recordAttemptResult", () => {
  test("muvaffaqiyatli bo'lsa, hujjat DARHOL o'chiriladi", async () => {
    const mockDb = buildMockDb();
    const { recordAttemptResult } = loadModule(mockDb);
    mockDb.__docs.set("d1", { attempts: 2 });

    const doc = { id: "d1", data: () => ({ attempts: 2 }) };
    const result = await recordAttemptResult(doc, true);

    expect(result.finalFailure).toBe(false);
    expect(mockDb.__docs.has("d1")).toBe(false);
  });

  test("muvaffaqiyatsiz, lekin MAX_ATTEMPTS'ga yetmagan bo'lsa — urinish sonini oshiradi va KEYINGI vaqtni belgilaydi", async () => {
    const mockDb = buildMockDb();
    mockDb.__docs.set("d1", { attempts: 1 });
    const { recordAttemptResult } = loadModule(mockDb);

    const doc = { id: "d1", data: () => ({ attempts: 1 }) };
    const result = await recordAttemptResult(doc, false, "vaqtinchalik xato");

    expect(result.finalFailure).toBe(false);
    expect(mockDb.__docs.get("d1").attempts).toBe(2);
    expect(mockDb.__docs.get("d1").nextAttemptAt.toMillis()).toBeGreaterThan(Date.now());
  });

  test("MAX_ATTEMPTS'ga yetganda — hujjat o'chiriladi VA \"finalFailure: true\" qaytaradi (CHEKSIZ qayta urinish YO'Q)", async () => {
    const mockDb = buildMockDb();
    const { recordAttemptResult, MAX_ATTEMPTS } = loadModule(mockDb);
    mockDb.__docs.set("d1", { attempts: MAX_ATTEMPTS - 1 });

    const doc = { id: "d1", data: () => ({ attempts: MAX_ATTEMPTS - 1 }) };
    const result = await recordAttemptResult(doc, false, "doimiy xato");

    expect(result.finalFailure).toBe(true);
    expect(mockDb.__docs.has("d1")).toBe(false);
  });
});

describe("fetchDueRetries", () => {
  test("faqat `nextAttemptAt` HOZIRGI vaqtdan OLDIN bo'lgan hujjatlarni qaytaradi", async () => {
    const mockDb = buildMockDb();
    const now = Date.now();
    mockDb.__docs.set("due1", { status: "pending", nextAttemptAt: { toMillis: () => now - 1000 } });
    mockDb.__docs.set("notDueYet", { status: "pending", nextAttemptAt: { toMillis: () => now + 100000 } });
    const { fetchDueRetries } = loadModule(mockDb);

    const due = await fetchDueRetries(now);

    expect(due.map((d) => d.id)).toEqual(["due1"]);
  });
});
