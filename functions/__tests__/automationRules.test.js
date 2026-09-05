/**
 * `automationRules.js` — ADVANCED AUTOMATION (Z-Biznes, 2026-09
 * punkt-royxati, 5-band): sotuvchi o'zi quradigan WHEN->IF->THEN
 * qoidalar mexanizmi uchun testlar.
 */

function makeQueryable(docs) {
  const compare = (v, op, target) => {
    switch (op) {
      case "==":
        return v === target;
      case "<":
        return v < target;
      case "<=":
        return v <= target;
      case ">":
        return v > target;
      case ">=":
        return v >= target;
      case "in":
        return Array.isArray(target) && target.includes(v);
      default:
        throw new Error(`Testda qo'llab-quvvatlanmaydigan operator: ${op}`);
    }
  };
  return {
    where: (field, op, value) => makeQueryable(docs.filter((d) => compare(d[field], op, value))),
    orderBy: (field, dir = "asc") =>
      makeQueryable([...docs].sort((a, b) => (dir === "desc" ? b[field] - a[field] : a[field] - b[field]))),
    limit: (n) => makeQueryable(docs.slice(0, n)),
    get: async () => ({ empty: docs.length === 0, size: docs.length, docs: docs.map((d) => ({ id: d.id, data: () => d })) }),
  };
}

/** Bitta avtomatlashtirish qoidasi uchun to'liq mock hujjat (`.ref` bilan) yasaydi. */
function makeRuleDoc(rule, firedForSeed = {}) {
  const firedForStore = new Map(Object.entries(firedForSeed));
  const statsSets = [];
  const ref = {
    __ruleId: rule.id,
    collection: (name) => {
      if (name !== "firedFor") throw new Error(`Kutilmagan quyi kolleksiya: ${name}`);
      return {
        doc: (entityId) => ({
          __entityId: entityId,
          __store: firedForStore,
          get: async () => (firedForStore.has(entityId) ? { exists: true, data: () => firedForStore.get(entityId) } : { exists: false }),
        }),
      };
    },
    set: async (data, opts) => { statsSets.push({ data, opts }); },
  };
  return { id: rule.id, data: () => rule, ref, __statsSets: statsSets, __firedForStore: firedForStore };
}

function makeRuleDocsQueryable(ruleDocsList) {
  return {
    where: (field, op, value) => {
      if (op !== "==") throw new Error(`Testda qo'llab-quvvatlanmaydigan operator: ${op}`);
      return makeRuleDocsQueryable(ruleDocsList.filter((rd) => rd.data()[field] === value));
    },
    limit: (n) => makeRuleDocsQueryable(ruleDocsList.slice(0, n)),
    get: async () => ({ empty: ruleDocsList.length === 0, docs: ruleDocsList }),
  };
}

function buildMockDb({ sellerData = {}, customers = [], orders = [], products = [], ruleDocs = [] } = {}) {
  const batchWrites = [];
  return {
    collection: (name) => {
      if (name === "sellers") {
        return {
          doc: () => ({
            get: async () => ({ exists: true, data: () => sellerData }),
            collection: (subName) => {
              if (subName === "customers") return makeQueryable(customers);
              if (subName === "automationRules") return makeRuleDocsQueryable(ruleDocs);
              throw new Error(`Kutilmagan quyi kolleksiya: ${subName}`);
            },
          }),
        };
      }
      if (name === "orders") return makeQueryable(orders);
      if (name === "products") return makeQueryable(products);
      throw new Error(`Kutilmagan kolleksiya: ${name}`);
    },
    batch: () => {
      const writes = [];
      return {
        set: (ref, data, opts) => writes.push({ ref, data, opts }),
        commit: async () => {
          writes.forEach((w) => {
            batchWrites.push(w);
            if (w.ref && w.ref.__store) w.ref.__store.set(w.ref.__entityId, w.data);
          });
        },
      };
    },
    __batchWrites: batchWrites,
  };
}

