/**
 * `weeklyBusinessReport.js`ning `sendWeeklyBusinessReports`i uchun
 * testlar — `birthdayRewards.test.js`/`automationRules.test.js` bilan
 * BIR XIL naqsh (`onSchedule`ning ichki handler'ini to'g'ridan-to'g'ri
 * chaqiramiz).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function makeSellersQueryable(sellerDocs) {
  return {
    where: () => makeSellersQueryable(sellerDocs),
    limit: () => makeSellersQueryable(sellerDocs),
    get: async () => ({ empty: sellerDocs.length === 0, docs: sellerDocs }),
    // `computeWeeklySummary` bitta sotuvchining `orderRollups` quyi
    // kolleksiyasiga `.doc(sellerId)` orqali kiradi - shu bilan bir
    // vaqtda tepadagi `.where/.limit/.get` so'rov zanjiri ham kerak,
    // shuning uchun IKKALASINI ham qo'llab-quvvatlaymiz.
    doc: (id) => sellerDocs.find((d) => d.id === id) || { collection: () => ({ doc: () => ({ get: async () => ({ exists: false }) }) }) },
  };
}

/** Bitta sotuvchi hujjati — `orderRollups` quyi kolleksiyasi bilan. */
function makeSellerDoc(id, data, rollupsByDateKey = {}) {
  return {
    id,
    data: () => data,
    collection: (subName) => {
      if (subName !== "orderRollups") throw new Error(`Kutilmagan quyi kolleksiya: ${subName}`);
      return {
        doc: (dateKey) => ({
          get: async () => (rollupsByDateKey[dateKey] ? { exists: true, data: () => rollupsByDateKey[dateKey] } : { exists: false }),
        }),
      };
    },
  };
}

function buildMockDb(sellerDocs) {
  return {
    collection: (name) => {
      if (name === "sellers") return makeSellersQueryable(sellerDocs);
      throw new Error(`Kutilmagan kolleksiya: ${name}`);
    },
  };
}

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: (config, handler) => handler,
}));

function loadModule(db) {
  jest.resetModules();
  const sendTelegramMessageMock = jest.fn(async () => ({ ok: true }));
  jest.doMock("../lib/admin", () => ({ db, BOT_TOKEN: { value: () => "platform-token" } }));
  jest.doMock("../lib/helpers", () => ({
    sendTelegramMessage: sendTelegramMessageMock,
    buildSellerAppLink: (path) => `https://commerce-zelo.web.app${path}`,
  }));
  jest.doMock("../lib/sentry", () => ({
    withSentry: (fn) => fn,
    SENTRY_DSN: { value: () => null },
    Sentry: { captureException: jest.fn() },
    initSentry: jest.fn(),
  }));
  const mod = require("../weeklyBusinessReport");
  return { ...mod, __sendTelegramMessageMock: sendTelegramMessageMock };
}

describe("buildRecentDateKeys", () => {
  test("BUGUNGI kunni EMAS, o'tgan 7 kunni qaytaradi", () => {
    const { _testables } = loadModule(buildMockDb([]));
    const now = new Date("2026-05-20T10:00:00Z").getTime();
    const keys = _testables.buildRecentDateKeys(now);
    expect(keys).toHaveLength(7);
    expect(keys).not.toContain("2026-05-20");
    expect(keys[0]).toBe("2026-05-19");
  });
});

describe("computeWeeklySummary", () => {
  test("mavjud kunlik hujjatlarni yig'adi, mavjud bo'lmaganlarni 0 deb hisoblaydi", async () => {
    const now = new Date("2026-05-20T10:00:00Z").getTime();
    const sellerDoc = makeSellerDoc("s1", {}, {
      "2026-05-19": { revenue: 100_000, cogs: 40_000, deliveredCount: 2, newCustomersCount: 1 },
      "2026-05-17": { revenue: 50_000, cogs: 20_000, deliveredCount: 1, newCustomersCount: 0 },
      // qolgan 5 kun - hujjat yo'q (aralashmagan).
    });
    const db = buildMockDb([sellerDoc]);
    const { _testables } = loadModule(db);
    const summary = await _testables.computeWeeklySummary("s1", now);
    expect(summary).toEqual({ revenue: 150_000, cogs: 60_000, deliveredCount: 3, newCustomersCount: 1 });
  });
});

