import { describe, test, expect } from "vitest";
import { isLikelyNetworkError } from "./authErrorClassifier";

/**
 * `isLikelyNetworkError` — 13/14-band ("refresh qilsa chiqarib yuboradi"
 * va "tarmoq xatoligida tizimdan chiqarmaslik" talablari) uchun MARKAZIY
 * qaror funksiyasi: `SessionContext.jsx`dagi autentifikatsiya qayta
 * urinish tsikli va `SessionGate.jsx`dagi "network-error" (tizimdan
 * chiqarmaydigan, qayta uriniladigan) holatga o'tish - shu funksiya
 * natijasiga to'liq bog'liq. Noto'g'ri tasniflash ikki xil real
 * oqibatga olib keladi: haqiqiy tarmoq xatoligi "error"ga tushib qolsa,
 * foydalanuvchi yana eski "Kirishda xatolik yuz berdi" devoriga tiqiladi;
 * haqiqiy (doimiy) autentifikatsiya rad etilishi "network-error"ga
 * tushib qolsa, foydalanuvchiga foyda bermaydigan qayta urinish
 * ko'rsatiladi.
 */
describe("isLikelyNetworkError", () => {
  test("bo'sh/undefined xatolik uchun false qaytaradi", () => {
    expect(isLikelyNetworkError(null)).toBe(false);
    expect(isLikelyNetworkError(undefined)).toBe(false);
  });

  test("initData bo'sh chiqqanda qo'yiladigan `isNetworkLike` bayrog'ini taniydi", () => {
    const err = new Error("Telegram ma'lumotlarini o'qib bo'lmadi.");
    err.isNetworkLike = true;
    expect(isLikelyNetworkError(err)).toBe(true);
  });

  test.each([
    "functions/unavailable",
    "functions/deadline-exceeded",
    "functions/internal",
    "functions/cancelled",
    "functions/resource-exhausted",
    "auth/network-request-failed",
  ])("Firebase kodi %s tarmoqqa o'xshash deb topiladi", (code) => {
    expect(isLikelyNetworkError({ code, message: "boom" })).toBe(true);
  });

  test("functions/unauthenticated (haqiqiy rad etilish) tarmoqqa o'xshash EMAS deb topiladi", () => {
    expect(
      isLikelyNetworkError({
        code: "functions/unauthenticated",
        message: "Telegram autentifikatsiyasi tasdiqlanmadi.",
      })
    ).toBe(false);
  });

  test.each([
    "Network Error",
    "failed to fetch",
    "Timeout exceeded",
    "You appear to be offline",
    "connection lost",
    "internet aloqasi yo'q",
  ])("xabar matnida '%s' bo'lsa tarmoqqa o'xshash deb topiladi", (message) => {
    expect(isLikelyNetworkError({ message })).toBe(true);
  });

  test("noma'lum, tarmoqqa aloqasi yo'q xatolik uchun false qaytaradi", () => {
    expect(isLikelyNetworkError({ code: "functions/invalid-argument", message: "Noto'g'ri parametr" })).toBe(false);
  });

  test("xabar katta-kichik harfga sezgir emas", () => {
    expect(isLikelyNetworkError({ message: "FAILED TO FETCH" })).toBe(true);
  });
});