function loadModule(db, { sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true }), getSellerCustomBotTokenMock = jest.fn().mockResolvedValue(null), sendCustomerNotificationMock = jest.fn().mockResolvedValue({ ok: true }) } = {}) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: { firestore: { FieldValue: { increment: (amount) => ({ __op: "increment", amount }) } } },
    db,
    BOT_TOKEN: { value: () => "mock-bot-token" },
  }));
  jest.doMock("../lib/helpers", () => ({
    sendTelegramMessage: sendTelegramMessageMock,
    buildSellerAppLink: (path) => `https://commerce-zelo.web.app${path}`,
  }));
  jest.doMock("../lib/customerNotify", () => ({
    getSellerCustomBotToken: getSellerCustomBotTokenMock,
    sendCustomerNotification: sendCustomerNotificationMock,
  }));
  jest.doMock("../lib/dailyStats", () => ({ incrementDailyStat: jest.fn().mockResolvedValue(undefined) }));
  jest.doMock("../lib/sentry", () => ({
    withSentry: (fn) => fn,
    SENTRY_DSN: { value: () => null },
    Sentry: { captureException: jest.fn() },
    initSentry: jest.fn(),
  }));
  return require("../automationRules");
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const NOW = Date.now();

describe("personalizeMessage", () => {
  test("'{ism}'ni mijozning BIRINCHI ismi bilan almashtiradi", () => {
    const { _testables } = loadModule(buildMockDb());
    expect(_testables.personalizeMessage("Salom, {ism}!", "Vali Aliyev")).toBe("Salom, Vali!");
  });

  test("ism bo'lmasa - xushmuomala umumiy murojaat bilan almashtiradi", () => {
    const { _testables } = loadModule(buildMockDb());
    expect(_testables.personalizeMessage("Salom, {ism}!", "")).toBe("Salom, Hurmatli mijoz!");
  });

  test("shablon bo'sh bo'lsa - xato tashlamaydi, bo'sh qator qaytaradi", () => {
    const { _testables } = loadModule(buildMockDb());
    expect(_testables.personalizeMessage(null, "Ali")).toBe("");
  });
});

describe("cooldownMsForRule", () => {
  test("customer_inactive - trigger'ning O'ZIDAGI kunlar sonini ms'ga aylantiradi", () => {
    const { _testables } = loadModule(buildMockDb());
    expect(_testables.cooldownMsForRule({ triggerType: "customer_inactive", triggerParams: { days: 45 } })).toBe(45 * DAY_MS);
  });

  test("low_stock - doim 7 kun (sozlanmaydigan)", () => {
    const { _testables } = loadModule(buildMockDb());
    expect(_testables.cooldownMsForRule({ triggerType: "low_stock", triggerParams: {} })).toBe(7 * DAY_MS);
  });

  test("order_undelivered - CHEKSIZ (bitta buyurtma uchun bir marta)", () => {
    const { _testables } = loadModule(buildMockDb());
    expect(_testables.cooldownMsForRule({ triggerType: "order_undelivered", triggerParams: {} })).toBe(Infinity);
  });
});

describe("findCustomerInactiveMatches", () => {
  test("FAQAT cutoffdan OLDIN xarid qilgan mijozlarni qaytaradi", async () => {
    const customers = [
      { id: "c1", ltv: 10_000, lastOrderAtMs: NOW - 40 * DAY_MS },
      { id: "c2", ltv: 10_000, lastOrderAtMs: NOW - 5 * DAY_MS },
    ];
    const { _testables } = loadModule(buildMockDb({ customers }));
    const result = await _testables.findCustomerInactiveMatches("seller-1", { days: 30 });
    expect(result.map((m) => m.entityId)).toEqual(["c1"]);
  });

  test("segment: 'vip' berilsa - FAQAT VIP chegarasidan yuqori LTV'ga ega mijozlar qoladi", async () => {
    const customers = [
      { id: "c1", ltv: 600_000, lastOrderAtMs: NOW - 40 * DAY_MS },
      { id: "c2", ltv: 10_000, lastOrderAtMs: NOW - 40 * DAY_MS },
    ];
    const { _testables } = loadModule(buildMockDb({ customers }));
    const result = await _testables.findCustomerInactiveMatches("seller-1", { days: 30, segment: "vip" });
    expect(result.map((m) => m.entityId)).toEqual(["c1"]);
  });
});

