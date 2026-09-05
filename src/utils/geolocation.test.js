import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import {
  requestCourierLocationOnce,
  watchCourierLocation,
  openCourierLocationSettings,
  isLocationSettingsShortcutAvailable,
} from "./geolocation";

/**
 * MUHIM, ISHONCHLILIK TUZATISHI (foydalanuvchi so'roviga ko'ra —
 * kuryerning jonli joylashuvi oldin FAQAT oddiy brauzer
 * `navigator.geolocation`ga tayanardi, bu Telegram WebView'da
 * ishonchsiz bo'lishi mumkin): endi AVVAL Telegramning O'ZINING
 * `LocationManager` API'si sinaladi, faqat u mavjud bo'lmasa/xato
 * bersa brauzerga qaytiladi. Quyidagi testlar aynan shu ustuvorlik
 * tartibini va ikkala manba ham "rad etilgan" deganda BOSHQASIGA
 * qaytilMAsligini tekshiradi.
 */

// MUHIM: Node'ning zamonaviy versiyalarida global `navigator` FAQAT
// getter sifatida mavjud - `globalThis.navigator = ...` xato beradi -
// shuning uchun `Object.defineProperty` orqali qayta belgilanadi
// (`shareProductAsPost.test.js`dagi bilan BIR XIL naqsh).
function setGlobalNavigator(value) {
  Object.defineProperty(globalThis, "navigator", { value, configurable: true, writable: true });
}

