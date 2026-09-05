/**
 * `telegramAuth.js` — butun auth tizimining "yuragi" (Telegram
 * initData HMAC tekshiruvi) — ILGARI hech qanday ALOHIDA test fayliga
 * ega emas edi (barcha iste'molchilar, masalan `auth.test.js`, uni
 * to'liq mock qilib o'tib ketishardi). Bu fayl ikki narsani sinaydi:
 *
 *   1) Haqiqiy HMAC tekshiruvining o'zi (to'g'ri/soxta imzo, muddati
 *      o'tgan initData) — Telegramning rasmiy algoritmiga mos, xuddi
 *      shu tekshiruv real ishlatiladigan tarzda.
 *   2) 2026-09 audit (P2) — replay (qayta ishlatish) himoyasi:
 *      `checkTelegramAuthReplay` / bitta `hash`ning necha marta va
 *      qay muddatgacha qayta ishlatilishiga ruxsat berilishi.
 */
const crypto = require("crypto");

const BOT_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";

/** Telegramning rasmiy `initData` imzolash algoritmi (test uchun). */
function buildSignedInitData(fields, botToken = BOT_TOKEN) {
  const params = new URLSearchParams(fields);
  const dataCheckArr = [];
  for (const [key, value] of params.entries()) {
    dataCheckArr.push(`${key}=${value}`);
  }
  dataCheckArr.sort();
  const dataCheckString = dataCheckArr.join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  params.set("hash", hash);
  return params.toString();
}

function buildMockDb({ existingDocs = {} } = {}) {
  const store = { ...existingDocs };
  const setCalls = [];
  const updateCalls = [];
  return {
    collection: (name) => ({
      doc: (id) => ({ _collection: name, _id: id }),
    }),
    runTransaction: async (fn) => {
      const tx = {
        get: async (ref) => {
          const data = store[ref._id];
          return data ? { exists: true, data: () => data } : { exists: false };
        },
        set: (ref, data) => {
          store[ref._id] = data;
          setCalls.push({ id: ref._id, data });
        },
        update: (ref, patch) => {
          store[ref._id] = { ...store[ref._id], ...patch };
          updateCalls.push({ id: ref._id, patch });
        },
      };
      return fn(tx);
    },
    __store: store,
    __setCalls: setCalls,
    __updateCalls: updateCalls,
  };
}

function loadModule(db) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({ db }));
  return require("../telegramAuth");
}

describe("verifyTelegramInitData (haqiqiy HMAC tekshiruvi)", () => {
  test("TO'G'RI imzolangan initData qabul qilinadi va user/startParam to'g'ri qaytadi", async () => {
    const db = buildMockDb();
    const { verifyTelegramInitData } = loadModule(db);
    const authDate = Math.floor(Date.now() / 1000);
    const initData = buildSignedInitData({
      auth_date: String(authDate),
      user: JSON.stringify({ id: 555, first_name: "Ali" }),
      start_param: "seller-123",
    });

    const result = await verifyTelegramInitData(initData, BOT_TOKEN);
    expect(result.user).toEqual({ id: 555, first_name: "Ali" });
    expect(result.startParam).toBe("seller-123");
    expect(result.authDate).toBe(authDate);
  });

  test("SOXTA (buzilgan) imzo rad etiladi", async () => {
    const db = buildMockDb();
    const { verifyTelegramInitData } = loadModule(db);
    const authDate = Math.floor(Date.now() / 1000);
    let initData = buildSignedInitData({ auth_date: String(authDate), user: JSON.stringify({ id: 1 }) });
    // Hash'ni ATAYLAB buzamiz.
    initData = initData.replace(/hash=[0-9a-f]+/, "hash=" + "0".repeat(64));

    await expect(verifyTelegramInitData(initData, BOT_TOKEN)).rejects.toThrow(/imzosi noto'g'ri/);
  });

  test("BOSHQA bot tokeni bilan imzolangan initData rad etiladi", async () => {
    const db = buildMockDb();
    const { verifyTelegramInitData } = loadModule(db);
    const authDate = Math.floor(Date.now() / 1000);
    const initData = buildSignedInitData(
      { auth_date: String(authDate), user: JSON.stringify({ id: 1 }) },
      "999999:WRONG-TOKEN"
    );

    await expect(verifyTelegramInitData(initData, BOT_TOKEN)).rejects.toThrow(/imzosi noto'g'ri/);
  });

  test("MUDDATI O'TGAN initData (auth_date juda eski) rad etiladi", async () => {
    const db = buildMockDb();
    const { verifyTelegramInitData } = loadModule(db);
    const oldAuthDate = Math.floor(Date.now() / 1000) - 90000; // ~25 soat oldin
    const initData = buildSignedInitData({ auth_date: String(oldAuthDate), user: JSON.stringify({ id: 1 }) });

    await expect(verifyTelegramInitData(initData, BOT_TOKEN, 86400)).rejects.toThrow(/eskirgan/);
  });

  test("hash umuman yo'q bo'lsa rad etiladi", async () => {
    const db = buildMockDb();
    const { verifyTelegramInitData } = loadModule(db);
    await expect(verifyTelegramInitData("auth_date=123&user=%7B%7D", BOT_TOKEN)).rejects.toThrow(/hash topilmadi/);
  });
});