describe("findOrderUndeliveredMatches", () => {
  test("FAQAT ochiq holatdagi VA chegaradan eski buyurtmalarni qaytaradi", async () => {
    const orders = [
      { id: "o1", sellerId: "seller-1", status: "new", totalAmount: 50_000, createdAt: { toMillis: () => NOW - 4 * DAY_MS } },
      { id: "o2", sellerId: "seller-1", status: "new", totalAmount: 50_000, createdAt: { toMillis: () => NOW - 1 * HOUR_MS } }, // hali yangi
      { id: "o3", sellerId: "seller-1", status: "delivered", totalAmount: 50_000, createdAt: { toMillis: () => NOW - 4 * DAY_MS } }, // yopilgan
      { id: "o4", sellerId: "seller-2", status: "new", totalAmount: 50_000, createdAt: { toMillis: () => NOW - 4 * DAY_MS } }, // boshqa sotuvchi
    ];
    const { _testables } = loadModule(buildMockDb({ orders }));
    const result = await _testables.findOrderUndeliveredMatches("seller-1", { hours: 72 });
    expect(result.map((m) => m.entityId)).toEqual(["o1"]);
  });
});

describe("findLowStockMatches", () => {
  test("FAQAT 0dan katta VA chegaradan kam/teng zaxirali mahsulotlarni qaytaradi", async () => {
    const products = [
      { id: "p1", sellerId: "seller-1", name: "Krem", stock: 3 },
      { id: "p2", sellerId: "seller-1", name: "Sovun", stock: 20 },
      { id: "p3", sellerId: "seller-1", name: "Tugagan", stock: 0 },
    ];
    const { _testables } = loadModule(buildMockDb({ products }));
    const result = await _testables.findLowStockMatches("seller-1", { threshold: 5 });
    expect(result.map((m) => m.entityId)).toEqual(["p1"]);
  });
});

describe("filterDueMatches / markFired", () => {
  test("hech qachon ishga tushmagan (firedFor yozuvi yo'q) nomzod - HAR DOIM 'due'", async () => {
    const { _testables } = loadModule(buildMockDb());
    const ruleDoc = makeRuleDoc({ id: "r1", triggerType: "low_stock", triggerParams: {} });
    const due = await _testables.filterDueMatches(ruleDoc.ref, ruleDoc.data(), [{ entityId: "p1" }]);
    expect(due).toHaveLength(1);
  });

  test("cooldown ICHIDA (yaqinda ishga tushgan) nomzod - chetlab o'tiladi", async () => {
    const { _testables } = loadModule(buildMockDb());
    const ruleDoc = makeRuleDoc(
      { id: "r1", triggerType: "low_stock", triggerParams: {} },
      { p1: { firedAtMs: NOW - 2 * DAY_MS } } // 7 kunlik cooldown ichida
    );
    const due = await _testables.filterDueMatches(ruleDoc.ref, ruleDoc.data(), [{ entityId: "p1" }]);
    expect(due).toHaveLength(0);
  });

  test("cooldown TUGAGAN nomzod - QAYTA 'due' bo'ladi", async () => {
    const { _testables } = loadModule(buildMockDb());
    const ruleDoc = makeRuleDoc(
      { id: "r1", triggerType: "low_stock", triggerParams: {} },
      { p1: { firedAtMs: NOW - 10 * DAY_MS } } // 7 kunlik cooldowndan OSHGAN
    );
    const due = await _testables.filterDueMatches(ruleDoc.ref, ruleDoc.data(), [{ entityId: "p1" }]);
    expect(due).toHaveLength(1);
  });

  test("markFired - firedFor'ga yozadi, keyingi filterDueMatches'da ko'rinadi", async () => {
    const db = buildMockDb();
    const { _testables } = loadModule(db);
    const ruleDoc = makeRuleDoc({ id: "r1", triggerType: "low_stock", triggerParams: {} });
    await _testables.markFired(ruleDoc.ref, ["p1"]);
    expect(ruleDoc.__firedForStore.has("p1")).toBe(true);

    const due = await _testables.filterDueMatches(ruleDoc.ref, ruleDoc.data(), [{ entityId: "p1" }]);
    expect(due).toHaveLength(0); // hozirgina yozilgani uchun cooldown ichida
  });
});

