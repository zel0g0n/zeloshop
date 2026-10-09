import { describe, it, expect, afterEach } from "vitest";
import { isRunningInTelegram } from "./telegram";

const setWebApp = (webApp) => {
  globalThis.window = globalThis.window || {};
  globalThis.window.Telegram = webApp ? { WebApp: webApp } : undefined;
};

afterEach(() => {
  if (globalThis.window) globalThis.window.Telegram = undefined;
});

describe("isRunningInTelegram", () => {
  it("SDK umuman yo'q — false", () => {
    setWebApp(null);
    expect(isRunningInTelegram()).toBe(false);
  });
  it("oddiy brauzer (SDK yuklangan, platform 'unknown', initData bo'sh) — false", () => {
    setWebApp({ platform: "unknown", initData: "" });
    expect(isRunningInTelegram()).toBe(false);
  });
  it("Telegram, initData hali bo'sh ('sovuq' ochilish), lekin platform ma'lum — true", () => {
    setWebApp({ platform: "tdesktop", initData: "" });
    expect(isRunningInTelegram()).toBe(true);
  });
  it("initData to'liq — true", () => {
    setWebApp({ platform: "unknown", initData: "query_id=1&hash=x" });
    expect(isRunningInTelegram()).toBe(true);
  });
});
