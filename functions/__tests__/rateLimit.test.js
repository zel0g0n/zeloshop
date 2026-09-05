/**
 * `lib/rateLimit.js` uchun testlar.
 *
 * Bu yerda, boshqa test fayllaridan farqli o'laroq, HAQIQIY holatni
 * saqlaydigan (stateful) soxta Firestore ishlatiladi — chunki
 * chegaralashning o'zini (sanoq to'g'ri oshishi, chegaradan
 * o'tganda rad etishi, oyna tugagach qayta boshlanishi) sinash
 * uchun, har bir chaqiruv OLDINGI chaqiruv natijasini "eslab
 * qolishi" kerak.
 */

function buildStatefulMockDb() {
  const store = new Map();

  function makeDocRef(path) {
    return {
      __path: path,
      get: async () => {
        const data = store.get(path);
        return data ? { exists: true, data: () => data } : { exists: false };
      },
    };
  }

  return {
    db: {
      collection: (name) => ({
        doc: (id) => makeDocRef(`${name}/${id}`),
      }),
      runTransaction: async (callback) => {
        const transaction = {
          get: async (ref) => ref.get(),
          set: (ref, data) => store.set(ref.__path, data),
        };
        return callback(transaction);
      },
    },
    store,
  };
}

function loadRateLimit(mockDb) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({ db: mockDb }));
  return require("../lib/rateLimit");
}

describe("checkRateLimit", () => {
  test("chegaradan past bo'lgan so'rovlarga ruxsat beradi", async () => {
    const { db } = buildStatefulMockDb();
    const { checkRateLimit } = loadRateLimit(db);

    // Chegara 3 ta — birinchi 3 ta chaqiruv MUVAFFAQIYATLI o'tishi kerak.
    await expect(checkRateLimit("test-key-1", 3, 60)).resolves.toBeUndefined();
    await expect(checkRateLimit("test-key-1", 3, 60)).resolves.toBeUndefined();
    await expect(checkRateLimit("test-key-1", 3, 60)).resolves.toBeUndefined();
  });

  test("chegaradan oshgan so'rovni 'resource-exhausted' xatosi bilan rad etadi", async () => {
    const { db } = buildStatefulMockDb();
    const { checkRateLimit } = loadRateLimit(db);

    await checkRateLimit("test-key-2", 2, 60);
    await checkRateLimit("test-key-2", 2, 60);
    // 3-chaqiruv — chegaradan (2) oshadi.
    await expect(checkRateLimit("test-key-2", 2, 60)).rejects.toMatchObject({
      code: "resource-exhausted",
    });
  });

  test("har xil kalitlar (masalan turli foydalanuvchilar) BIR-BIRIGA ta'sir qilmasligi kerak", async () => {
    const { db } = buildStatefulMockDb();
    const { checkRateLimit } = loadRateLimit(db);

    await checkRateLimit("user-A", 1, 60);
    // "user-A" chegarasi (1) tugagan bo'lsa ham, "user-B" ALOHIDA
    // sanoqqa ega — bu ham muvaffaqiyatli o'tishi kerak.
    await expect(checkRateLimit("user-B", 1, 60)).resolves.toBeUndefined();
    // Lekin "user-A"ning o'zi endi rad etilishi kerak.
    await expect(checkRateLimit("user-A", 1, 60)).rejects.toMatchObject({
      code: "resource-exhausted",
    });
  });

  test("oyna tugagach, sanoq qayta boshlanishi kerak", async () => {
    const { db } = buildStatefulMockDb();
    const { checkRateLimit } = loadRateLimit(db);

    const realNow = Date.now;
    let mockedNow = 1_000_000;
    Date.now = () => mockedNow;

    try {
      await checkRateLimit("test-key-3", 1, 10); // 10 soniyalik oyna, chegara 1
      await expect(checkRateLimit("test-key-3", 1, 10)).rejects.toMatchObject({
        code: "resource-exhausted",
      });

      // Vaqtni oynadan (10s) KEYINGI nuqtaga "suramiz".
      mockedNow += 11_000;

      // Endi YANGI oyna boshlangan — qayta ruxsat berilishi kerak.
      await expect(checkRateLimit("test-key-3", 1, 10)).resolves.toBeUndefined();
    } finally {
      Date.now = realNow;
    }
  });
});
