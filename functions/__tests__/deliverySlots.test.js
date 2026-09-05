const { parseHHmm, getMinLeadHours, generateDeliverySlots, isValidDeliverySlot, formatDeliverySlotAbsolute } = require("../lib/deliverySlots");

describe("parseHHmm", () => {
  test("to'g'ri 'HH:mm' satrni tahlil qiladi", () => {
    expect(parseHHmm("10:00")).toEqual({ h: 10, m: 0 });
    expect(parseHHmm("9:30")).toEqual({ h: 9, m: 30 });
  });

  test("noto'g'ri qiymatlar uchun null qaytaradi", () => {
    expect(parseHHmm("25:00")).toBeNull();
    expect(parseHHmm(null)).toBeNull();
  });
});

describe("getMinLeadHours", () => {
  test("'otherRegions' uchun 27, boshqa hollarda 3", () => {
    expect(getMinLeadHours("otherRegions")).toBe(27);
    expect(getMinLeadHours("sameCity")).toBe(3);
    expect(getMinLeadHours(null)).toBe(3);
  });
});

describe("generateDeliverySlots", () => {
  const NOW_MS = Date.UTC(2026, 8, 1, 6, 0, 0); // Toshkentda 11:00

  test("barcha oraliqlar 1 soatlik va ish vaqti ichida", () => {
    const slots = generateDeliverySlots({ nowMs: NOW_MS, minLeadHours: 3, workingHoursOpen: "10:00", workingHoursClose: "19:00" });
    expect(slots.length).toBeGreaterThan(0);
    slots.forEach((slot) => {
      expect(slot.endMs - slot.startMs).toBe(3600000);
      const tashkentHour = new Date(slot.startMs + 5 * 3600000).getUTCHours();
      expect(tashkentHour).toBeGreaterThanOrEqual(10);
      expect(tashkentHour).toBeLessThan(19);
    });
  });

  test("noto'g'ri ish vaqti konfiguratsiyasida bo'sh massiv", () => {
    expect(generateDeliverySlots({ nowMs: NOW_MS, workingHoursOpen: "19:00", workingHoursClose: "10:00" })).toEqual([]);
  });
});

describe("isValidDeliverySlot", () => {
  const NOW_MS = Date.UTC(2026, 8, 1, 6, 0, 0);
  const opts = { nowMs: NOW_MS, minLeadHours: 3, workingHoursOpen: "10:00", workingHoursClose: "19:00" };

  test("MUHIM (xavfsizlik): frontend/backend hisob-kitobi mos kelishi kerak - haqiqiy ro'yxatdagi oraliq yaroqli", () => {
    const [validSlot] = generateDeliverySlots(opts);
    expect(isValidDeliverySlot(validSlot, opts)).toBe(true);
  });

  test("soxtalashtirilgan (juda erta) oraliq rad etiladi", () => {
    expect(isValidDeliverySlot({ startMs: NOW_MS, endMs: NOW_MS + 3600000 }, opts)).toBe(false);
  });

  test("noto'g'ri davomiylikdagi oraliq rad etiladi", () => {
    const [validSlot] = generateDeliverySlots(opts);
    expect(isValidDeliverySlot({ startMs: validSlot.startMs, endMs: validSlot.startMs + 1800000 }, opts)).toBe(false);
  });
});

describe("formatDeliverySlotAbsolute", () => {
  // MUHIM: `src/utils/deliverySlots.js`dagi bilan AYNAN BIR XIL natija
  // berishi kerak (Telegram bildirishnomasi va Mini App'dagi sotuvchi/
  // xodim buyurtma kartochkasi BIR XIL formatni ko'rsatishi uchun,
  // `notifications.js`/`staff.js`da ishlatiladi).
  test("'DD.MM, HH:00–HH:00' shaklida, Toshkent vaqtida formatlaydi", () => {
    const slot = { startMs: Date.UTC(2026, 8, 2, 9, 0, 0), endMs: Date.UTC(2026, 8, 2, 10, 0, 0) };
    expect(formatDeliverySlotAbsolute(slot)).toBe("02.09, 14:00–15:00");
  });
});
