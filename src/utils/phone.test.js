import { describe, test, expect } from "vitest";
import { formatUzPhone, isValidUzPhone, hasMeaningfulPhoneDigits } from "./phone";

/**
 * `phone.js` uchun testlar — AVVAL BUTUNLAY SINALMAGAN edi. Bu fayl
 * `CourierManagementPage.jsx`dagi kritik xato (telefon maydoni hech
 * qanday tekshiruvsiz bo'lgani uchun tasodifiy matn "telefon"
 * sifatida saqlanib qolgan edi) tuzatilgan paytda qo'shildi -
 * `hasMeaningfulPhoneDigits` AYNAN o'sha tuzatish uchun yozilgan YANGI
 * funksiya.
 */

describe("formatUzPhone", () => {
  test("bo'sh qiymat uchun '+998 ' qaytaradi (mamlakat kodi stub)", () => {
    expect(formatUzPhone("")).toBe("+998 ");
    expect(formatUzPhone(null)).toBe("+998 ");
  });

  test("faqat raqamlarni ajratib, guruhlab formatlaydi", () => {
    expect(formatUzPhone("901234567")).toBe("+998 90 123 45 67");
  });

  test("boshida '998' bo'lsa, uni mamlakat kodi sifatida olib tashlaydi", () => {
    expect(formatUzPhone("998901234567")).toBe("+998 90 123 45 67");
    expect(formatUzPhone("+998901234567")).toBe("+998 90 123 45 67");
  });

  test("9 tadan ortiq raqam kiritilsa, ortig'i kesib tashlanadi", () => {
    expect(formatUzPhone("99890123456789999")).toBe("+998 90 123 45 67");
  });

  test("harflar/belgilar bo'lsa, faqat raqamlar hisobga olinadi", () => {
    expect(formatUzPhone("jdsjk")).toBe("+998 ");
    expect(formatUzPhone("+998 (90) 123-45-67")).toBe("+998 90 123 45 67");
  });

  test("qisman kiritilgan raqamni QISMAN formatlaydi (yozish jarayonida)", () => {
    expect(formatUzPhone("90")).toBe("+998 90");
    expect(formatUzPhone("90123")).toBe("+998 90 123");
  });
});

describe("isValidUzPhone", () => {
  test("to'liq 9 xonali raqam - haqiqiy", () => {
    expect(isValidUzPhone("+998 90 123 45 67")).toBe(true);
    expect(isValidUzPhone("998901234567")).toBe(true);
    expect(isValidUzPhone("901234567")).toBe(true);
  });

  test("to'liqsiz raqam - noto'g'ri", () => {
    expect(isValidUzPhone("+998 90")).toBe(false);
    expect(isValidUzPhone("")).toBe(false);
  });

  test("faqat mamlakat kodi stub'i ('+998 ') - noto'g'ri", () => {
    expect(isValidUzPhone("+998 ")).toBe(false);
  });

  test("faqat harflardan iborat (raqamsiz) 'garbage' - noto'g'ri", () => {
    expect(isValidUzPhone("jdsjk")).toBe(false);
  });

  test("garbage matn ICHIDAGI raqamlar soni to'g'ri kelmasa - noto'g'ri", () => {
    // Haqiqiy ekrandagi xato: "989u978979898hdbhsjmjkksjdfkj" - ichidagi
    // raqamlar (12 ta, "998" bilan boshlanmagani uchun kesilmaydi) 9
    // xonaga to'g'ri kelmaydi.
    expect(isValidUzPhone("989u978979898hdbhsjmjkksjdfkj")).toBe(false);
  });
});

describe("hasMeaningfulPhoneDigits — kritik xato tuzatishi (CourierManagementPage)", () => {
  test("butunlay bo'sh qiymat - raqam YO'Q", () => {
    expect(hasMeaningfulPhoneDigits("")).toBe(false);
    expect(hasMeaningfulPhoneDigits(null)).toBe(false);
  });

  test("faqat 'onFocus' orqali to'ldirilgan '+998 ' stub'i - raqam YO'Q (bo'sh deb hisoblanadi)", () => {
    expect(hasMeaningfulPhoneDigits("+998 ")).toBe(false);
    expect(hasMeaningfulPhoneDigits("+998")).toBe(false);
  });

  test("mamlakat kodidan KEYIN kamida bitta raqam kiritilgan bo'lsa - bor", () => {
    expect(hasMeaningfulPhoneDigits("+998 9")).toBe(true);
    expect(hasMeaningfulPhoneDigits("+998 90 123 45 67")).toBe(true);
  });

  test("mamlakat kodisiz, to'g'ridan-to'g'ri raqam kiritilgan bo'lsa ham - bor", () => {
    expect(hasMeaningfulPhoneDigits("90")).toBe(true);
  });

  test("faqat harflar (raqamsiz garbage) - raqam YO'Q", () => {
    expect(hasMeaningfulPhoneDigits("jdsjk")).toBe(false);
  });
});
