import { describe, test, expect, vi, afterEach } from "vitest";
import { getLocationAgeMs, getLocationFreshness, LOCATION_FRESH_MS, LOCATION_STALE_MS } from "./locationFreshness";

const NOW = new Date("2026-08-29T12:00:00.000Z").getTime();

afterEach(() => {
  vi.useRealTimers();
});

describe("getLocationAgeMs", () => {
  test("`updatedAt` bo'lmasa null qaytaradi", () => {
    expect(getLocationAgeMs(null)).toBeNull();
    expect(getLocationAgeMs(undefined)).toBeNull();
  });

  test("Firestore Timestamp-shakldagi qiymat uchun to'g'ri yosh (ms) hisoblaydi", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const updatedAt = { toMillis: () => NOW - 5000 };
    expect(getLocationAgeMs(updatedAt)).toBe(5000);
  });

  test("kelajakdagi vaqt (soat sinxronizatsiyasi muammosi) uchun manfiy emas, 0 qaytaradi", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const updatedAt = { toMillis: () => NOW + 5000 };
    expect(getLocationAgeMs(updatedAt)).toBe(0);
  });
});

describe("getLocationFreshness", () => {
  test("joylashuv umuman bo'lmasa 'unknown' qaytaradi", () => {
    expect(getLocationFreshness(null)).toBe("unknown");
    expect(getLocationFreshness(undefined)).toBe("unknown");
  });

  test("chegaradan yangi bo'lsa 'fresh' qaytaradi", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(getLocationFreshness({ toMillis: () => NOW - (LOCATION_FRESH_MS - 1000) })).toBe("fresh");
  });

  test("fresh va stale chegarasi orasida 'stale' qaytaradi", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(getLocationFreshness({ toMillis: () => NOW - (LOCATION_FRESH_MS + 5000) })).toBe("stale");
  });

  test("stale chegarasidan ko'p bo'lsa 'very_stale' qaytaradi", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(getLocationFreshness({ toMillis: () => NOW - (LOCATION_STALE_MS + 1000) })).toBe("very_stale");
  });

  test("aynan chegara qiymatlarining o'zida ('<=') hali yangi/stale deb hisoblanadi", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(getLocationFreshness({ toMillis: () => NOW - LOCATION_FRESH_MS })).toBe("fresh");
    expect(getLocationFreshness({ toMillis: () => NOW - LOCATION_STALE_MS })).toBe("stale");
  });
});
