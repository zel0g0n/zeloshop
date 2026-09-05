import { describe, it, expect } from "vitest";
import { computeLowStockSignal, computeSoldCountSignal, computeTodaySoldSignal } from "./productSignals";

describe("computeLowStockSignal", () => {
  it("qoldiq 0 bo'lsa - null qaytaradi (bu 'tugagan' holat, boshqacha ko'rsatiladi)", () => {
    expect(computeLowStockSignal(0)).toBeNull();
  });

  it("qoldiq chegaradan (5) yuqori bo'lsa - null qaytaradi", () => {
    expect(computeLowStockSignal(6)).toBeNull();
    expect(computeLowStockSignal(100)).toBeNull();
  });

  it("qoldiq 1 dan 5 gacha bo'lsa - haqiqiy sonni qaytaradi", () => {
    expect(computeLowStockSignal(5)).toEqual({ count: 5 });
    expect(computeLowStockSignal(1)).toEqual({ count: 1 });
    expect(computeLowStockSignal(3)).toEqual({ count: 3 });
  });

  it("noto'g'ri/mavjud bo'lmagan qiymatlarda null qaytaradi", () => {
    expect(computeLowStockSignal(undefined)).toBeNull();
    expect(computeLowStockSignal(null)).toBeNull();
    expect(computeLowStockSignal("noto'g'ri")).toBeNull();
    expect(computeLowStockSignal(-2)).toBeNull();
  });

  it("kasr sonni pastga yaxlitlaydi (nazariy holat uchun himoya)", () => {
    expect(computeLowStockSignal(3.9)).toEqual({ count: 3 });
  });
});

describe("computeSoldCountSignal", () => {
  it("sotuv yo'q yoki juda kam bo'lsa - null qaytaradi (soxta '0+' yo'q)", () => {
    expect(computeSoldCountSignal(0)).toBeNull();
    expect(computeSoldCountSignal(5)).toBeNull();
    expect(computeSoldCountSignal(9)).toBeNull();
  });

  it("eng yaqin PASTGA yaxlitlangan chegarani qaytaradi", () => {
    expect(computeSoldCountSignal(10)).toEqual({ count: 10 });
    expect(computeSoldCountSignal(19)).toEqual({ count: 10 });
    expect(computeSoldCountSignal(20)).toEqual({ count: 20 });
    expect(computeSoldCountSignal(49)).toEqual({ count: 20 });
    expect(computeSoldCountSignal(51)).toEqual({ count: 50 });
    expect(computeSoldCountSignal(1500)).toEqual({ count: 1000 });
  });

  it("noto'g'ri qiymatlarni 0 sifatida ishlov beradi", () => {
    expect(computeSoldCountSignal(undefined)).toBeNull();
    expect(computeSoldCountSignal(null)).toBeNull();
    expect(computeSoldCountSignal("noto'g'ri")).toBeNull();
  });
});

describe("computeTodaySoldSignal", () => {
  // Toshkent vaqti bo'yicha 2026-09-02 kuniga to'g'ri keladigan
  // sobit vaqt (UTC+5, DST yo'q) - testlar bir xil natija berishi
  // uchun `Date.now()` o'rniga ANIQ vaqt ishlatiladi.
  const NOW_MS = new Date("2026-09-02T10:00:00Z").getTime(); // Toshkentda 15:00, 2026-09-02

  it("sana BUGUNGIDAN farqli bo'lsa (kecha yozilgan) - null qaytaradi", () => {
    expect(computeTodaySoldSignal(10, "2026-09-01", NOW_MS)).toBeNull();
  });

  it("sana umuman yo'q bo'lsa - null qaytaradi", () => {
    expect(computeTodaySoldSignal(10, undefined, NOW_MS)).toBeNull();
  });

  it("bugungi sana bo'lsa-yu, son chegaradan (3) kam bo'lsa - null qaytaradi (kuchsiz signal)", () => {
    expect(computeTodaySoldSignal(0, "2026-09-02", NOW_MS)).toBeNull();
    expect(computeTodaySoldSignal(2, "2026-09-02", NOW_MS)).toBeNull();
  });

  it("bugungi sana VA yetarlicha katta son bo'lsa - HAQIQIY (aniq, yaxlitlanmagan) sonni qaytaradi", () => {
    expect(computeTodaySoldSignal(3, "2026-09-02", NOW_MS)).toEqual({ count: 3 });
    expect(computeTodaySoldSignal(17, "2026-09-02", NOW_MS)).toEqual({ count: 17 });
  });

  it("noto'g'ri son qiymatlarida xato bermaydi", () => {
    expect(computeTodaySoldSignal("noto'g'ri", "2026-09-02", NOW_MS)).toBeNull();
    expect(computeTodaySoldSignal(null, "2026-09-02", NOW_MS)).toBeNull();
  });
});
