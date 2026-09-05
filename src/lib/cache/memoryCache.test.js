import { describe, test, expect, beforeEach, vi } from "vitest";
import { createCache, __resetAllCachesForTests } from "./memoryCache";

describe("createCache", () => {
  beforeEach(() => {
    __resetAllCachesForTests();
    vi.useRealTimers();
  });

  test("cache miss holatida undefined qaytaradi", () => {
    const cache = createCache({ namespace: "test-miss" });
    expect(cache.get("k1")).toBeUndefined();
  });

  test("set/get - TTL tugamaguncha qiymatni saqlaydi", () => {
    const cache = createCache({ namespace: "test-set-get", defaultTtlMs: 60000 });
    cache.set("k1", { a: 1 });
    expect(cache.get("k1")).toEqual({ a: 1 });
  });

  test("TTL tugagach - qiymat avtomatik o'chadi (undefined qaytaradi)", () => {
    vi.useFakeTimers();
    const cache = createCache({ namespace: "test-ttl", defaultTtlMs: 1000 });
    cache.set("k1", "qiymat");
    expect(cache.get("k1")).toBe("qiymat");
    vi.advanceTimersByTime(1001);
    expect(cache.get("k1")).toBeUndefined();
    vi.useRealTimers();
  });

  test("invalidate - faqat ko'rsatilgan kalitni o'chiradi", () => {
    const cache = createCache({ namespace: "test-invalidate" });
    cache.set("k1", "a");
    cache.set("k2", "b");
    cache.invalidate("k1");
    expect(cache.get("k1")).toBeUndefined();
    expect(cache.get("k2")).toBe("b");
  });

  test("invalidatePrefix - mos prefiksli barcha kalitlarni o'chiradi (tenant-aware invalidation)", () => {
    const cache = createCache({ namespace: "test-prefix" });
    cache.set("shop:s1:products", ["p1"]);
    cache.set("shop:s1:categories", ["c1"]);
    cache.set("shop:s2:products", ["p2"]);
    cache.invalidatePrefix("shop:s1:");
    expect(cache.get("shop:s1:products")).toBeUndefined();
    expect(cache.get("shop:s1:categories")).toBeUndefined();
    expect(cache.get("shop:s2:products")).toEqual(["p2"]);
  });

  test("versiyalash - har xil version bir xil kalit uchun BIR-BIRIGA TA'SIR QILMAYDI", () => {
    const cacheV1 = createCache({ namespace: "test-version", version: "v1" });
    const cacheV2 = createCache({ namespace: "test-version", version: "v2" });
    cacheV1.set("k1", "eski-format");
    expect(cacheV2.get("k1")).toBeUndefined();
    cacheV2.set("k1", "yangi-format");
    expect(cacheV1.get("k1")).toBe("eski-format");
    expect(cacheV2.get("k1")).toBe("yangi-format");
  });

  test("namespace izolyatsiyasi - har xil namespace bir xil kalitni aralashtirmaydi", () => {
    const cacheA = createCache({ namespace: "test-ns-a" });
    const cacheB = createCache({ namespace: "test-ns-b" });
    cacheA.set("k1", "A");
    cacheB.set("k1", "B");
    expect(cacheA.get("k1")).toBe("A");
    expect(cacheB.get("k1")).toBe("B");
  });

  test("maxEntries - eng eski yozuvlar avtomatik chiqarib tashlanadi", () => {
    const cache = createCache({ namespace: "test-max-entries", maxEntries: 3 });
    cache.set("k1", 1);
    cache.set("k2", 2);
    cache.set("k3", 3);
    cache.set("k4", 4); // k1 chiqarib tashlanishi kerak
    expect(cache.get("k1")).toBeUndefined();
    expect(cache.get("k2")).toBe(2);
    expect(cache.get("k3")).toBe(3);
    expect(cache.get("k4")).toBe(4);
  });

  test("getOrFetch - cache hit bo'lsa fetchFn UMUMAN chaqirilmaydi", async () => {
    const cache = createCache({ namespace: "test-getorfetch-hit" });
    cache.set("k1", "keshlangan");
    const fetchFn = vi.fn().mockResolvedValue("serverdan");
    const result = await cache.getOrFetch("k1", fetchFn);
    expect(result).toBe("keshlangan");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("getOrFetch - cache miss bo'lsa fetchFn chaqiriladi va natija keshlanadi", async () => {
    const cache = createCache({ namespace: "test-getorfetch-miss" });
    const fetchFn = vi.fn().mockResolvedValue("serverdan");
    const result = await cache.getOrFetch("k1", fetchFn);
    expect(result).toBe("serverdan");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(cache.get("k1")).toBe("serverdan");
  });

  test("getOrFetch - REQUEST DEDUPLICATION: parallel chaqiruvlar FAQAT BITTA haqiqiy so'rov yuboradi", async () => {
    const cache = createCache({ namespace: "test-dedup" });
    let resolveFetch;
    const fetchFn = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    const call1 = cache.getOrFetch("k1", fetchFn);
    const call2 = cache.getOrFetch("k1", fetchFn);
    const call3 = cache.getOrFetch("k1", fetchFn);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    resolveFetch("natija");

    const results = await Promise.all([call1, call2, call3]);
    expect(results).toEqual(["natija", "natija", "natija"]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test("getOrFetch - fetchFn xato tashlasa, keshlanmaydi va keyingi chaqiruv qayta urinadi", async () => {
    const cache = createCache({ namespace: "test-getorfetch-error" });
    const fetchFn = vi.fn().mockRejectedValueOnce(new Error("tarmoq xatosi")).mockResolvedValueOnce("tuzaldi");

    await expect(cache.getOrFetch("k1", fetchFn)).rejects.toThrow("tarmoq xatosi");
    expect(cache.get("k1")).toBeUndefined();

    const result = await cache.getOrFetch("k1", fetchFn);
    expect(result).toBe("tuzaldi");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
