import { describe, test, expect } from "vitest";
import { parseHHmm, getMinLeadHours, generateDeliverySlots, isValidDeliverySlot } from "./deliverySlots";

describe("parseHHmm", () => {
  test("to'g'ri 'HH:mm' satrni tahlil qiladi", () => {
    expect(parseHHmm("10:00")).toEqual({ h: 10, m: 0 });
    expect(parseHHmm("9:30")).toEqual({ h: 9, m: 30 });
    expect(parseHHmm("23:59")).toEqual({ h: 23, m: 59 });
  });

  test("noto'g'ri qiymatlar uchun null qaytaradi", () => {
    expect(parseHHmm("25:00")).toBeNull();
    expect(parseHHmm("10:70")).toBeNull();
    expect(parseHHmm("noto'g'ri")).toBeNull();
    expect(parseHHmm(null)).toBeNull();
    expect(parseHHmm(undefined)).toBeNull();
  });
});

describe("getMinLeadHours", () => {
  test("'otherRegions' uchun 27 soat", () => {
    expect(getMinLeadHours("otherRegions")).toBe(27);
  });
  test("boshqa barcha holatlar uchun 3 soat", () => {
    expect(getMinLeadHours("sameCity")).toBe(3);
    expect(getMinLeadHours("sameRegionDistricts")).toBe(3);
    expect(getMinLeadHours(null)).toBe(3);
    expect(getMinLeadHours(undefined)).toBe(3);
  });
});

describe("generateDeliverySlots", () => {
  // 2026-09-01 06:00 UTC = 2026-09-01 11:00 Toshkent vaqti.
  const NOW_MS = Date.UTC(2026, 8, 1, 6, 0, 0);

  test("barcha oraliqlar to'liq soat chegarasida (1 soatlik)", () => {
    const slots = generateDeliverySlots({ nowMs: NOW_MS, minLeadHours: 3 });
    expect(slots.length).toBeGreaterThan(0);
    slots.forEach((slot) => {
      expect(slot.endMs - slot.startMs).toBe(60 * 60 * 1000);
    });
  });

  test("eng erta oraliq `nowMs + minLeadHours`dan OLDIN bo'lmaydi", () => {
    const minLeadHours = 3;
    const slots = generateDeliverySlots({ nowMs: NOW_MS, minLeadHours, workingHoursOpen: "10:00", workingHoursClose: "19:00" });
    const earliestAllowed = NOW_MS + minLeadHours * 60 * 60 * 1000;
    expect(slots[0].startMs).toBeGreaterThanOrEqual(earliestAllowed);
  });

  test("Toshkent vaqti 11:00 + 3 soat = 14:00 - birinchi oraliq shu yerdan boshlanishi kerak", () => {
    // Ish vaqti 10:00-19:00, hozir Toshkentda 11:00 - shuning uchun
    // eng erta ruxsat etilgan vaqt 14:00 (11:00+3), bu ish vaqti
    // ichida - birinchi slot AYNAN 14:00-15:00 bo'lishi kerak.
    const slots = generateDeliverySlots({ nowMs: NOW_MS, minLeadHours: 3, workingHoursOpen: "10:00", workingHoursClose: "19:00" });
    const first = slots[0];
    const firstTashkentHour = new Date(first.startMs + 5 * 60 * 60 * 1000).getUTCHours();
    expect(firstTashkentHour).toBe(14);
  });

  test("ish vaqtidan tashqaridagi soatlar chiqarib tashlanadi (masalan 19:00dan keyin yoki 10:00dan oldin)", () => {
    const slots = generateDeliverySlots({ nowMs: NOW_MS, minLeadHours: 3, workingHoursOpen: "10:00", workingHoursClose: "19:00" });
    slots.forEach((slot) => {
      const tashkentHour = new Date(slot.startMs + 5 * 60 * 60 * 1000).getUTCHours();
      expect(tashkentHour).toBeGreaterThanOrEqual(10);
      expect(tashkentHour).toBeLessThan(19);
    });
  });

  test("agar minLeadHours ish vaqtidan tashqariga chiqarib yuborsa (kech kuzatuv), KEYINGI kunning ochilish vaqtiga o'tadi", () => {
    // Toshkentda hozir 11:00, minLeadHours=27 -> eng erta ruxsat 14:00
    // ERTASI kun - bu ish vaqti ichida (10:00-19:00), shuning uchun
    // ertangi kun 14:00'dan boshlanishi kerak.
    const slots = generateDeliverySlots({ nowMs: NOW_MS, minLeadHours: 27, workingHoursOpen: "10:00", workingHoursClose: "19:00" });
    expect(slots.length).toBeGreaterThan(0);
    const first = slots[0];
    const earliestAllowed = NOW_MS + 27 * 60 * 60 * 1000;
    expect(first.startMs).toBeGreaterThanOrEqual(earliestAllowed);
  });

  test("noto'g'ri ish vaqti konfiguratsiyasida (open >= close) bo'sh massiv qaytaradi", () => {
    expect(generateDeliverySlots({ nowMs: NOW_MS, workingHoursOpen: "19:00", workingHoursClose: "10:00" })).toEqual([]);
  });
});

describe("isValidDeliverySlot", () => {
  const NOW_MS = Date.UTC(2026, 8, 1, 6, 0, 0);
  const opts = { nowMs: NOW_MS, minLeadHours: 3, workingHoursOpen: "10:00", workingHoursClose: "19:00" };

  test("generateDeliverySlots RO'YXATIDAGI oraliq - yaroqli", () => {
    const [validSlot] = generateDeliverySlots(opts);
    expect(isValidDeliverySlot(validSlot, opts)).toBe(true);
  });

  test("ro'yxatda YO'Q (masalan juda erta) oraliq - yaroqsiz", () => {
    expect(isValidDeliverySlot({ startMs: NOW_MS, endMs: NOW_MS + 3600000 }, opts)).toBe(false);
  });

  test("1 soatdan farqli davomiylik - yaroqsiz", () => {
    const [validSlot] = generateDeliverySlots(opts);
    expect(isValidDeliverySlot({ startMs: validSlot.startMs, endMs: validSlot.startMs + 1800000 }, opts)).toBe(false);
  });

  test("null/noto'g'ri shakl - yaroqsiz", () => {
    expect(isValidDeliverySlot(null, opts)).toBe(false);
    expect(isValidDeliverySlot({}, opts)).toBe(false);
    expect(isValidDeliverySlot({ startMs: "abc", endMs: 123 }, opts)).toBe(false);
  });
});
