import { describe, test, expect, vi } from "vitest";

vi.mock("@/config/telegram", () => ({ getTelegramWebApp: vi.fn() }));

import { getTelegramWebApp } from "@/config/telegram";
import { getCloudStorageItem, setCloudStorageItem, isCloudStorageAvailable } from "./cloudStorage";

function buildWebApp({ hasCloudStorage = true, versionOk = true, hasIsVersionAtLeast = true } = {}) {
  return {
    CloudStorage: hasCloudStorage ? { getItem: vi.fn(), setItem: vi.fn() } : undefined,
    isVersionAtLeast: hasIsVersionAtLeast ? vi.fn().mockReturnValue(versionOk) : undefined,
  };
}

describe("isCloudStorageAvailable", () => {
  test("Telegram WebApp umuman yo'q bo'lsa - false", () => {
    getTelegramWebApp.mockReturnValue(null);
    expect(isCloudStorageAvailable()).toBe(false);
  });

  test("CloudStorage obyekti yo'q bo'lsa (eski mijoz) - false", () => {
    getTelegramWebApp.mockReturnValue(buildWebApp({ hasCloudStorage: false }));
    expect(isCloudStorageAvailable()).toBe(false);
  });

  test("isVersionAtLeast mavjud emas bo'lsa - xavfsiz tomonda qolib false qaytaradi", () => {
    getTelegramWebApp.mockReturnValue(buildWebApp({ hasIsVersionAtLeast: false }));
    expect(isCloudStorageAvailable()).toBe(false);
  });

  test("versiya yetarli emas bo'lsa - false", () => {
    getTelegramWebApp.mockReturnValue(buildWebApp({ versionOk: false }));
    expect(isCloudStorageAvailable()).toBe(false);
  });

  test("hammasi mos bo'lsa - true", () => {
    getTelegramWebApp.mockReturnValue(buildWebApp());
    expect(isCloudStorageAvailable()).toBe(true);
  });
});

describe("getCloudStorageItem", () => {
  test("mavjud bo'lmasa - null bilan tinch qaytadi (xato tashlamaydi)", async () => {
    getTelegramWebApp.mockReturnValue(null);
    await expect(getCloudStorageItem("lang")).resolves.toBeNull();
  });

  test("Telegram xato qaytarsa - null", async () => {
    const webApp = buildWebApp();
    webApp.CloudStorage.getItem.mockImplementation((key, cb) => cb(new Error("xato"), null));
    getTelegramWebApp.mockReturnValue(webApp);
    await expect(getCloudStorageItem("lang")).resolves.toBeNull();
  });

  test("muvaffaqiyatli bo'lsa - qiymatni qaytaradi", async () => {
    const webApp = buildWebApp();
    webApp.CloudStorage.getItem.mockImplementation((key, cb) => cb(null, "ru"));
    getTelegramWebApp.mockReturnValue(webApp);
    await expect(getCloudStorageItem("cache:v1:language")).resolves.toBe("ru");
    expect(webApp.CloudStorage.getItem).toHaveBeenCalledWith("cache:v1:language", expect.any(Function));
  });

  test("bo'sh qator qaytsa (hali saqlanmagan) - null qaytaradi", async () => {
    const webApp = buildWebApp();
    webApp.CloudStorage.getItem.mockImplementation((key, cb) => cb(null, ""));
    getTelegramWebApp.mockReturnValue(webApp);
    await expect(getCloudStorageItem("lang")).resolves.toBeNull();
  });

  test("CloudStorage.getItem sinxron xato tashlasa - ushlab, null qaytaradi", async () => {
    const webApp = buildWebApp();
    webApp.CloudStorage.getItem.mockImplementation(() => {
      throw new Error("kutilmagan xato");
    });
    getTelegramWebApp.mockReturnValue(webApp);
    await expect(getCloudStorageItem("lang")).resolves.toBeNull();
  });
});

describe("setCloudStorageItem", () => {
  test("mavjud bo'lmasa - false bilan tinch qaytadi", async () => {
    getTelegramWebApp.mockReturnValue(null);
    await expect(setCloudStorageItem("lang", "uz")).resolves.toBe(false);
  });

  test("muvaffaqiyatli saqlansa - true", async () => {
    const webApp = buildWebApp();
    webApp.CloudStorage.setItem.mockImplementation((key, value, cb) => cb(null, true));
    getTelegramWebApp.mockReturnValue(webApp);
    await expect(setCloudStorageItem("cache:v1:language", "ru")).resolves.toBe(true);
    expect(webApp.CloudStorage.setItem).toHaveBeenCalledWith("cache:v1:language", "ru", expect.any(Function));
  });

  test("Telegram xato qaytarsa - false", async () => {
    const webApp = buildWebApp();
    webApp.CloudStorage.setItem.mockImplementation((key, value, cb) => cb(new Error("xato"), null));
    getTelegramWebApp.mockReturnValue(webApp);
    await expect(setCloudStorageItem("lang", "uz")).resolves.toBe(false);
  });
});
