const { buildCooccurrenceMap, buildFrequentlyBoughtWithEntries } = require("../lib/productRecommendations");

describe("buildCooccurrenceMap", () => {
  test("bo'sh ro'yxat uchun bo'sh xarita qaytaradi", () => {
    expect(buildCooccurrenceMap([]).size).toBe(0);
    expect(buildCooccurrenceMap(undefined).size).toBe(0);
  });

  test("BITTA mahsulotli buyurtmani e'tiborga OLMAYDI (birga sotib olish degan narsa yo'q)", () => {
    const map = buildCooccurrenceMap([{ orders: [{ id: "a" }] }]);
    expect(map.size).toBe(0);
  });

  test("ikkita mahsulotli buyurtma - IKKALA yo'nalishda ham (a->b VA b->a) hisoblanadi", () => {
    const map = buildCooccurrenceMap([{ orders: [{ id: "a" }, { id: "b" }] }]);
    expect(map.get("a").get("b")).toBe(1);
    expect(map.get("b").get("a")).toBe(1);
  });

  test("bir necha buyurtmada TAKRORLANGAN juftlik - sanog'i to'g'ri oshadi", () => {
    const orders = [
      { orders: [{ id: "a" }, { id: "b" }] },
      { orders: [{ id: "a" }, { id: "b" }] },
      { orders: [{ id: "a" }, { id: "c" }] },
    ];
    const map = buildCooccurrenceMap(orders);
    expect(map.get("a").get("b")).toBe(2);
    expect(map.get("a").get("c")).toBe(1);
  });

  test("BITTA buyurtma ichida BIR XIL mahsulot ikki marta (miqdor) bo'lsa - FAQAT bir marta hisoblanadi", () => {
    const map = buildCooccurrenceMap([{ orders: [{ id: "a" }, { id: "a" }, { id: "b" }] }]);
    expect(map.get("a").get("b")).toBe(1);
  });

  test("uchta mahsulotli buyurtma - BARCHA juftliklar hisoblanadi", () => {
    const map = buildCooccurrenceMap([{ orders: [{ id: "a" }, { id: "b" }, { id: "c" }] }]);
    expect(map.get("a").get("b")).toBe(1);
    expect(map.get("a").get("c")).toBe(1);
    expect(map.get("b").get("c")).toBe(1);
  });

  test("noto'g'ri/bo'sh `orders` maydoni bo'lgan buyurtmani xatosiz o'tkazib yuboradi", () => {
    expect(() => buildCooccurrenceMap([{ orders: null }, {}, { orders: [{ id: "a" }, { id: "b" }] }])).not.toThrow();
  });
});

describe("buildFrequentlyBoughtWithEntries", () => {
  test("har bir mahsulot uchun ENG KO'P uchragan juftlikni birinchi qatorga qo'yadi", () => {
    const cooccurrence = new Map([
      ["a", new Map([["b", 5], ["c", 10], ["d", 1]])],
    ]);
    const entries = buildFrequentlyBoughtWithEntries(cooccurrence);
    expect(entries.get("a")).toEqual([
      { productId: "c", count: 10 },
      { productId: "b", count: 5 },
      { productId: "d", count: 1 },
    ]);
  });

  test("maxPerProduct chegarasini hurmat qiladi", () => {
    const cooccurrence = new Map([
      ["a", new Map([["b", 5], ["c", 10], ["d", 1], ["e", 8], ["f", 3], ["g", 2]])],
    ]);
    const entries = buildFrequentlyBoughtWithEntries(cooccurrence, { maxPerProduct: 2 });
    expect(entries.get("a")).toHaveLength(2);
    expect(entries.get("a")).toEqual([{ productId: "c", count: 10 }, { productId: "e", count: 8 }]);
  });
});