describe("runNotifyCustomerAction", () => {
  test("HAR BIR mos mijozga shaxsiy, moslashtirilgan xabar yuboradi", async () => {
    const sendCustomerNotificationMock = jest.fn().mockResolvedValue({ ok: true });
    const { _testables } = loadModule(buildMockDb(), { sendCustomerNotificationMock });
    const rule = { actionParams: { message: "Salom, {ism}! Qaytib keling." } };
    const matches = [{ entityId: "c1", clientId: "c1", fullName: "Vali Aliyev" }];
    const result = await _testables.runNotifyCustomerAction("seller-1", rule, matches);

    expect(sendCustomerNotificationMock).toHaveBeenCalledWith(null, "c1", "Salom, Vali! Qaytib keling.");
    expect(result.firedEntityIds).toEqual(["c1"]);
    expect(result.sentCount).toBe(1);
  });

  test("MAX_CUSTOMER_MESSAGES_PER_RULE_RUN chegarasidan oshmaydi", async () => {
    const sendCustomerNotificationMock = jest.fn().mockResolvedValue({ ok: true });
    const { _testables } = loadModule(buildMockDb(), { sendCustomerNotificationMock });
    const matches = Array.from({ length: 60 }, (_, i) => ({ entityId: `c${i}`, clientId: `c${i}`, fullName: "Ali" }));
    const result = await _testables.runNotifyCustomerAction("seller-1", { actionParams: {} }, matches);
    expect(result.sentCount).toBe(50);
  });

  test("bitta mijozga yuborish XATO bersa - qolganlari davom etadi, faqat MUVAFFAQIYATLILARI firedEntityIds'da", async () => {
    const sendCustomerNotificationMock = jest.fn()
      .mockRejectedValueOnce(new Error("chat not found"))
      .mockResolvedValue({ ok: true });
    const { _testables } = loadModule(buildMockDb(), { sendCustomerNotificationMock });
    const matches = [{ entityId: "c1", clientId: "c1", fullName: "Ali" }, { entityId: "c2", clientId: "c2", fullName: "Vali" }];
    const result = await _testables.runNotifyCustomerAction("seller-1", { actionParams: {} }, matches);
    expect(result.firedEntityIds).toEqual(["c2"]);
    expect(result.sentCount).toBe(1);
  });
});

describe("runAlertManagerAction", () => {
  test("low_stock uchun mahsulot+zaxira ro'yxati bilan jamlangan xabar yuboradi", async () => {
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const { _testables } = loadModule(buildMockDb(), { sendTelegramMessageMock });
    const rule = { name: "Kam zaxira", triggerType: "low_stock", actionParams: {} };
    const matches = [{ entityId: "p1", name: "Krem", stock: 3 }];
    const result = await _testables.runAlertManagerAction("seller-1", rule, matches, "token");

    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    const [token, chatId, text] = sendTelegramMessageMock.mock.calls[0];
    expect(token).toBe("token");
    expect(chatId).toBe("seller-1");
    expect(text).toContain("Krem");
    expect(text).toContain("3 dona");
    expect(result.firedEntityIds).toEqual(["p1"]);
  });

  test("10dan ortiq nomzod bo'lsa - 'va yana N ta' bilan qisqartiradi", async () => {
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const { _testables } = loadModule(buildMockDb(), { sendTelegramMessageMock });
    const matches = Array.from({ length: 15 }, (_, i) => ({ entityId: `p${i}`, name: `Mahsulot ${i}`, stock: 1 }));
    await _testables.runAlertManagerAction("seller-1", { name: "Q", triggerType: "low_stock", actionParams: {} }, matches, "token");
    const text = sendTelegramMessageMock.mock.calls[0][2];
    expect(text).toContain("va yana 5 ta");
  });
});

