import { describe, test, expect, beforeEach, vi } from "vitest";

const mockCallable = vi.fn();
vi.mock("firebase/functions", () => ({ httpsCallable: vi.fn(() => mockCallable) }));
vi.mock("@/firebase/config", () => ({ functions: {} }));

import { getVisitorCount } from "./getVisitorCount";
import { __resetAllCachesForTests } from "@/lib/cache/memoryCache";

describe("getVisitorCount", () => {
  beforeEach(() => {
    __resetAllCachesForTests();
    mockCallable.mockReset();
  });

  test("birinchi chaqiruv - Cloud Function'ni chaqiradi va natijani qaytaradi", async () => {
    mockCallable.mockResolvedValue({ data: { visitorCount: 42 } });
    const result = await getVisitorCount("seller-1", 7);
    expect(result).toBe(42);
    expect(mockCallable).toHaveBeenCalledTimes(1);
    expect(mockCallable).toHaveBeenCalledWith({ sellerId: "seller-1", daysBack: 7 });
  });

  test("XAVFSIZLIK/SAMARADORLIK: bir xil sellerId+daysBack uchun ketma-ket chaqiruv - Cloud Function QAYTA chaqirilmaydi (keshdan qaytadi)", async () => {
    mockCallable.mockResolvedValue({ data: { visitorCount: 100 } });

    const first = await getVisitorCount("seller-1", 7);
    const second = await getVisitorCount("seller-1", 7);

    expect(first).toBe(100);
    expect(second).toBe(100);
    expect(mockCallable).toHaveBeenCalledTimes(1);
  });

  test("XAVFSIZLIK (tenant isolation): har xil sellerId uchun ALOHIDA chaqiriladi, keshlar aralashmaydi", async () => {
    mockCallable.mockResolvedValueOnce({ data: { visitorCount: 10 } }).mockResolvedValueOnce({ data: { visitorCount: 20 } });

    const sellerA = await getVisitorCount("seller-A", 7);
    const sellerB = await getVisitorCount("seller-B", 7);

    expect(sellerA).toBe(10);
    expect(sellerB).toBe(20);
    expect(mockCallable).toHaveBeenCalledTimes(2);
  });

  test("har xil daysBack (masalan Hafta vs Oy) - ALOHIDA keshlanadi, aralashmaydi", async () => {
    mockCallable.mockResolvedValueOnce({ data: { visitorCount: 7 } }).mockResolvedValueOnce({ data: { visitorCount: 30 } });

    const weekly = await getVisitorCount("seller-1", 7);
    const monthly = await getVisitorCount("seller-1", 30);

    expect(weekly).toBe(7);
    expect(monthly).toBe(30);
    expect(mockCallable).toHaveBeenCalledTimes(2);
  });

  test("REQUEST DEDUPLICATION: parallel chaqiruvlar (masalan tabni tez-tez almashtirish) FAQAT BITTA so'rov yuboradi", async () => {
    let resolveCallable;
    mockCallable.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCallable = resolve;
        })
    );

    const call1 = getVisitorCount("seller-1", 7);
    const call2 = getVisitorCount("seller-1", 7);

    expect(mockCallable).toHaveBeenCalledTimes(1);
    resolveCallable({ data: { visitorCount: 55 } });

    const [result1, result2] = await Promise.all([call1, call2]);
    expect(result1).toBe(55);
    expect(result2).toBe(55);
    expect(mockCallable).toHaveBeenCalledTimes(1);
  });
});
