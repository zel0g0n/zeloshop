const {
  ACTION_STATES,
  isValidState,
  isTerminalState,
  canTransition,
  assertTransition,
  legacyStatusToState,
  resolveCurrentState,
} = require("../../lib/aiActionStateMachine");

describe("isValidState / isTerminalState", () => {
  test("barcha rasmiy holatlarni haqiqiy deb taniydi", () => {
    Object.values(ACTION_STATES).forEach((state) => expect(isValidState(state)).toBe(true));
  });
  test("noma'lum holatni rad etadi", () => {
    expect(isValidState("NOTOGRI")).toBe(false);
    expect(isValidState(undefined)).toBe(false);
  });
  test("faqat terminal holatlarni terminal deb taniydi", () => {
    expect(isTerminalState(ACTION_STATES.COMPLETED)).toBe(true);
    expect(isTerminalState(ACTION_STATES.FAILED_FINAL)).toBe(true);
    expect(isTerminalState(ACTION_STATES.CANCELLED)).toBe(true);
    expect(isTerminalState(ACTION_STATES.EXPIRED)).toBe(true);
    expect(isTerminalState(ACTION_STATES.WAITING_APPROVAL)).toBe(false);
    expect(isTerminalState(ACTION_STATES.RUNNING)).toBe(false);
  });
});

describe("canTransition / assertTransition — to'liq PDF lifecycle", () => {
  test("asosiy 'baxtli yo'l' (happy path) ruxsat etilgan", () => {
    const path = [
      ACTION_STATES.DETECTED, ACTION_STATES.ANALYZING, ACTION_STATES.PLANNED,
      ACTION_STATES.WAITING_APPROVAL, ACTION_STATES.APPROVED, ACTION_STATES.QUEUED,
      ACTION_STATES.RUNNING, ACTION_STATES.COMPLETED,
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
      expect(() => assertTransition(path[i], path[i + 1])).not.toThrow();
    }
  });

  test("LOW xavf + auto-execute: PLANNED to'g'ridan-to'g'ri QUEUED'ga o'tishi mumkin (WAITING_APPROVAL'ni o'tkazib yuborib)", () => {
    expect(canTransition(ACTION_STATES.PLANNED, ACTION_STATES.QUEUED)).toBe(true);
  });

  test("xatolik zanjiri: FAILED -> RETRYING -> RUNNING (qayta urinish) yoki FAILED_FINAL", () => {
    expect(canTransition(ACTION_STATES.RUNNING, ACTION_STATES.FAILED)).toBe(true);
    expect(canTransition(ACTION_STATES.FAILED, ACTION_STATES.RETRYING)).toBe(true);
    expect(canTransition(ACTION_STATES.RETRYING, ACTION_STATES.RUNNING)).toBe(true);
    expect(canTransition(ACTION_STATES.FAILED, ACTION_STATES.FAILED_FINAL)).toBe(true);
    expect(canTransition(ACTION_STATES.RETRYING, ACTION_STATES.FAILED_FINAL)).toBe(true);
  });

  test("muddat tugashi: FAQAT WAITING_APPROVAL'dan EXPIRED'ga o'tish mumkin", () => {
    expect(canTransition(ACTION_STATES.WAITING_APPROVAL, ACTION_STATES.EXPIRED)).toBe(true);
    expect(canTransition(ACTION_STATES.APPROVED, ACTION_STATES.EXPIRED)).toBe(false);
    expect(canTransition(ACTION_STATES.RUNNING, ACTION_STATES.EXPIRED)).toBe(false);
  });

  test("NOQONUNIY o'tishlarni rad etadi (masalan WAITING_APPROVAL'dan to'g'ridan-to'g'ri COMPLETED'ga)", () => {
    expect(canTransition(ACTION_STATES.WAITING_APPROVAL, ACTION_STATES.COMPLETED)).toBe(false);
    expect(canTransition(ACTION_STATES.DETECTED, ACTION_STATES.COMPLETED)).toBe(false);
    expect(() => assertTransition(ACTION_STATES.WAITING_APPROVAL, ACTION_STATES.COMPLETED)).toThrow(/Noqonuniy holat o'tishi/);
  });

  test("terminal holatlardan HECH QANDAY chiquvchi o'tish yo'q", () => {
    [ACTION_STATES.COMPLETED, ACTION_STATES.FAILED_FINAL, ACTION_STATES.CANCELLED, ACTION_STATES.EXPIRED].forEach((terminal) => {
      Object.values(ACTION_STATES).forEach((target) => {
        expect(canTransition(terminal, target)).toBe(false);
      });
    });
  });

  test("bekor qilish (CANCELLED) hali ijro boshlanmagan holatlardan mumkin", () => {
    expect(canTransition(ACTION_STATES.DETECTED, ACTION_STATES.CANCELLED)).toBe(true);
    expect(canTransition(ACTION_STATES.ANALYZING, ACTION_STATES.CANCELLED)).toBe(true);
    expect(canTransition(ACTION_STATES.PLANNED, ACTION_STATES.CANCELLED)).toBe(true);
    expect(canTransition(ACTION_STATES.WAITING_APPROVAL, ACTION_STATES.CANCELLED)).toBe(true);
    expect(canTransition(ACTION_STATES.QUEUED, ACTION_STATES.CANCELLED)).toBe(true);
  });

  test("noma'lum holat nomlari uchun assertTransition tavsifli xato tashlaydi", () => {
    expect(() => assertTransition("NOTOGRI", ACTION_STATES.ANALYZING)).toThrow(/boshlang'ich holat/);
    expect(() => assertTransition(ACTION_STATES.DETECTED, "NOTOGRI")).toThrow(/maqsad holat/);
  });
});

describe("legacyStatusToState / resolveCurrentState — orqaga moslik", () => {
  test("eski status qiymatlarini to'g'ri holatga moslashtiradi", () => {
    expect(legacyStatusToState("pending")).toBe(ACTION_STATES.WAITING_APPROVAL);
    expect(legacyStatusToState("executed")).toBe(ACTION_STATES.COMPLETED);
    expect(legacyStatusToState("rejected")).toBe(ACTION_STATES.CANCELLED);
    expect(legacyStatusToState("noma'lum")).toBeNull();
  });

  test("yangi `state` maydoni bo'lsa - shuni ustun qo'yadi", () => {
    expect(resolveCurrentState({ state: ACTION_STATES.RUNNING, status: "pending" })).toBe(ACTION_STATES.RUNNING);
  });

  test("`state` bo'lmasa - eski `status`ga tayanadi", () => {
    expect(resolveCurrentState({ status: "executed" })).toBe(ACTION_STATES.COMPLETED);
  });

  test("ikkalasi ham bo'lmasa yoki hujjat yo'q bo'lsa - null", () => {
    expect(resolveCurrentState({})).toBeNull();
    expect(resolveCurrentState(null)).toBeNull();
  });

  test("noto'g'ri `state` qiymati bo'lsa - eski `status`ga qaytadi", () => {
    expect(resolveCurrentState({ state: "NOTOGRI", status: "rejected" })).toBe(ACTION_STATES.CANCELLED);
  });
});