describe("processAutomationRule", () => {
  test("isActive: false bo'lsa - hech narsa qilmaydi", async () => {
    const sendTelegramMessageMock = jest.fn();
    const { _testables } = loadModule(buildMockDb({ products: [{ id: "p1", sellerId: "s1", stock: 1 }] }), { sendTelegramMessageMock });
    const ruleDoc = makeRuleDoc({ id: "r1", isActive: false, triggerType: "low_stock", actionType: "alert_manager", triggerParams: {} });
    await _testables.processAutomationRule("s1", ruleDoc, "token");
    expect(sendTelegramMessageMock).not.toHaveBeenCalled();
  });

  test("notify_customer_telegram FAQAT customer_inactive bilan mos - noto'g'ri kombinatsiya JIM o'tkazib yuboriladi", async () => {
    const sendCustomerNotificationMock = jest.fn();
    const products = [{ id: "p1", sellerId: "s1", stock: 1 }];
    const { _testables } = loadModule(buildMockDb({ products }), { sendCustomerNotificationMock });
    const ruleDoc = makeRuleDoc({ id: "r1", isActive: true, triggerType: "low_stock", actionType: "notify_customer_telegram", triggerParams: {}, actionParams: {} });
    await _testables.processAutomationRule("s1", ruleDoc, "token");
    expect(sendCustomerNotificationMock).not.toHaveBeenCalled();
  });

  test("mos nomzod bo'lmasa - hech narsa yubormaydi, stats yangilanmaydi", async () => {
    const sendTelegramMessageMock = jest.fn();
    const { _testables } = loadModule(buildMockDb({ products: [] }), { sendTelegramMessageMock });
    const ruleDoc = makeRuleDoc({ id: "r1", isActive: true, triggerType: "low_stock", actionType: "alert_manager", triggerParams: { threshold: 5 }, actionParams: {} });
    await _testables.processAutomationRule("s1", ruleDoc, "token");
    expect(sendTelegramMessageMock).not.toHaveBeenCalled();
    expect(ruleDoc.__statsSets).toHaveLength(0);
  });

  test("TO'LIQ muvaffaqiyatli oqim: nomzod topiladi -> xabar yuboriladi -> firedFor yoziladi -> stats oshadi", async () => {
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const products = [{ id: "p1", sellerId: "s1", name: "Krem", stock: 2 }];
    const { _testables } = loadModule(buildMockDb({ products }), { sendTelegramMessageMock });
    const ruleDoc = makeRuleDoc({ id: "r1", name: "Kam zaxira", isActive: true, triggerType: "low_stock", actionType: "alert_manager", triggerParams: { threshold: 5 }, actionParams: {} });
    await _testables.processAutomationRule("s1", ruleDoc, "token");

    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    expect(ruleDoc.__firedForStore.has("p1")).toBe(true);
    expect(ruleDoc.__statsSets).toHaveLength(1);
    expect(ruleDoc.__statsSets[0].data.stats.firedCount).toEqual({ __op: "increment", amount: 1 });
  });

  test("cooldown ICHIDAGI nomzod - qayta xabar yubormaydi", async () => {
    const sendTelegramMessageMock = jest.fn();
    const products = [{ id: "p1", sellerId: "s1", name: "Krem", stock: 2 }];
    const { _testables } = loadModule(buildMockDb({ products }), { sendTelegramMessageMock });
    const ruleDoc = makeRuleDoc(
      { id: "r1", isActive: true, triggerType: "low_stock", actionType: "alert_manager", triggerParams: { threshold: 5 }, actionParams: {} },
      { p1: { firedAtMs: NOW - 1 * DAY_MS } }
    );
    await _testables.processAutomationRule("s1", ruleDoc, "token");
    expect(sendTelegramMessageMock).not.toHaveBeenCalled();
  });
});

describe("processSellerAutomationRules", () => {
  test("sotuvchi Biznes tarifida BO'LMASA - hech qanday qoida tekshirilmaydi (eski/pasaytirilgan tarif himoyasi)", async () => {
    const sendTelegramMessageMock = jest.fn();
    const rule = makeRuleDoc({ id: "r1", isActive: true, triggerType: "low_stock", actionType: "alert_manager", triggerParams: { threshold: 5 }, actionParams: {} });
    const db = buildMockDb({ sellerData: { tariffPlan: "pro" }, products: [{ id: "p1", sellerId: "s1", stock: 1 }], ruleDocs: [rule] });
    const { _testables } = loadModule(db, { sendTelegramMessageMock });
    await _testables.processSellerAutomationRules({ id: "s1", data: () => ({ tariffPlan: "pro" }) }, "token");
    expect(sendTelegramMessageMock).not.toHaveBeenCalled();
  });

  test("Biznes tarifida bo'lsa - FAQAT isActive:true qoidalar ishga tushiriladi", async () => {
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const activeRule = makeRuleDoc({ id: "r1", isActive: true, triggerType: "low_stock", actionType: "alert_manager", triggerParams: { threshold: 5 }, actionParams: {} });
    const products = [{ id: "p1", sellerId: "s1", name: "Krem", stock: 1 }];
    const db = buildMockDb({ sellerData: { tariffPlan: "biznes" }, products, ruleDocs: [activeRule] });
    const { _testables } = loadModule(db, { sendTelegramMessageMock });
    await _testables.processSellerAutomationRules({ id: "s1", data: () => ({ tariffPlan: "biznes" }) }, "token");
    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
  });

  test("bitta qoida XATO tashlasa - qolgan qoidalar BARIBIR ishga tushadi", async () => {
    const sendTelegramMessageMock = jest.fn().mockResolvedValue({ ok: true });
    // r1 - low_stock, lekin `findLowStockMatches` mahsulot topa olmagani uchun xato tashlamaydi;
    // xatoni simulyatsiya qilish uchun triggerType'ni ATAYLAB yaroqsiz qilamiz - `finder` topilmay, TypeError yuz beradi.
    const badRule = makeRuleDoc({ id: "r-bad", isActive: true, triggerType: "unknown_trigger_type", actionType: "alert_manager", triggerParams: {}, actionParams: {} });
    const goodRule = makeRuleDoc({ id: "r-good", isActive: true, triggerType: "low_stock", actionType: "alert_manager", triggerParams: { threshold: 5 }, actionParams: {} });
    const products = [{ id: "p1", sellerId: "s1", name: "Krem", stock: 1 }];
    const db = buildMockDb({ sellerData: { tariffPlan: "biznes" }, products, ruleDocs: [badRule, goodRule] });
    const { _testables } = loadModule(db, { sendTelegramMessageMock });
    await _testables.processSellerAutomationRules({ id: "s1", data: () => ({ tariffPlan: "biznes" }) }, "token");
    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
  });
});