describe("requestCourierLocationOnce", () => {
  const originalNavigator = globalThis.navigator;
  const originalWindow = globalThis.window;

  afterEach(() => {
    setGlobalNavigator(originalNavigator);
    globalThis.window = originalWindow;
    vi.restoreAllMocks();
  });

  test("Telegram LocationManager mavjud va allaqachon ishga tushirilgan bo'lsa, undan foydalanadi (brauzerga TEGMAYDI)", async () => {
    const browserGetCurrentPosition = vi.fn();
    setGlobalNavigator({ geolocation: { getCurrentPosition: browserGetCurrentPosition } });
    globalThis.window = {
      Telegram: {
        WebApp: {
          LocationManager: {
            isInited: true,
            isAccessGranted: true,
            getLocation: (cb) => cb({ latitude: 41.3111, longitude: 69.2401 }),
          },
        },
      },
    };

    const result = await requestCourierLocationOnce();
    expect(result).toEqual({ ok: true, lat: 41.3111, lng: 69.2401, source: "telegram" });
    expect(browserGetCurrentPosition).not.toHaveBeenCalled();
  });

  test("Telegram LocationManager hali ishga tushirilmagan bo'lsa, AVVAL `init()`ni chaqiradi", async () => {
    let initCalled = false;
    globalThis.window = {
      Telegram: {
        WebApp: {
          LocationManager: {
            isInited: false,
            isAccessGranted: true,
            init: (cb) => { initCalled = true; cb(); },
            getLocation: (cb) => cb({ latitude: 1, longitude: 2 }),
          },
        },
      },
    };
    setGlobalNavigator({});

    const result = await requestCourierLocationOnce();
    expect(initCalled).toBe(true);
    expect(result).toEqual({ ok: true, lat: 1, lng: 2, source: "telegram" });
  });

  test("Telegram ANIQ ruxsat bermagan bo'lsa ('denied'), brauzerga QAYTMAYDI (bir xil OS ruxsati)", async () => {
    const browserGetCurrentPosition = vi.fn();
    setGlobalNavigator({ geolocation: { getCurrentPosition: browserGetCurrentPosition } });
    globalThis.window = {
      Telegram: {
        WebApp: {
          LocationManager: {
            isInited: true,
            isAccessGranted: false,
            getLocation: (cb) => cb(null),
          },
        },
      },
    };

    const result = await requestCourierLocationOnce();
    expect(result).toEqual({ ok: false, reason: "denied" });
    expect(browserGetCurrentPosition).not.toHaveBeenCalled();
  });

  test("Telegram mavjud emas bo'lsa, brauzer geolokatsiyasiga qaytadi", async () => {
    globalThis.window = {};
    setGlobalNavigator({
      geolocation: {
        getCurrentPosition: (success) => success({ coords: { latitude: 3, longitude: 4 } }),
      },
    });

    const result = await requestCourierLocationOnce();
    expect(result).toEqual({ ok: true, lat: 3, lng: 4, source: "browser" });
  });

  test("Telegram 'unavailable' (masalan vaqtinchalik xato) desa, brauzerga qaytadi", async () => {
    globalThis.window = {
      Telegram: {
        WebApp: {
          LocationManager: {
            isInited: true,
            isAccessGranted: true, // ruxsat bor, lekin joylashuv shunchaki kelmadi
            getLocation: (cb) => cb(null),
          },
        },
      },
    };
    setGlobalNavigator({
      geolocation: {
        getCurrentPosition: (success) => success({ coords: { latitude: 5, longitude: 6 } }),
      },
    });

    const result = await requestCourierLocationOnce();
    expect(result).toEqual({ ok: true, lat: 5, lng: 6, source: "browser" });
  });

  test("brauzer ruxsatni rad etsa (code 1), 'denied' qaytaradi", async () => {
    globalThis.window = {};
    setGlobalNavigator({
      geolocation: {
        getCurrentPosition: (_success, error) => error({ code: 1 }),
      },
    });

    const result = await requestCourierLocationOnce();
    expect(result).toEqual({ ok: false, reason: "denied" });
  });

  test("hech qanday manba mavjud bo'lmasa, 'unavailable' qaytaradi", async () => {
    globalThis.window = {};
    setGlobalNavigator({});

    const result = await requestCourierLocationOnce();
    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("watchCourierLocation", () => {
  const originalNavigator = globalThis.navigator;
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    setGlobalNavigator(originalNavigator);
    globalThis.window = originalWindow;
  });

  test("muvaffaqiyatli o'qishda `onUpdate`ni chaqiradi va davriy ravishda qayta so'raydi", async () => {
    globalThis.window = {};
    setGlobalNavigator({
      geolocation: {
        getCurrentPosition: (success) => success({ coords: { latitude: 10, longitude: 20 } }),
      },
    });

    const onUpdate = vi.fn();
    const stop = watchCourierLocation(onUpdate, null, 8000);

    await vi.advanceTimersByTimeAsync(0);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({ lat: 10, lng: 20, source: "browser" });

    await vi.advanceTimersByTimeAsync(8000);
    expect(onUpdate).toHaveBeenCalledTimes(2);

    stop();
    await vi.advanceTimersByTimeAsync(8000);
    expect(onUpdate).toHaveBeenCalledTimes(2); // to'xtatilgandan keyin ORTIQ chaqirilmaydi
  });

  test("ruxsat rad etilganda `onDenied` FAQAT BIR MARTA chaqiriladi (qayta-qayta bezovta qilmaydi)", async () => {
    globalThis.window = {};
    setGlobalNavigator({
      geolocation: {
        getCurrentPosition: (_success, error) => error({ code: 1 }),
      },
    });

    const onUpdate = vi.fn();
    const onDenied = vi.fn();
    const stop = watchCourierLocation(onUpdate, onDenied, 8000);

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(8000);
    await vi.advanceTimersByTimeAsync(8000);

    expect(onDenied).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalled();
    stop();
  });
});

describe("openCourierLocationSettings / isLocationSettingsShortcutAvailable", () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  test("`openSettings` mavjud bo'lsa, uni chaqiradi va `true` qaytaradi", () => {
    const openSettings = vi.fn();
    globalThis.window = { Telegram: { WebApp: { LocationManager: { openSettings } } } };

    expect(isLocationSettingsShortcutAvailable()).toBe(true);
    expect(openCourierLocationSettings()).toBe(true);
    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  test("`openSettings` mavjud bo'lmasa, `false` qaytaradi (chaqiruvchi zaxira matn ko'rsatishi kerak)", () => {
    globalThis.window = { Telegram: { WebApp: { LocationManager: {} } } };
    expect(isLocationSettingsShortcutAvailable()).toBe(false);
    expect(openCourierLocationSettings()).toBe(false);
  });

  test("Telegram umuman mavjud bo'lmasa, `false` qaytaradi", () => {
    globalThis.window = {};
    expect(isLocationSettingsShortcutAvailable()).toBe(false);
    expect(openCourierLocationSettings()).toBe(false);
  });
});
