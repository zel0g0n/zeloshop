import { describe, test, expect, beforeEach, vi } from "vitest";

vi.mock("./getProducts", () => ({ default: vi.fn() }));

import getProducts from "./getProducts";
import { subscribeSharedProducts, __resetProductsRegistryForTests } from "./liveProductsRegistry";

function buildFakeFirestoreProduct(sellerId) {
  let onSuccessCb;
  let onErrorCb;
  const unsubscribe = vi.fn();
  getProducts.mockImplementation((sid, onSuccess, onError) => {
    expect(sid).toBe(sellerId);
    onSuccessCb = onSuccess;
    onErrorCb = onError;
    return unsubscribe;
  });
  return {
    emitData: (products) => onSuccessCb(products),
    emitError: (error) => onErrorCb(error),
    unsubscribe,
  };
}

describe("subscribeSharedProducts", () => {
  beforeEach(() => {
    __resetProductsRegistryForTests();
    getProducts.mockReset();
  });

  test("sellerId bo'lmasa - Firestore'ga umuman murojaat qilmasdan bo'sh ro'yxat qaytaradi", () => {
    const onData = vi.fn();
    const unsubscribe = subscribeSharedProducts(null, onData);
    expect(onData).toHaveBeenCalledWith([]);
    expect(getProducts).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });

  test("bitta iste'molchi obuna bo'lsa - getProducts FAQAT BIR MARTA chaqiriladi", () => {
    const fake = buildFakeFirestoreProduct("seller-1");
    const onData = vi.fn();
    subscribeSharedProducts("seller-1", onData);
    expect(getProducts).toHaveBeenCalledTimes(1);

    fake.emitData([{ id: "p1" }]);
    expect(onData).toHaveBeenCalledWith([{ id: "p1" }]);
  });

  test("XAVFSIZLIK/SAMARADORLIK: bir xil sellerId'ga IKKI marta obuna bo'lsa, getProducts FAQAT BIR MARTA chaqiriladi (duplicate listener oldini olish)", () => {
    const fake = buildFakeFirestoreProduct("seller-1");
    const onDataA = vi.fn();
    const onDataB = vi.fn();

    subscribeSharedProducts("seller-1", onDataA);
    subscribeSharedProducts("seller-1", onDataB);

    // Ikkala "komponent" obuna bo'lgan bo'lsa ham, haqiqiy Firestore
    // tinglovchisi FAQAT BITTA marta ochilgan bo'lishi kerak.
    expect(getProducts).toHaveBeenCalledTimes(1);

    fake.emitData([{ id: "p1" }]);
    expect(onDataA).toHaveBeenCalledWith([{ id: "p1" }]);
    expect(onDataB).toHaveBeenCalledWith([{ id: "p1" }]);
  });

  test("kechroq qo'shilgan iste'molchi - ALLAQACHON mavjud ma'lumotni DARHOL (keyingi Firestore yangilanishini kutmasdan) oladi", async () => {
    const fake = buildFakeFirestoreProduct("seller-1");
    const onDataA = vi.fn();
    subscribeSharedProducts("seller-1", onDataA);
    fake.emitData([{ id: "p1" }]);

    const onDataB = vi.fn();
    subscribeSharedProducts("seller-1", onDataB);
    // Hali sinxron chaqirilmagan (microtask navbatida)
    expect(onDataB).not.toHaveBeenCalled();

    await Promise.resolve(); // microtask navbatini bo'shatish
    expect(onDataB).toHaveBeenCalledWith([{ id: "p1" }]);
    // Ikkinchi iste'molchi uchun YANGI Firestore tinglovchisi ochilmadi.
    expect(getProducts).toHaveBeenCalledTimes(1);
  });

  test("xato Firestore'dan kelsa - BARCHA iste'molchilarga uzatiladi", () => {
    const fake = buildFakeFirestoreProduct("seller-1");
    const onErrorA = vi.fn();
    const onErrorB = vi.fn();
    subscribeSharedProducts("seller-1", vi.fn(), onErrorA);
    subscribeSharedProducts("seller-1", vi.fn(), onErrorB);

    const err = new Error("tarmoq xatosi");
    fake.emitError(err);

    expect(onErrorA).toHaveBeenCalledWith(err);
    expect(onErrorB).toHaveBeenCalledWith(err);
  });

  test("REF-COUNT: bitta iste'molchi chiqib ketsa, boshqasi qolgan bo'lsa - haqiqiy Firestore tinglovchisi TO'XTATILMAYDI", () => {
    const fake = buildFakeFirestoreProduct("seller-1");
    const unsubA = subscribeSharedProducts("seller-1", vi.fn());
    subscribeSharedProducts("seller-1", vi.fn());

    unsubA();

    expect(fake.unsubscribe).not.toHaveBeenCalled();
  });

  test("REF-COUNT: BARCHA iste'molchilar chiqib ketsa - haqiqiy Firestore tinglovchisi TO'XTATILADI", () => {
    const fake = buildFakeFirestoreProduct("seller-1");
    const unsubA = subscribeSharedProducts("seller-1", vi.fn());
    const unsubB = subscribeSharedProducts("seller-1", vi.fn());

    unsubA();
    expect(fake.unsubscribe).not.toHaveBeenCalled();
    unsubB();
    expect(fake.unsubscribe).toHaveBeenCalledTimes(1);
  });

  test("barcha iste'molchilar chiqib ketgandan keyin YANGI obuna - YANGI Firestore tinglovchisini ochadi", () => {
    const fake1 = buildFakeFirestoreProduct("seller-1");
    const unsub = subscribeSharedProducts("seller-1", vi.fn());
    unsub();
    expect(fake1.unsubscribe).toHaveBeenCalledTimes(1);

    const fake2 = buildFakeFirestoreProduct("seller-1");
    subscribeSharedProducts("seller-1", vi.fn());
    expect(getProducts).toHaveBeenCalledTimes(2);
    expect(fake2).toBeDefined();
  });

  test("XAVFSIZLIK (tenant isolation): har xil sellerId'lar MUSTAQIL, alohida tinglovchiga ega", () => {
    const fakeA = buildFakeFirestoreProduct("seller-A");
    subscribeSharedProducts("seller-A", vi.fn());

    getProducts.mockReset();
    const fakeB = buildFakeFirestoreProduct("seller-B");
    subscribeSharedProducts("seller-B", vi.fn());

    expect(getProducts).toHaveBeenCalledTimes(1);
    expect(getProducts).toHaveBeenCalledWith("seller-B", expect.any(Function), expect.any(Function));
    // Ikkala seller ham hali obunada - biri ikkinchisiga ta'sir qilmagan.
    expect(fakeA.unsubscribe).not.toHaveBeenCalled();
    expect(fakeB.unsubscribe).not.toHaveBeenCalled();
  });
});
