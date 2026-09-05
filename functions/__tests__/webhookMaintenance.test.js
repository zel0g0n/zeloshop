/**
 * `webhookMaintenance.js`dagi `cleanupCollection` uchun testlar —
 * 4-BOT EKOTIZIM AUDITI (P2): `processedTelegramUpdates` uchun TTL
 * (eskirgan hujjatlarni tozalash) siyosati. Shuningdek
 * `telegramAuthReplayGuard` (Telegram initData replay himoyasi,
 * `telegramAuth.js`ga qarang) uchun BIR XIL mexanizmni ishlatuvchi
 * ikkinchi kunlik vazifa.
 */
function loadModule({ docs = [], collectionsSeen = [] } = {}) {
  jest.resetModules();
  const deletedRefs = [];
  const batch = { delete: (ref) => deletedRefs.push(ref), commit: jest.fn(async () => undefined) };

  const mockDb = {
    collection: (name) => {
      collectionsSeen.push(name);
      return {
        where: (field, op, value) => ({
          limit: () => ({
            get: async () => ({
              empty: docs.length === 0,
              size: docs.filter((d) => (op === "<" ? d[field] < value : true)).length,
              docs: docs.filter((d) => (op === "<" ? d[field] < value : true)).map((d) => ({ ref: `ref_${d.id}` })),
            }),
          }),
        }),
      };
    },
    batch: () => batch,
  };

  jest.doMock("../lib/admin", () => ({ db: mockDb }));
  jest.doMock("firebase-functions/v2/scheduler", () => ({ onSchedule: (config, handler) => handler }));
  const mod = require("../webhookMaintenance");
  return { mod, deletedRefs, batch, collectionsSeen };
}

describe("cleanupCollection", () => {
  test("eskirgan hujjatlarni BATCH orqali o'chiradi va sonini qaytaradi", async () => {
    const now = Date.now();
    const { mod, deletedRefs, batch } = loadModule({
      docs: [
        { id: "old1", processedAt: now - 10 * 24 * 60 * 60 * 1000 }, // 10 kun oldin - eskirgan
        { id: "old2", processedAt: now - 8 * 24 * 60 * 60 * 1000 },  // 8 kun oldin - eskirgan
      ],
    });

    const count = await mod._testables.cleanupCollection("processedTelegramUpdates", 7 * 24 * 60 * 60 * 1000);

    expect(count).toBe(2);
    expect(deletedRefs).toEqual(["ref_old1", "ref_old2"]);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  test("hech qanday eskirgan hujjat bo'lmasa, hech narsa o'chirmaydi", async () => {
    const { mod, deletedRefs, batch } = loadModule({ docs: [] });

    const count = await mod._testables.cleanupCollection("processedTelegramUpdates", 7 * 24 * 60 * 60 * 1000);

    expect(count).toBe(0);
    expect(deletedRefs).toEqual([]);
    expect(batch.commit).not.toHaveBeenCalled();
  });
});

describe("cleanupTelegramAuthReplayGuard (kunlik vazifa)", () => {
  test("`telegramAuthReplayGuard` kolleksiyasini tozalaydi, xatoni yutib qo'ymaydi (loglaydi)", async () => {
    const collectionsSeen = [];
    const { mod } = loadModule({ docs: [], collectionsSeen });

    await expect(mod.cleanupTelegramAuthReplayGuard()).resolves.not.toThrow();
    expect(collectionsSeen).toContain("telegramAuthReplayGuard");
  });

  test("`cleanupCollection` xato tashlasa ham, funksiyaning o'zi xato tashlamaydi", async () => {
    jest.resetModules();
    jest.doMock("../lib/admin", () => ({
      db: {
        collection: () => {
          throw new Error("simulyatsiya qilingan Firestore xatosi");
        },
      },
    }));
    jest.doMock("firebase-functions/v2/scheduler", () => ({ onSchedule: (config, handler) => handler }));
    const mod = require("../webhookMaintenance");

    await expect(mod.cleanupTelegramAuthReplayGuard()).resolves.not.toThrow();
  });
});
