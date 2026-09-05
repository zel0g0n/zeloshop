const {
  DEFAULT_EXPIRY_MS,
  createPendingAction,
  approveAction,
  rejectAction,
  loadResolvableAction,
} = require("../../lib/aiApprovalEngine");
const { ACTION_STATES } = require("../../lib/aiActionStateMachine");
const { ActionValidationError } = require("../../lib/aiActionRegistry");

function buildMockDb() {
  const pendingActions = {};
  const auditLogs = [];
  const admin = { firestore: { FieldValue: { serverTimestamp: () => "MOCK_TS" } } };
  const db = {
    collection(name) {
      if (name !== "sellers") throw new Error(`kutilmagan kolleksiya: ${name}`);
      return {
        doc(sellerId) {
          return {
            collection(subName) {
              if (subName === "aiCeoPendingActions") {
                return {
                  doc(actionId) {
                    const key = `${sellerId}/${actionId}`;
                    return {
                      get: async () => (pendingActions[key] ? { exists: true, data: () => ({ ...pendingActions[key] }) } : { exists: false }),
                      set: async (data) => { pendingActions[key] = { ...data }; },
                      update: async (data) => { pendingActions[key] = { ...pendingActions[key], ...data }; },
                    };
                  },
                };
              }
              if (subName === "aiAuditLog") {
                return { add: async (data) => { auditLogs.push({ sellerId, ...data }); } };
              }
              throw new Error(`kutilmagan quyi kolleksiya: ${subName}`);
            },
          };
        },
      };
    },
  };
  return { db, admin, pendingActions, auditLogs };
}

function validCrmPayload(overrides = {}) {
  return {
    segment: "vip", title: "Sarlavha", message: "Xabar matni",
    targetClientIds: ["c1", "c2"], dateId: "2026-08-23", ...overrides,
  };
}

describe("createPendingAction", () => {
  test("crmCampaign - yangi WAITING_APPROVAL harakat yaratadi, eski `status` maydonini ham to'ldiradi", async () => {
    const { db, admin, pendingActions, auditLogs } = buildMockDb();
    const result = await createPendingAction(db, admin, { sellerId: "s1", actionType: "crmCampaign", payload: validCrmPayload() });

    expect(result.isNew).toBe(true);
    expect(result.riskLevel).toBe("MEDIUM");
    expect(result.state).toBe(ACTION_STATES.WAITING_APPROVAL);
    expect(result.requiresApproval).toBe(true);
    expect(result.actionId).toBe("crm_vip_2026-08-23");
    expect(result.expiresAtMs).toBeGreaterThan(Date.now());
    expect(result.expiresAtMs).toBeLessThanOrEqual(Date.now() + DEFAULT_EXPIRY_MS + 1000);

    const stored = pendingActions["s1/crm_vip_2026-08-23"];
    expect(stored.status).toBe("pending"); // orqaga mos
    expect(stored.state).toBe(ACTION_STATES.WAITING_APPROVAL);
    expect(stored.targetClientIds).toEqual(["c1", "c2"]);
    expect(stored.payloadHash).toHaveLength(64);
    expect(auditLogs.length).toBe(1);
  });

  test("BIR XIL idempotensiya kaliti bilan qayta chaqirilsa - DUBLIKAT yaratmaydi", async () => {
    const { db, admin, pendingActions } = buildMockDb();
    await createPendingAction(db, admin, { sellerId: "s1", actionType: "crmCampaign", payload: validCrmPayload() });
    const result2 = await createPendingAction(db, admin, { sellerId: "s1", actionType: "crmCampaign", payload: validCrmPayload() });

    expect(result2.isNew).toBe(false);
    expect(Object.keys(pendingActions).length).toBe(1);
  });

  test("noma'lum actionType yoki noto'g'ri sxema uchun xato tashlaydi (hujjat YOZILMAYDI)", async () => {
    const { db, admin, pendingActions } = buildMockDb();
    await expect(createPendingAction(db, admin, { sellerId: "s1", actionType: "noMaLum", payload: {} })).rejects.toThrow(ActionValidationError);
    await expect(createPendingAction(db, admin, { sellerId: "s1", actionType: "crmCampaign", payload: { segment: "noto'g'ri" } })).rejects.toThrow(ActionValidationError);
    expect(Object.keys(pendingActions).length).toBe(0);
  });

  test("sellerId berilmasa xato tashlaydi", async () => {
    const { db, admin } = buildMockDb();
    await expect(createPendingAction(db, admin, { actionType: "crmCampaign", payload: validCrmPayload() })).rejects.toThrow();
  });
});