describe("buildReportText", () => {
  test("tushum/foyda/o'rtacha chekni to'g'ri formatlaydi", () => {
    const { _testables } = loadModule(buildMockDb([]));
    const text = _testables.buildReportText(
      { storeName: "Mening Do'konim" },
      { revenue: 200_000, cogs: 80_000, deliveredCount: 4, newCustomersCount: 2 }
    );
    expect(text).toContain("Mening Do'konim");
    expect(text).toContain(`${(200_000).toLocaleString()} so'm`);
    expect(text).toContain(`${(120_000).toLocaleString()} so'm`); // sof foyda = 200000-80000
    expect(text).toContain(`${(50_000).toLocaleString()} so'm`); // AOV = 200000/4
    expect(text).toContain("4 ta");
    expect(text).toContain("2 ta");
  });
});

describe("processSellerWeeklyReport / sendWeeklyBusinessReports", () => {
  test("Biznes tarifida BO'LMAGAN sotuvchiga hisobot yubormaydi", async () => {
    const sellerDoc = makeSellerDoc("s1", { tariffPlan: "pro", status: "active" }, {
      "2026-05-19": { revenue: 100_000, cogs: 40_000, deliveredCount: 2, newCustomersCount: 1 },
    });
    const db = buildMockDb([sellerDoc]);
    const { sendWeeklyBusinessReports, __sendTelegramMessageMock } = loadModule(db);
    await sendWeeklyBusinessReports();
    expect(__sendTelegramMessageMock).not.toHaveBeenCalled();
  });

  test("weeklyReportEnabled: false bo'lsa - Biznes bo'lsa ham yubormaydi", async () => {
    const sellerDoc = makeSellerDoc("s1", { tariffPlan: "biznes", status: "active", weeklyReportEnabled: false }, {
      "2026-05-19": { revenue: 100_000, cogs: 40_000, deliveredCount: 2, newCustomersCount: 1 },
    });
    const db = buildMockDb([sellerDoc]);
    const { sendWeeklyBusinessReports, __sendTelegramMessageMock } = loadModule(db);
    await sendWeeklyBusinessReports();
    expect(__sendTelegramMessageMock).not.toHaveBeenCalled();
  });

  test("bo'sh hafta (faoliyat yo'q) bo'lsa - ortiqcha xabar yubormaydi", async () => {
    const sellerDoc = makeSellerDoc("s1", { tariffPlan: "biznes", status: "active" }, {});
    const db = buildMockDb([sellerDoc]);
    const { sendWeeklyBusinessReports, __sendTelegramMessageMock } = loadModule(db);
    await sendWeeklyBusinessReports();
    expect(__sendTelegramMessageMock).not.toHaveBeenCalled();
  });

  test("Biznes sotuvchi, standart (belgilanmagan) holatda YOQILGAN - haqiqiy faoliyat bo'lsa hisobot yuboradi", async () => {
    // `sendWeeklyBusinessReports` haqiqiy `Date.now()`dan foydalanadi -
    // shuning uchun rollup hujjati "kecha"gi HAQIQIY sanaga (nisbiy)
    // yozilishi kerak, qattiq kodlangan sanaga emas.
    const { _testables: dateHelpers } = loadModule(buildMockDb([]));
    const yesterdayKey = dateHelpers.buildRecentDateKeys(Date.now())[0];
    const sellerDoc = makeSellerDoc("s1", { tariffPlan: "biznes", status: "active", storeName: "Test Do'kon" }, {
      [yesterdayKey]: { revenue: 100_000, cogs: 40_000, deliveredCount: 2, newCustomersCount: 1 },
    });
    const db = buildMockDb([sellerDoc]);
    const { sendWeeklyBusinessReports, __sendTelegramMessageMock } = loadModule(db);
    await sendWeeklyBusinessReports();
    expect(__sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    const [token, chatId, text] = __sendTelegramMessageMock.mock.calls[0];
    expect(token).toBe("platform-token");
    expect(chatId).toBe("s1");
    expect(text).toContain("Test Do'kon");
  });

  test("Z-Biznes SINOVIDA (faol trial) bo'lgan Z-Pro sotuvchi ham hisobot oladi", async () => {
    const farFuture = Date.now() + 5 * DAY_MS;
    const { _testables: dateHelpers } = loadModule(buildMockDb([]));
    const yesterdayKey = dateHelpers.buildRecentDateKeys(Date.now())[0];
    const sellerDoc = makeSellerDoc(
      "s1",
      { tariffPlan: "pro", status: "active", tariffTrialActive: true, tariffTrialPlan: "biznes", tariffTrialExpiresAt: { toMillis: () => farFuture } },
      { [yesterdayKey]: { revenue: 10_000, cogs: 2_000, deliveredCount: 1, newCustomersCount: 0 } }
    );
    const db = buildMockDb([sellerDoc]);
    const { sendWeeklyBusinessReports, __sendTelegramMessageMock } = loadModule(db);
    await sendWeeklyBusinessReports();
    expect(__sendTelegramMessageMock).toHaveBeenCalledTimes(1);
  });
});
