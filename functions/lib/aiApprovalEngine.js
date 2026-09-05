const {
  getActionDefinition,
  validateActionPayload,
  computePayloadHash,
  computeActionId,
} = require("./aiActionRegistry");
const { getApprovalPolicy } = require("./aiRiskEngine");
const { ACTION_STATES, assertTransition, resolveCurrentState } = require("./aiActionStateMachine");
const { writeAuditLog } = require("./aiAuditLog");

/**
 * AI CEO — APPROVAL ENGINE.
 *
 * ZeloShop — AI Business Operating System master prompti (F-bo'lim,
 * "RISK LEVEL VA APPROVAL ENGINE") + G-bo'lim ("AI AUTONOMOUS ACTION
 * FLOW"): bu modul — taklif qilingan AI harakatlarini YARATISH,
 * TASDIQLASH va RAD ETISHNING yagona, markazlashtirilgan mantig'i.
 * `functions/telegramApproval.js`dagi mavjud, ISHLAB TURGAN
 * `crmCampaign` oqimi ENDI shu orqali o'tadi (orqaga mos, xatti-harakati
 * o'zgarmagan) — YANGI harakat turlari (masalan `adCampaign`) ham
 * BIR XIL, sinovdan o'tgan yo'ldan o'tadi.
 *
 * Dizayn qarori (haqiqiy qamrov): hozircha alohida background job
 * queue infratuzilmasi yo'q — barcha ijro SINXRON (bitta so'rov
 * ichida) bo'lgani uchun, tasdiqlangandan keyingi
 * APPROVED -> QUEUED -> RUNNING -> COMPLETED/FAILED zanjiri XOTIRADA
 * (`aiActionStateMachine.js` orqali) TEKSHIRILADI, lekin Firestore'ga
 * FAQAT bitta, YAKUNIY yozuv sifatida saqlanadi (ijro tezligi va
 * mavjud testlar bilan mos kelishi uchun ham). Kelajakda haqiqiy
 * queue qo'shilsa, oraliq holatlar ham alohida persistlanishi mumkin
 * bo'ladi.
 *
 * `executors` — dependency injection: bu modul HECH QANDAY aniq
 * harakat turini ("crmCampaign nima qiladi") bilmaydi — chaqiruvchi
 * tomon (`telegramApproval.js`) har bir `actionType` uchun mos ijro
 * funksiyasini beradi. Bu circular require'larning oldini oladi va
 * modulni to'liq mustaqil test qilinadigan qiladi.
 */

const DEFAULT_EXPIRY_MS = 48 * 60 * 60 * 1000; // 48 soat — sotuvchi tasdiqlashi uchun oqilona muddat

/**
 * Yangi taklif qilingan harakatni yaratadi (yoki, agar bir xil
 * idempotensiya kaliti - deterministik ID - bilan allaqachon mavjud
 * bo'lsa, MAVJUDINI qaytaradi, dublikat yaratmaydi).
 *
 * @param {object} db - Firestore instance
 * @param {object} admin - `lib/admin.js`dan `admin`
 * @param {object} params
 * @param {string} params.sellerId
 * @param {string} params.actionType - `aiActionRegistry.js`dagi ro'yxatdan
 * @param {object} params.payload - harakat turiga xos ma'lumot (segment/title/message/... )
 * @param {number} [params.expiresInMs] - standart 48 soat
 * @returns {Promise<{actionId:string, isNew:boolean, riskLevel:string, state:string, requiresApproval:boolean, expiresAtMs:number|null}>}
 */