describe("loadResolvableAction", () => {
  test("mavjud bo'lmagan harakat uchun not_found", async () => {
    const { db, admin } = buildMockDb();
    const result = await loadResolvableAction(db, admin, { sellerId: "s1", actionId: "yoq" });
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  test("allaqachon hal qilingan (WAITING_APPROVAL emas) harakat uchun not_pending", async () => {
    const { db, admin } = buildMockDb();
    await createPendingAction(db, admin, { sellerId: "s1", actionType: "crmCampaign", payload: validCrmPayload() });
    await approveAction(db, admin, { sellerId: "s1", actionId: "crm_vip_2026-08-23", approvedBy: "s1", executors: { crmCampaign: async () => ({ sent: 1, total: 1 }) } });

    const result = await loadResolvableAction(db, admin, { sellerId: "s1", actionId: "crm_vip_2026-08-23" });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("not_pending");
  });

  test("muddati o'tgan harakatni LAZY tarzda EXPIRED holatiga o'tkazadi", async () => {
    const { db, admin, pendingActions, auditLogs } = buildMockDb();
    await createPendingAction(db, admin, { sellerId: "s1", actionType: "crmCampaign", payload: validCrmPayload() });
    // Muddatni sun'iy ravishda o'tib ketgan qilib qo'yamiz.
    pendingActions["s1/crm_vip_2026-08-23"].expiresAtMs = Date.now() - 1000;

    const result = await loadResolvableAction(db, admin, { sellerId: "s1", actionId: "crm_vip_2026-08-23" });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("expired");
    expect(pendingActions["s1/crm_vip_2026-08-23"].state).toBe(ACTION_STATES.EXPIRED);
    expect(pendingActions["s1/crm_vip_2026-08-23"].status).toBe("expired");
    expect(auditLogs.some((l) => l.newState === ACTION_STATES.EXPIRED)).toBe(true);
  });
});

describe("approveAction", () => {
  test("mavjud executor bilan MUVAFFAQIYATLI ijro etadi, COMPLETED holatiga o'tkazadi", async () => {
    const { db, admin, pendingActions, auditLogs } = buildMockDb();
    await createPendingAction(db, admin, { sellerId: "s1", actionType: "crmCampaign", payload: validCrmPayload() });
    const executor = jest.fn(async () => ({ sent: 2, total: 2 }));

    const result = await approveAction(db, admin, { sellerId: "s1", actionId: "crm_vip_2026-08-23", approvedBy: "s1", executors: { crmCampaign: executor } });

    expect(result.ok).toBe(true);
    expect(result.executed).toBe(true);
    expect(result.result).toEqual({ sent: 2, total: 2 });
    expect(executor).toHaveBeenCalledWith(expect.objectContaining({ sellerId: "s1" }));
    const stored = pendingActions["s1/crm_vip_2026-08-23"];
    expect(stored.status).toBe("executed");
    expect(stored.state).toBe(ACTION_STATES.COMPLETED);
    expect(auditLogs.some((l) => l.newState === ACTION_STATES.COMPLETED)).toBe(true);
  });

  test("actionType uchun executor RO'YXATGA OLINMAGAN bo'lsa - FAILED_FINAL, executed:false, failed:true", async () => {
    const { db, admin, pendingActions } = buildMockDb();
    await createPendingAction(db, admin, { sellerId: "s1", actionType: "crmCampaign", payload: validCrmPayload() });

    const result = await approveAction(db, admin, { sellerId: "s1", actionId: "crm_vip_2026-08-23", approvedBy: "s1", executors: {} });

    expect(result.ok).toBe(true);
    expect(result.executed).toBe(false);
    expect(result.failed).toBe(true);
    expect(typeof result.error).toBe("string");
    const stored = pendingActions["s1/crm_vip_2026-08-23"];
    expect(stored.status).toBe("failed");
    expect(stored.state).toBe(ACTION_STATES.FAILED_FINAL);
  });

  test("executor XATO tashlasa - FAILED_FINAL, xato xabari saqlanadi", async () => {
    const { db, admin, pendingActions } = buildMockDb();
    await createPendingAction(db, admin, { sellerId: "s1", actionType: "crmCampaign", payload: validCrmPayload() });
    const executor = jest.fn(async () => { throw new Error("Telegram xatosi"); });

    const result = await approveAction(db, admin, { sellerId: "s1", actionId: "crm_vip_2026-08-23", approvedBy: "s1", executors: { crmCampaign: executor } });

    expect(result.ok).toBe(true);
    expect(result.executed).toBe(false);
    expect(result.failed).toBe(true);
    expect(result.error).toBe("Telegram xatosi");
    expect(pendingActions["s1/crm_vip_2026-08-23"].state).toBe(ACTION_STATES.FAILED_FINAL);
  });

  test("mavjud bo'lmagan actionId uchun {ok:false}", async () => {
    const { db, admin } = buildMockDb();
    const result = await approveAction(db, admin, { sellerId: "s1", actionId: "yoq", approvedBy: "s1", executors: {} });
    expect(result.ok).toBe(false);
  });
});

describe("rejectAction", () => {
  test("kutilayotgan harakatni CANCELLED holatiga o'tkazadi, ijro etmaydi", async () => {
    const { db, admin, pendingActions, auditLogs } = buildMockDb();
    await createPendingAction(db, admin, { sellerId: "s1", actionType: "crmCampaign", payload: validCrmPayload() });

    const result = await rejectAction(db, admin, { sellerId: "s1", actionId: "crm_vip_2026-08-23", rejectedBy: "s1" });

    expect(result).toMatchObject({ ok: true, executed: false });
    const stored = pendingActions["s1/crm_vip_2026-08-23"];
    expect(stored.status).toBe("rejected");
    expect(stored.state).toBe(ACTION_STATES.CANCELLED);
    expect(auditLogs.some((l) => l.newState === ACTION_STATES.CANCELLED)).toBe(true);
  });

  test("mavjud bo'lmagan actionId uchun {ok:false}", async () => {
    const { db, admin } = buildMockDb();
    const result = await rejectAction(db, admin, { sellerId: "s1", actionId: "yoq", rejectedBy: "s1" });
    expect(result.ok).toBe(false);
  });
});