describe("checkTelegramAuthReplay (2026-09 audit, P2 — replay himoyasi)", () => {
  test("BIRINCHI marta ko'rilgan hash - to'siqsiz o'tadi, hujjat yoziladi", async () => {
    const db = buildMockDb();
    const { _testables } = loadModule(db);
    await expect(_testables.checkTelegramAuthReplay("hash-1")).resolves.not.toThrow();
    expect(db.__setCalls.length).toBe(1);
    expect(db.__setCalls[0].data.useCount).toBe(1);
  });

  test("QISQA vaqt ichida bir necha marta (chegara ichida) - LEGITIM qayta urinish sifatida o'tkaziladi", async () => {
    const db = buildMockDb();
    const mod = loadModule(db);
    for (let i = 0; i < mod._testables.REPLAY_MAX_USES; i += 1) {
      await expect(mod._testables.checkTelegramAuthReplay("hash-2")).resolves.not.toThrow();
    }
    expect(db.__store["hash-2"].useCount).toBe(mod._testables.REPLAY_MAX_USES);
  });

  test("CHEGARADAN (REPLAY_MAX_USES) OSHGAN urinish - replay sifatida rad etiladi", async () => {
    const db = buildMockDb();
    const mod = loadModule(db);
    for (let i = 0; i < mod._testables.REPLAY_MAX_USES; i += 1) {
      await mod._testables.checkTelegramAuthReplay("hash-3");
    }
    await expect(mod._testables.checkTelegramAuthReplay("hash-3")).rejects.toThrow(/replay/);
  });

  test("QAYTA URINISH OYNASIDAN (REPLAY_RETRY_WINDOW_MS) tashqarida - replay sifatida rad etiladi (foydalanish soni chegaradan past bo'lsa ham)", async () => {
    const db = buildMockDb({
      existingDocs: {
        "hash-4": { processedAt: 0, firstSeenAtMs: 0, useCount: 1 }, // "juda uzoq" o'tmishda ko'rilgan
      },
    });
    const mod = loadModule(db);
    await expect(mod._testables.checkTelegramAuthReplay("hash-4")).rejects.toThrow(/replay/);
  });

  test("hash bo'sh/undefined bo'lsa - hech narsa qilmaydi (chaqiruvchi allaqachon tekshirgan)", async () => {
    const db = buildMockDb();
    const mod = loadModule(db);
    await expect(mod._testables.checkTelegramAuthReplay(undefined)).resolves.not.toThrow();
    expect(db.__setCalls.length).toBe(0);
  });

  test("FAIL OPEN: Firestore tranzaksiyasi kutilmagan xato bersa (replay ANIQLANMAGAN holatda), funksiya XATO TASHLAMAYDI", async () => {
    const brokenDb = {
      collection: () => ({ doc: () => ({}) }),
      runTransaction: async () => {
        throw new Error("Firestore vaqtincha ishlamayapti");
      },
    };
    const mod = loadModule(brokenDb);
    await expect(mod._testables.checkTelegramAuthReplay("hash-5")).resolves.not.toThrow();
  });
});

describe("verifyTelegramInitData + replay himoyasi BIRGALIKDA", () => {
  test("BIR XIL to'g'ri imzolangan initData ikkinchi marta (chegara ichida) ham qabul qilinadi, lekin ko'p marta takrorlansa rad etiladi", async () => {
    const db = buildMockDb();
    const mod = loadModule(db);
    const authDate = Math.floor(Date.now() / 1000);
    const initData = buildSignedInitData({ auth_date: String(authDate), user: JSON.stringify({ id: 42 }) });

    for (let i = 0; i < mod._testables.REPLAY_MAX_USES; i += 1) {
      await expect(mod.verifyTelegramInitData(initData, BOT_TOKEN)).resolves.toBeTruthy();
    }
    await expect(mod.verifyTelegramInitData(initData, BOT_TOKEN)).rejects.toThrow(/replay/);
  });
});