describe("handleAutomationRuleWrite (automationRuleActiveCount hisoblagichi)", () => {
  function makeEvent({ before, after, sellerId = "s1", ruleId = "r1" }) {
    return {
      params: { sellerId, ruleId },
      data: {
        before: before ? { exists: true, data: () => before } : { exists: false },
        after: after ? { exists: true, data: () => after } : { exists: false },
      },
    };
  }

  test("YANGI FAOL qoida yaratilsa - hisoblagich +1", async () => {
    const sellerSets = [];
    const db = { collection: () => ({ doc: () => ({ set: async (data, opts) => sellerSets.push({ data, opts }) }) }) };
    const { _testables } = loadModule(db);
    await _testables.handleAutomationRuleWrite(makeEvent({ before: null, after: { isActive: true } }));
    expect(sellerSets).toHaveLength(1);
    expect(sellerSets[0].data.automationRuleActiveCount).toEqual({ __op: "increment", amount: 1 });
  });

  test("YANGI NOFAOL (isActive:false) qoida yaratilsa - hisoblagichga TEGMAYDI", async () => {
    const sellerSets = [];
    const db = { collection: () => ({ doc: () => ({ set: async (data, opts) => sellerSets.push({ data, opts }) }) }) };
    const { _testables } = loadModule(db);
    await _testables.handleAutomationRuleWrite(makeEvent({ before: null, after: { isActive: false } }));
    expect(sellerSets).toHaveLength(0);
  });

  test("FAOL qoida FAOLSIZLANTIRILSA - hisoblagich -1", async () => {
    const sellerSets = [];
    const db = { collection: () => ({ doc: () => ({ set: async (data, opts) => sellerSets.push({ data, opts }) }) }) };
    const { _testables } = loadModule(db);
    await _testables.handleAutomationRuleWrite(makeEvent({ before: { isActive: true }, after: { isActive: false } }));
    expect(sellerSets[0].data.automationRuleActiveCount).toEqual({ __op: "increment", amount: -1 });
  });

  test("FAOL qoida O'CHIRILSA - hisoblagich -1", async () => {
    const sellerSets = [];
    const db = { collection: () => ({ doc: () => ({ set: async (data, opts) => sellerSets.push({ data, opts }) }) }) };
    const { _testables } = loadModule(db);
    await _testables.handleAutomationRuleWrite(makeEvent({ before: { isActive: true }, after: null }));
    expect(sellerSets[0].data.automationRuleActiveCount).toEqual({ __op: "increment", amount: -1 });
  });

  test("FAOL EMAS holat o'zgarmasa (masalan faqat nom tahrirlansa) - hisoblagichga TEGMAYDI", async () => {
    const sellerSets = [];
    const db = { collection: () => ({ doc: () => ({ set: async (data, opts) => sellerSets.push({ data, opts }) }) }) };
    const { _testables } = loadModule(db);
    await _testables.handleAutomationRuleWrite(makeEvent({ before: { isActive: true, name: "Eski" }, after: { isActive: true, name: "Yangi" } }));
    expect(sellerSets).toHaveLength(0);
  });
});
