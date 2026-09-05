/**
 * `orderStatusNotify.js` uchun testlar — sotuvchi (yoki ruxsatli xodim)
 * buyurtmani "Yangi" → "Yig'ilmoqda" (`processing`) holatiga
 * tasdiqlaganda mijozga yuboriladigan xabar matni
 * (2026-09 punkt-royxati, 14-band).
 *
 * MUHIM E'TIBOR: xabar matni TO'LOV USULIDAN QAT'IY NAZAR (naqd YOKI
 * karta orqali) BIR XIL bo'lishi shart — funksiya `paymentMethod`
 * parametrini umuman qabul qilmaydi, bu ataylab shunday (batafsili:
 * `orderStatusNotify.js`dagi izoh).
 */

const { _testables } = require("../orderStatusNotify");
const { buildOrderConfirmedMessage } = _testables;

describe("buildOrderConfirmedMessage", () => {
  test("mijoz F.I.SH'ini xabar ichida ko'rsatadi", () => {
    const msg = buildOrderConfirmedMessage("Alisher Oromov");
    expect(msg).toContain("Alisher Oromov");
    expect(msg).toContain("tasdiqlandi");
  });

  test("ism berilmasa, 'mijoz' so'zi bilan almashtiradi (xato bermaydi)", () => {
    expect(() => buildOrderConfirmedMessage()).not.toThrow();
    expect(buildOrderConfirmedMessage(null)).toContain("mijoz");
    expect(buildOrderConfirmedMessage(undefined)).toContain("mijoz");
  });

  test("faqat bo'shliqlardan iborat ism uchun ham 'mijoz'ga tushadi", () => {
    expect(buildOrderConfirmedMessage("   ")).toContain("mijoz");
  });

  test("kuryerga topshirilganda alohida xabar kelishini eslatadi", () => {
    const msg = buildOrderConfirmedMessage("Ali");
    expect(msg).toMatch(/kuryerga topshirganimizda/i);
  });

  test("xaridi uchun minnatdorchilik bildiradi", () => {
    const msg = buildOrderConfirmedMessage("Ali");
    expect(msg).toMatch(/rahmat/i);
  });

  test("funksiya `paymentMethod`ni umuman qabul qilmaydi — naqd va karta uchun bitta shablon (2026-09, 14-band)", () => {
    expect(buildOrderConfirmedMessage.length).toBe(1);
  });
});
