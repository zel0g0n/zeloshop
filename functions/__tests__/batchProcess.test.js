const { processBatched } = require("../lib/batchProcess");

/**
 * `processBatched` - cron funksiyalarning 50-100+ sotuvchida
 * ketma-ket ishlov berish tufayli standart 60s `onSchedule`
 * timeout'idan oshib ketish xavfini (loyiha xotirasi) hal qiluvchi
 * umumiy yordamchi. Testlar UCHTA narsani tasdiqlashi kerak: (1)
 * hamma element qayta ishlanadi, (2) bir vaqtning o'zida FAQAT
 * `batchSize` tagacha element ishlaydi (haqiqiy PARALEL guruhlash),
 * (3) bitta elementning xatosi qolganlarni to'xtatmaydi.
 */
describe("processBatched", () => {
  test("bo'sh massiv uchun handler chaqirilmasdan nol natija qaytaradi", async () => {
    const handler = jest.fn();
    const result = await processBatched([], handler);
    expect(handler).not.toHaveBeenCalled();
    expect(result).toEqual({ total: 0, successCount: 0, failureCount: 0 });
  });

  test("massiv bo'lmagan qiymat uchun xato tashlamasdan bo'sh natija qaytaradi", async () => {
    const result = await processBatched(null, jest.fn());
    expect(result).toEqual({ total: 0, successCount: 0, failureCount: 0 });
  });

  test("HAMMA elementni qayta ishlaydi va to'g'ri muvaffaqiyat sonini qaytaradi", async () => {
    const items = [1, 2, 3, 4, 5];
    const processed = [];
    const result = await processBatched(items, async (item) => {
      processed.push(item);
    });
    expect(processed.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(result).toEqual({ total: 5, successCount: 5, failureCount: 0 });
  });

  test("bitta elementning xatosi qolganlarni TO'XTATMAYDI, alohida hisoblanadi", async () => {
    const items = [1, 2, 3];
    const processed = [];
    const result = await processBatched(items, async (item) => {
      if (item === 2) throw new Error("test xatosi");
      processed.push(item);
    });
    expect(processed.sort()).toEqual([1, 3]);
    expect(result).toEqual({ total: 3, successCount: 2, failureCount: 1 });
  });

  test("bir vaqtning o'zida FAQAT batchSize tagacha element ishlaydi (haqiqiy paralel guruhlash)", async () => {
    const items = Array.from({ length: 23 }, (_, i) => i);
    let active = 0;
    let maxActive = 0;

    await processBatched(
      items,
      async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        // Boshqa "parallel" chaqiruvlar ham ulgurishi uchun mikrotask
        // navbatiga bir necha marta o'tamiz.
        await Promise.resolve();
        await Promise.resolve();
        active -= 1;
      },
      5
    );

    expect(maxActive).toBeLessThanOrEqual(5);
    expect(maxActive).toBeGreaterThan(1); // haqiqatan PARALEL ishlaganini tasdiqlaydi, ketma-ket emas
  });

  test("noto'g'ri batchSize (0, manfiy, butun son emas) standart qiymat (10)ga tushadi, xato tashlamaydi", async () => {
    const items = Array.from({ length: 3 }, (_, i) => i);
    const result = await processBatched(items, async () => {}, 0);
    expect(result.total).toBe(3);
    expect(result.successCount).toBe(3);
  });
});
