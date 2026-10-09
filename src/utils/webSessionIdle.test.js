import { describe, it, expect } from "vitest";
import { isIdleExpired, WEB_IDLE_LIMIT_MS } from "./webSessionIdle";

describe("isIdleExpired", () => {
  const now = 1_000_000_000_000;
  it("yaqinda faol bo'lsa — muddati o'tmagan", () => {
    expect(isIdleExpired(now - 60_000, now)).toBe(false);
  });
  it("chegaradan ko'p harakatsiz bo'lsa — muddati o'tgan", () => {
    expect(isIdleExpired(now - WEB_IDLE_LIMIT_MS - 1, now)).toBe(true);
  });
  it("aynan chegarada — hali o'tmagan", () => {
    expect(isIdleExpired(now - WEB_IDLE_LIMIT_MS, now)).toBe(false);
  });
  it("qiymat yo'q/yaroqsiz (NaN, 0) — o'tgan deb hisoblanmaydi", () => {
    expect(isIdleExpired(NaN, now)).toBe(false);
    expect(isIdleExpired(0, now)).toBe(false);
  });
});
