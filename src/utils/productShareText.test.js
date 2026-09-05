import { describe, test, expect } from "vitest";
import { buildProductShareText } from "./productShareText";

describe("buildProductShareText", () => {
  test("chegirmasiz mahsulot uchun to'g'ri matn quradi", () => {
    const text = buildProductShareText({ name: "Krem", price: 100_000 });
    expect(text).toContain("Krem");
    expect(text).toContain("100,000 so'm");
    expect(text).not.toContain("~~");
  });

  test("chegirmali mahsulot uchun ESKI va YANGI narxni ko'rsatadi", () => {
    const text = buildProductShareText({ name: "Krem", price: 100_000, discountPrice: 70_000 });
    expect(text).toContain("70,000 so'm");
    expect(text).toContain("100,000 so'm");
  });

  test("uzun tavsifni QISQARTIRADI (100 belgidan keyin)", () => {
    const longDesc = "a".repeat(200);
    const text = buildProductShareText({ name: "Krem", price: 100_000, description: longDesc });
    expect(text).toContain("...");
    expect(text.length).toBeLessThan(longDesc.length + 100);
  });

  test("tavsif yo'q bo'lsa, xato bermaydi", () => {
    const text = buildProductShareText({ name: "Krem", price: 100_000 });
    expect(text).toBeTruthy();
  });

  test("discountPrice asl narxdan KATTA yoki TENG bo'lsa, chegirma sifatida hisoblanmaydi", () => {
    const text = buildProductShareText({ name: "Krem", price: 100_000, discountPrice: 100_000 });
    expect(text).not.toContain("~~");
  });
});
