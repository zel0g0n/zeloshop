/**
 * `lib/yandexDelivery.js` uchun testlar - ayniqsa YANGI qo'shilgan
 * `taxiClass` (tarif sinfi) parametrining to'g'ri yuborilishini
 * tekshirish uchun.
 *
 * KONTEKST: avval `taxi_class` HAR DOIM "express"ga qattiq yozilgan
 * edi (eng tezkor, eng qimmat tarif) - sotuvchi buni o'zgartira
 * olmasdi. Foydalanuvchi buni real hayotda solishtirib, "express"
 * narxi Yandex saytidagi oddiy "Yetkazish" (courier) tarifidan
 * SEZILARLI qimmat ekanini payqadi. Endi sotuvchi tarif sinfini
 * (`courier`/`express`/`cargo`) o'zi tanlashi mumkin, standart
 * qiymat esa "express" (avvalgi xatti-harakat o'zgarmagan bo'lishi
 * uchun).
 */

function loadModule(fetchMock) {
  jest.resetModules();
  global.fetch = fetchMock;
  return require("../lib/yandexDelivery");
}

function okFetch(body = {}) {
  return jest.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  });
}

describe("resolveTaxiClass (_testables orqali emas, to'g'ridan-to'g'ri eksport)", () => {
  test("to'g'ri qiymatlarni (courier/express/cargo) o'zgartirmasdan qaytaradi", () => {
    const { resolveTaxiClass } = loadModule(okFetch());
    expect(resolveTaxiClass("courier")).toBe("courier");
    expect(resolveTaxiClass("express")).toBe("express");
    expect(resolveTaxiClass("cargo")).toBe("cargo");
  });

  test("noto'g'ri/bo'sh/undefined qiymatlar uchun xavfsiz standart \"express\"ni qaytaradi", () => {
    const { resolveTaxiClass } = loadModule(okFetch());
    expect(resolveTaxiClass(undefined)).toBe("express");
    expect(resolveTaxiClass(null)).toBe("express");
    expect(resolveTaxiClass("")).toBe("express");
    expect(resolveTaxiClass("premium")).toBe("express");
  });
});

describe("calculateOffer - taxiClass so'rov tanasiga to'g'ri o'tishi", () => {
  test("taxiClass berilmasa, so'rovda \"express\" ishlatiladi (avvalgi xatti-harakat)", async () => {
    const fetchMock = okFetch({ price: "10000" });
    const { calculateOffer } = loadModule(fetchMock);

    await calculateOffer("token123", { lat: 41.3, lng: 69.2 }, { lat: 41.31, lng: 69.21 });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.requirements.taxi_class).toBe("express");
  });

  test("taxiClass=\"courier\" berilsa, so'rovda AYNAN shu qiymat ishlatiladi", async () => {
    const fetchMock = okFetch({ price: "5000" });
    const { calculateOffer } = loadModule(fetchMock);

    await calculateOffer("token123", { lat: 41.3, lng: 69.2 }, { lat: 41.31, lng: 69.21 }, {}, "courier");

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.requirements.taxi_class).toBe("courier");
  });

  test("noto'g'ri taxiClass qiymati (masalan yozuv xatosi) jim-jim \"express\"ga qaytariladi", async () => {
    const fetchMock = okFetch({ price: "10000" });
    const { calculateOffer } = loadModule(fetchMock);

    await calculateOffer("token123", { lat: 41.3, lng: 69.2 }, { lat: 41.31, lng: 69.21 }, {}, "not-a-real-class");

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.requirements.taxi_class).toBe("express");
  });
});

describe("createAndAcceptClaim - taxiClass client_requirements'ga to'g'ri o'tishi", () => {
  const claimArgs = {
    pickup: { contactName: "Do'kon", contactPhone: "+998901112233", address: "Toshkent", lat: 41.3, lng: 69.2 },
    dropoff: { contactName: "Mijoz", contactPhone: "+998904445566", address: "Toshkent", lat: 41.31, lng: 69.21 },
    items: [{ title: "Krem", quantity: 1, costValue: 50000 }],
    requestId: "order1-123",
  };

  test("taxiClass berilmasa, so'rovda \"express\" ishlatiladi", async () => {
    const fetchMock = okFetch({ id: "claim1", status: "new" });
    const { createAndAcceptClaim } = loadModule(fetchMock);

    await createAndAcceptClaim("token123", claimArgs);

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.client_requirements.taxi_class).toBe("express");
  });

  test("taxiClass=\"courier\" berilsa, haqiqiy da'vo yaratishda ham shu tarif ishlatiladi", async () => {
    const fetchMock = okFetch({ id: "claim2", status: "new" });
    const { createAndAcceptClaim } = loadModule(fetchMock);

    await createAndAcceptClaim("token123", { ...claimArgs, taxiClass: "courier" });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.client_requirements.taxi_class).toBe("courier");
  });
});
