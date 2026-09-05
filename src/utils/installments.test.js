import { describe, test, expect } from "vitest";
import { computeInstallmentAmounts } from "./installments";

describe("computeInstallmentAmounts", () => {
  test("summani berilgan songa TENG qismlarga bo'ladi (qoldiqsiz)", () => {
    expect(computeInstallmentAmounts(100000, 2)).toEqual([50000, 50000]);
  });

  test("teng bo'linmaydigan summada - OXIRGI qism qoldiqni o'ziga oladi", () => {
    expect(computeInstallmentAmounts(100000, 3)).toEqual([33333, 33333, 33334]);
  });

  test("yig'indi HAR DOIM asl summaga TENG bo'ladi (yaxlitlash xatosi yo'qoladi)", () => {
    const amounts = computeInstallmentAmounts(100001, 7);
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(100001);
    expect(amounts).toHaveLength(7);
  });

  test("1 qism so'ralsa - butun summani o'z ichiga olgan bitta elementli massiv qaytaradi", () => {
    expect(computeInstallmentAmounts(50000, 1)).toEqual([50000]);
  });

  test("noto'g'ri/manfiy qiymatlar uchun ham xato bermaydi (0/1ga yaxlitlaydi)", () => {
    expect(computeInstallmentAmounts(-500, 2)).toEqual([0, 0]);
    expect(computeInstallmentAmounts(100000, 0)).toEqual([100000]);
    expect(computeInstallmentAmounts(100000, -3)).toEqual([100000]);
  });
});
