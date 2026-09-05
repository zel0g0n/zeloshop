/**
 * `lib/webhookDedup.js` uchun testlar — 4-BOT EKOTIZIM AUDITI (P1):
 * Telegram webhook YETKAZISH kafolati "kamida bir marta" (at-least-once)
 * bo'lgani uchun, bir xil `update_id` ikkinchi marta kelishi mumkin —
 * bu funksiya shuni Firestore orqali aniqlaydi.
 */
function buildTransactionalDb({ existingIds = [] } = {}) {
  const created = [];
  return {
    collection: (name) => ({
      doc: (id) => ({ __name: name, __id: id }),
    }),
    runTransaction: async (fn) => {
      return fn({
        get: async (ref) => ({
          exists: existingIds.includes(ref.__id),
        }),
        set: (ref) => {
          created.push(ref.__id);
        },
      });
    },
    __created: created,
  };
}

function loadModule(mockDb) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({ db: mockDb }));
  return require("../lib/webhookDedup");
}

describe("isDuplicateUpdate", () => {
  test("update_id berilmasa, tekshirmasdan `false` qaytaradi (Firestore'ga umuman murojaat qilmaydi)", async () => {
    const mockDb = { collection: jest.fn(), runTransaction: jest.fn() };
    const { isDuplicateUpdate } = loadModule(mockDb);

    expect(await isDuplicateUpdate("main", undefined)).toBe(false);
    expect(await isDuplicateUpdate("main", null)).toBe(false);
    expect(mockDb.collection).not.toHaveBeenCalled();
  });

  test("birinchi marta ko'rilgan update_id — dublikat EMAS, hujjat yaratiladi", async () => {
    const mockDb = buildTransactionalDb({ existingIds: [] });
    const { isDuplicateUpdate } = loadModule(mockDb);

    const result = await isDuplicateUpdate("main", 12345);
    expect(result).toBe(false);
    expect(mockDb.__created).toContain("main_12345");
  });

  test("allaqachon qayta ishlangan update_id — dublikat deb topiladi", async () => {
    const mockDb = buildTransactionalDb({ existingIds: ["courier_999"] });
    const { isDuplicateUpdate } = loadModule(mockDb);

    expect(await isDuplicateUpdate("courier", 999)).toBe(true);
  });

  test("bot nomi turlicha bo'lsa, BIR XIL update_id son (masalan 1) TO'QNASHMAYDI — har bir bot alohida hisoblanadi", async () => {
    const mockDb = buildTransactionalDb({ existingIds: ["main_1"] });
    const { isDuplicateUpdate } = loadModule(mockDb);

    expect(await isDuplicateUpdate("main", 1)).toBe(true); // shu bot uchun allaqachon ko'rilgan
    expect(await isDuplicateUpdate("courier", 1)).toBe(false); // boshqa bot uchun - birinchi marta
  });

  test("Firestore xato bersa, xato TASHLAMAYDI — \"fail open\": `false` qaytaradi", async () => {
    const mockDb = {
      collection: () => ({ doc: () => ({}) }),
      runTransaction: async () => { throw new Error("Firestore vaqtincha ishlamayapti"); },
    };
    const { isDuplicateUpdate } = loadModule(mockDb);

    await expect(isDuplicateUpdate("main", 42)).resolves.toBe(false);
  });
});
