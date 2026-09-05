/**
 * AI CEO — rasmiy ACTION STATE MACHINE.
 *
 * ZeloShop — AI Business Operating System master prompti (G-bo'lim,
 * "AI AUTONOMOUS ACTION FLOW"): har bir AI harakati quyidagi
 * lifecycle'dan o'tishi kerak, va NOQONUNIY holat o'tishlariga yo'l
 * qo'yilmasligi kerak. Bu fayl — shu qoidaning YAGONA, sof (Firestore'ga
 * bog'liq bo'lmagan, to'liq test qilinadigan) manbasi.
 *
 * MUHIM (haqiqiy qamrov): hozircha alohida background job queue
 * infratuzilmasi (worker/priority/attempts) QURILMAGAN — barcha
 * mavjud AI harakatlari (CRM kampaniyasi, reklama kampaniyasi)
 * SINXRON, bitta so'rov ichida bajariladi. Shuning uchun
 * `QUEUED`/`RUNNING` oraliq holatlari FIRESTORE'GA ALOHIDA
 * YOZILMAYDI (`aiApprovalEngine.js`ga qarang) — lekin BARCHA
 * holat o'tishlari xotirada, shu modul orqali TEKSHIRILADI, shuning
 * uchun noqonuniy ketma-ketlik (masalan WAITING_APPROVAL'dan
 * to'g'ridan-to'g'ri COMPLETED'ga, APPROVED'siz) haligacha rad
 * etiladi. Kelajakda haqiqiy queue/worker qo'shilsa, oraliq
 * holatlarni ham persistlash mumkin bo'ladi — bu modulning o'zi
 * o'zgarishsiz qoladi.
 */

const ACTION_STATES = Object.freeze({
  DETECTED: "DETECTED",
  ANALYZING: "ANALYZING",
  PLANNED: "PLANNED",
  WAITING_APPROVAL: "WAITING_APPROVAL",
  APPROVED: "APPROVED",
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  RETRYING: "RETRYING",
  FAILED_FINAL: "FAILED_FINAL",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
});

// Terminal holatlar — bulardan boshqa hech qanday holatga o'tish
// mumkin emas (harakat "yopilgan").
const TERMINAL_STATES = new Set([
  ACTION_STATES.COMPLETED,
  ACTION_STATES.FAILED_FINAL,
  ACTION_STATES.CANCELLED,
  ACTION_STATES.EXPIRED,
]);

// Ruxsat etilgan o'tishlar — PDF'dagi G-bo'lim lifecycle'ga aynan mos:
// DETECTED -> ANALYZING -> PLANNED -> WAITING_APPROVAL -> APPROVED ->
// QUEUED -> RUNNING -> COMPLETED
// Failure: FAILED -> RETRYING -> FAILED_FINAL
// Cancel: CANCELLED (faqat hali hal qilinmagan/ijro boshlanmagan holatdan)
// Expired approval: EXPIRED (faqat WAITING_APPROVAL'dan)
const ALLOWED_TRANSITIONS = Object.freeze({
  [ACTION_STATES.DETECTED]: new Set([ACTION_STATES.ANALYZING, ACTION_STATES.CANCELLED]),
  [ACTION_STATES.ANALYZING]: new Set([ACTION_STATES.PLANNED, ACTION_STATES.FAILED, ACTION_STATES.CANCELLED]),
  // LOW xavf darajasidagi, avtomatik ijro siyosati ruxsat bergan
  // harakatlar tasdiqni butunlay o'tkazib yuborib, to'g'ridan-to'g'ri
  // QUEUED'ga o'tishi mumkin (F-bo'lim: "LOW: policy ruxsat bersa
  // auto-execute mumkin").
  [ACTION_STATES.PLANNED]: new Set([ACTION_STATES.WAITING_APPROVAL, ACTION_STATES.QUEUED, ACTION_STATES.FAILED, ACTION_STATES.CANCELLED]),
  [ACTION_STATES.WAITING_APPROVAL]: new Set([ACTION_STATES.APPROVED, ACTION_STATES.CANCELLED, ACTION_STATES.EXPIRED]),
  [ACTION_STATES.APPROVED]: new Set([ACTION_STATES.QUEUED]),
  [ACTION_STATES.QUEUED]: new Set([ACTION_STATES.RUNNING, ACTION_STATES.CANCELLED]),
  [ACTION_STATES.RUNNING]: new Set([ACTION_STATES.COMPLETED, ACTION_STATES.FAILED]),
  [ACTION_STATES.FAILED]: new Set([ACTION_STATES.RETRYING, ACTION_STATES.FAILED_FINAL]),
  [ACTION_STATES.RETRYING]: new Set([ACTION_STATES.RUNNING, ACTION_STATES.FAILED_FINAL]),
  // Terminal holatlar — chiquvchi o'tish yo'q.
  [ACTION_STATES.COMPLETED]: new Set(),
  [ACTION_STATES.FAILED_FINAL]: new Set(),
  [ACTION_STATES.CANCELLED]: new Set(),
  [ACTION_STATES.EXPIRED]: new Set(),
});