async function createPendingAction(db, admin, { sellerId, actionType, payload, expiresInMs = DEFAULT_EXPIRY_MS }) {
  if (!sellerId) throw new Error("createPendingAction: sellerId majburiy");

  // Noma'lum action turi yoki noto'g'ri sxema bo'lsa - shu yerda XATO
  // tashlanadi (PDF E-bo'lim: "Unknown action -> reject",
  // "Invalid schema -> reject").
  const def = getActionDefinition(actionType);
  validateActionPayload(actionType, payload);

  const actionId = computeActionId(actionType, { sellerId, payload });
  const ref = db.collection("sellers").doc(sellerId).collection("aiCeoPendingActions").doc(actionId);

  // IDEMPOTENSIYA: bir xil (sotuvchi + harakat turi + nishon + kun)
  // uchun ID har doim bir xil - agar hujjat ALLAQACHON mavjud bo'lsa,
  // YANGISINI yaratmaymiz (PDF T-bo'lim: "Duplicate execution ->
  // idempotent response").
  const existingSnap = await ref.get();
  if (existingSnap.exists) {
    const existing = existingSnap.data();
    return {
      actionId,
      isNew: false,
      riskLevel: existing.riskLevel || def.classifyRisk(payload),
      state: resolveCurrentState(existing),
      requiresApproval: resolveCurrentState(existing) === ACTION_STATES.WAITING_APPROVAL,
      expiresAtMs: existing.expiresAtMs || null,
    };
  }

  const riskLevel = def.classifyRisk(payload);
  const policy = getApprovalPolicy(riskLevel, { allowAutoExecute: def.autoExecuteEligible !== false });
  const payloadHash = computePayloadHash(payload);

  // Holat mashinasi orqali - DETECTED'dan boshlab, ruxsat etilgan
  // yo'l bo'ylab - bu FAQAT xotirada tekshiriladi (yuqoridagi izohga
  // qarang), lekin noqonuniy ketma-ketlik bo'lsa shu yerda XATO
  // tashlanadi.
  let state = ACTION_STATES.DETECTED;
  state = (assertTransition(state, ACTION_STATES.ANALYZING), ACTION_STATES.ANALYZING);
  state = (assertTransition(state, ACTION_STATES.PLANNED), ACTION_STATES.PLANNED);
  const nextState = policy.autoExecuteAllowed ? ACTION_STATES.QUEUED : ACTION_STATES.WAITING_APPROVAL;
  assertTransition(state, nextState);
  state = nextState;

  const now = Date.now();
  const expiresAtMs = state === ACTION_STATES.WAITING_APPROVAL ? now + expiresInMs : null;
  // Eski (v39.14) frontend/webhook `status` maydoniga tayanadi -
  // orqaga mos bo'lishi uchun shu maydon HAM to'ldiriladi.
  const legacyStatus = state === ACTION_STATES.QUEUED ? "queued" : "pending";

  await ref.set({
    ...payload,
    type: actionType,
    actionType,
    status: legacyStatus,
    state,
    riskLevel,
    payloadHash,
    idempotencyKey: actionId,
    expiresAtMs,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await writeAuditLog(db, admin, {
    sellerId,
    who: "system",
    what: `"${def.name}" taklif qilindi (xavf darajasi: ${riskLevel})`,
    actionId,
    actionType,
    oldState: null,
    newState: state,
  });

  return { actionId, isNew: true, riskLevel, state, requiresApproval: state === ACTION_STATES.WAITING_APPROVAL, expiresAtMs };
}

/**
 * Hujjatni o'qiydi va HAL QILINISHI mumkinmi (hali tasdiq kutmoqdami,
 * muddati o'tmaganmi) tekshiradi. Muddati o'tgan bo'lsa, shu yerning
 * o'zida EXPIRED holatiga o'tkazadi (haqiqiy qamrov - alohida
 * "expire" cron/queue infratuzilmasi hozircha yo'q, shuning uchun
 * muddat FAQAT harakat HAL QILINMOQCHI bo'lganda, "lazy" tarzda
 * tekshiriladi - batafsil izoh fayl boshida).
 */
async function loadResolvableAction(db, admin, { sellerId, actionId }) {
  const ref = db.collection("sellers").doc(sellerId).collection("aiCeoPendingActions").doc(actionId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, reason: "not_found" };

  const actionDoc = snap.data();
  const currentState = resolveCurrentState(actionDoc);
  if (currentState !== ACTION_STATES.WAITING_APPROVAL) {
    return { ok: false, reason: "not_pending", actionDoc };
  }

  if (Number.isFinite(actionDoc.expiresAtMs) && Date.now() > actionDoc.expiresAtMs) {
    assertTransition(ACTION_STATES.WAITING_APPROVAL, ACTION_STATES.EXPIRED);
    await ref.update({ status: "expired", state: ACTION_STATES.EXPIRED, expiredAt: admin.firestore.FieldValue.serverTimestamp() });
    await writeAuditLog(db, admin, {
      sellerId, who: "system", what: "Taklif muddati tugagani uchun avtomatik yopildi", actionId,
      actionType: actionDoc.type || actionDoc.actionType, oldState: ACTION_STATES.WAITING_APPROVAL, newState: ACTION_STATES.EXPIRED,
    });
    return { ok: false, reason: "expired", actionDoc };
  }

  return { ok: true, ref, actionDoc };
}

/**
 * Kutilayotgan harakatni TASDIQLAYDI va DARHOL ijro etadi (yuqoridagi
 * "sinxron ijro" dizayn qaroriga qarang).
 *
 * @param {Record<string, Function>} executors - `actionType -> (ctx) => Promise<object>`
 *   Har bir executor `{sellerId, payload, actionDoc}` bilan chaqiriladi
 *   va ijro natijasini (masalan `{sent, total}`) qaytarishi kerak.
 */
async function approveAction(db, admin, { sellerId, actionId, approvedBy, executors = {} }) {
  const loaded = await loadResolvableAction(db, admin, { sellerId, actionId });
  if (!loaded.ok) return loaded;
  const { ref, actionDoc } = loaded;
  const actionType = actionDoc.type || actionDoc.actionType || "crmCampaign";

  assertTransition(ACTION_STATES.WAITING_APPROVAL, ACTION_STATES.APPROVED);
  assertTransition(ACTION_STATES.APPROVED, ACTION_STATES.QUEUED);
  assertTransition(ACTION_STATES.QUEUED, ACTION_STATES.RUNNING);

  const executor = executors[actionType];
  if (!executor) {
    assertTransition(ACTION_STATES.RUNNING, ACTION_STATES.FAILED);
    assertTransition(ACTION_STATES.FAILED, ACTION_STATES.FAILED_FINAL);
    const error = `"${actionType}" uchun ijro funksiyasi ro'yxatga olinmagan`;
    await ref.update({ status: "failed", state: ACTION_STATES.FAILED_FINAL, failedAt: admin.firestore.FieldValue.serverTimestamp(), failureReason: error });
    await writeAuditLog(db, admin, {
      sellerId, who: approvedBy || sellerId, what: "Ijro funksiyasi topilmadi", actionId, actionType,
      oldState: ACTION_STATES.WAITING_APPROVAL, newState: ACTION_STATES.FAILED_FINAL, failure: error,
    });
    return { ok: true, executed: false, failed: true, action: actionDoc, error };
  }

  try {
    const result = await executor({ sellerId, payload: actionDoc, actionDoc });
    assertTransition(ACTION_STATES.RUNNING, ACTION_STATES.COMPLETED);
    await ref.update({
      status: "executed",
      state: ACTION_STATES.COMPLETED,
      approvedBy: approvedBy || null,
      executedAt: admin.firestore.FieldValue.serverTimestamp(),
      result: result || null,
    });
    await writeAuditLog(db, admin, {
      sellerId, who: approvedBy || sellerId, what: `"${actionType}" tasdiqlandi va ijro etildi`, actionId, actionType,
      oldState: ACTION_STATES.WAITING_APPROVAL, newState: ACTION_STATES.COMPLETED,
      approval: { approvedBy: approvedBy || sellerId }, execution: result || null,
    });
    return { ok: true, executed: true, action: actionDoc, result };
  } catch (err) {
    assertTransition(ACTION_STATES.RUNNING, ACTION_STATES.FAILED);
    assertTransition(ACTION_STATES.FAILED, ACTION_STATES.FAILED_FINAL);
    const errorMessage = err.message || "Noma'lum ijro xatosi";
    await ref.update({ status: "failed", state: ACTION_STATES.FAILED_FINAL, failedAt: admin.firestore.FieldValue.serverTimestamp(), failureReason: errorMessage });
    await writeAuditLog(db, admin, {
      sellerId, who: approvedBy || sellerId, what: `"${actionType}" ijrosida xatolik`, actionId, actionType,
      oldState: ACTION_STATES.WAITING_APPROVAL, newState: ACTION_STATES.FAILED_FINAL, failure: errorMessage,
    });
    return { ok: true, executed: false, failed: true, action: actionDoc, error: errorMessage };
  }
}

/**
 * Kutilayotgan harakatni RAD ETADI (hech narsa ijro etilmaydi).
 */
async function rejectAction(db, admin, { sellerId, actionId, rejectedBy }) {
  const loaded = await loadResolvableAction(db, admin, { sellerId, actionId });
  if (!loaded.ok) return loaded;
  const { ref, actionDoc } = loaded;
  const actionType = actionDoc.type || actionDoc.actionType || "crmCampaign";

  assertTransition(ACTION_STATES.WAITING_APPROVAL, ACTION_STATES.CANCELLED);
  await ref.update({
    status: "rejected",
    state: ACTION_STATES.CANCELLED,
    rejectedBy: rejectedBy || null,
    rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await writeAuditLog(db, admin, {
    sellerId, who: rejectedBy || sellerId, what: `"${actionType}" rad etildi`, actionId, actionType,
    oldState: ACTION_STATES.WAITING_APPROVAL, newState: ACTION_STATES.CANCELLED,
  });
  return { ok: true, executed: false, action: actionDoc };
}

module.exports = {
  DEFAULT_EXPIRY_MS,
  createPendingAction,
  approveAction,
  rejectAction,
  loadResolvableAction,
};