function isValidState(state) {
  return Object.prototype.hasOwnProperty.call(ACTION_STATES, state);
}

function isTerminalState(state) {
  return TERMINAL_STATES.has(state);
}

function canTransition(fromState, toState) {
  if (!isValidState(fromState) || !isValidState(toState)) return false;
  const allowed = ALLOWED_TRANSITIONS[fromState];
  return allowed ? allowed.has(toState) : false;
}

/**
 * `fromState`dan `toState`ga o'tish qonuniy bo'lmasa xato tashlaydi.
 * Chaqiruvchi tomon (`aiApprovalEngine.js`) bu funksiyani HAR bir
 * holat o'zgarishidan oldin chaqiradi — noqonuniy o'tish Firestore'ga
 * yozilishidan OLDIN, xotirada rad etiladi.
 */
function assertTransition(fromState, toState) {
  if (!isValidState(fromState)) {
    throw new Error(`Noma'lum boshlang'ich holat: ${fromState}`);
  }
  if (!isValidState(toState)) {
    throw new Error(`Noma'lum maqsad holat: ${toState}`);
  }
  if (!canTransition(fromState, toState)) {
    throw new Error(`Noqonuniy holat o'tishi: ${fromState} -> ${toState}`);
  }
  return true;
}

/**
 * Eski (v39.14 va oldingi) `status` maydonini ("pending"/"executed"/
 * "rejected") yangi rasmiy holat enumiga moslashtiradi — orqaga
 * mos (backward-compatible) o'qish uchun. Yangi hujjatlar `state`
 * maydonini o'zi saqlaydi, bu funksiya faqat ESKI hujjatlar
 * (`state` maydoni yo'q) uchun kerak.
 */
function legacyStatusToState(status) {
  if (status === "pending") return ACTION_STATES.WAITING_APPROVAL;
  if (status === "executed") return ACTION_STATES.COMPLETED;
  if (status === "rejected") return ACTION_STATES.CANCELLED;
  return null;
}

/**
 * Hujjatning HAQIQIY joriy holatini aniqlaydi — avval yangi `state`
 * maydoniga, u bo'lmasa eski `status` maydoniga (moslashtirilgan
 * holda) qaraydi. Ikkalasi ham bo'lmasa `null` qaytaradi.
 */
function resolveCurrentState(actionDoc) {
  if (!actionDoc) return null;
  if (actionDoc.state && isValidState(actionDoc.state)) return actionDoc.state;
  return legacyStatusToState(actionDoc.status);
}

module.exports = {
  ACTION_STATES,
  TERMINAL_STATES,
  ALLOWED_TRANSITIONS,
  isValidState,
  isTerminalState,
  canTransition,
  assertTransition,
  legacyStatusToState,
  resolveCurrentState,
};
