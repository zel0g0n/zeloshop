import { describe, test, expect } from "vitest";
import { searchProducts } from "./smartSearch";
import { formatProductAttributesForDisplay } from "./formatProductAttributes";
import { buildAttributeFilterDefs } from "./attributeFilters";
import { getNicheConfig } from "@/config/niches";

/**
 * 15 TA NICHE UCHUN ALOHIDA, REALISTIK MAHSULOT STSENARIYLARI
 * (FRONTEND: qidiruv + atribut ko'rsatish + dinamik filtr).
 *
 * FARQI `smartSearch.test.js`/`attributeFilters.test.js`dan: o'sha
 * fayllar funksiyalarning UMUMIY (niche'dan mustaqil) xatti-harakatini
 * sinaydi. BU FAYL esa har bir 15 ta niche uchun BITTA ALOHIDA,
 * REALISTIK mahsulot (haqiqiy kategoriya, haqiqiy atribut, o'sha
 * niche'ning HAQIQIY sinonim guruhi) orqali, xaridor tomonidan
 * ko'rinadigan BUTUN oqimni tekshiradi:
 *
 *   1) QIDIRUV: xaridor BOSHQA TILDAGI (masalan ruscha/inglizcha)
 *      sinonim so'z bilan qidirsa ham, mahsulot topiladi
 *      (`config/niches.js`dagi `search.synonymGroups`).
 *   2) ATRIBUT KO'RSATISH: mahsulot sahifasida dinamik atribut
 *      (`product.attributes`) to'g'ri {label, value} juftligiga
 *      aylanadi.
 *   3) DINAMIK FILTR: katalogda shu atribut bo'yicha KAMIDA ikkita
 *      farqli qiymat bo'lsa, filtr paneli avtomatik shu atributni
 *      taklif qiladi (qattiq kodlangan UI'siz).
 */

const NICHE_SCENARIOS = [
  {
    nicheId: "Kosmetika",
    category: "Yuz parvarishi",
    productName: "Nam beruvchi yuz kremi, 50ml",
    attrKey: "skinType", valueA: "oily", valueB: "dry",
    synonymQuery: "крем",
  },
  {
    nicheId: "Kiyim-kechak",
    category: "Ko'ylaklar",
    productName: "Ayollar yozgi ko'ylagi",
    attrKey: "size", valueA: "M", valueB: "L",
    synonymQuery: "женский",
  },
  {
    nicheId: "Poyabzal",
    category: "Krossovkalar",
    productName: "Erkaklar sport krossovkasi",
    attrKey: "color", valueA: "qora", valueB: "oq",
    synonymQuery: "sneakers",
  },
  {
    nicheId: "Uy-ro'zg'or buyumlari",
    category: "Mebel",
    productName: "Yog'och oshxona stoli",
    attrKey: "material", valueA: "yog'och", valueB: "metall",
    synonymQuery: "кухня",
  },
  {
    nicheId: "Elektronika",
    category: "Smartfonlar",
    productName: "Smartfon Model X Pro, 256GB",
    attrKey: "storage", valueA: "256GB", valueB: "128GB",
    synonymQuery: "телефон",
  },
  {
    nicheId: "Bolalar tovarlari",
    category: "O'yinchoqlar",
    productName: "Bolalar uchun o'yinchoq mashina",
    attrKey: "color", valueA: "qizil", valueB: "sariq",
    synonymQuery: "игрушка",
  },
  {
    nicheId: "Zargarlik va aksessuarlar",
    category: "Uzuklar",
    productName: "Kumush ayol uzugi",
    attrKey: "metal", valueA: "kumush", valueB: "oltin",
    synonymQuery: "ring",
  },
  {
    nicheId: "Suvenir mahsulotlar",
    category: "Tug'ilgan kun sovg'alari",
    productName: "Tug'ilgan kun sovg'a to'plami",
    attrKey: "occasion", valueA: "tug'ilgan kun", valueB: "to'y",
    synonymQuery: "gift",
  },
  {
    nicheId: "Uy hayvonlari tovarlari",
    category: "It uchun",
    productName: "It uchun charm bo'yinbog'",
    attrKey: "animalType", valueA: "it", valueB: "mushuk",
    synonymQuery: "собака",
  },
  {
    nicheId: "Sport va faollik",
    category: "Trenajyorlar",
    productName: "Sport zali uchun trenajyor",
    attrKey: "sport", valueA: "fitnes", valueB: "yugurish",
    synonymQuery: "тренажер",
  },
  {
    nicheId: "Kitoblar",
    category: "Kitoblar",
    productName: "\"Sarguzasht\" romani",
    attrKey: "genre", valueA: "sarguzasht", valueB: "drama",
    synonymQuery: "книга",
  },
  {
    nicheId: "Avto ehtiyot qismlari",
    category: "Tormozlar",
    productName: "Old tormoz kolodkasi",
    attrKey: "brand", valueA: "Bosch", valueB: "TRW",
    synonymQuery: "brake",
  },
  {
    nicheId: "Asboblar va qurilish",
    category: "Elektr asboblar",
    productName: "Elektr drel, 800W",
    attrKey: "power", valueA: "800W", valueB: "500W",
    synonymQuery: "tool",
  },
  {
    nicheId: "Sumka va charm buyumlar",
    category: "Qo'l sumkalari",
    productName: "Ayollar charm qo'l sumkasi",
    attrKey: "material", valueA: "charm", valueB: "ekokoja",
    synonymQuery: "bag",
  },
  {
    nicheId: "O'yinchoqlar va xobbi",
    category: "Konstruktorlar",
    productName: "Lego konstruktor to'plami",
    attrKey: "brand", valueA: "Lego", valueB: "Sluban",
    synonymQuery: "конструктор",
  },
];

describe("15-NICHE UNIVERSAL PLATFORMA: har bir niche uchun REALISTIK mahsulot stsenariysi (qidiruv + atribut + filtr)", () => {
  test("MUHIM: bu ro'yxat ANIQ 15 ta niche'ni qamrab oladi (hech biri tashlab ketilmagan)", () => {
    expect(NICHE_SCENARIOS).toHaveLength(15);
    expect(new Set(NICHE_SCENARIOS.map((s) => s.nicheId)).size).toBe(15);
  });

  describe.each(NICHE_SCENARIOS)(
    "$nicheId: \"$productName\"",
    ({ nicheId, category, productName, attrKey, valueA, valueB, synonymQuery }) => {
      const productA = { id: "a", name: productName, category, isActive: true, stock: 5, attributes: { [attrKey]: valueA } };
      const productB = { id: "b", name: "Boshqa mahsulot", category, isActive: true, stock: 5, attributes: { [attrKey]: valueB } };

      test("1) QIDIRUV: BOSHQA TILDAGI (sinonim) so'z bilan qidirilsa ham, niche'ning HAQIQIY sinonim guruhi orqali mahsulot topiladi", () => {
        const nicheConfig = getNicheConfig(nicheId);
        const result = searchProducts([productA, productB], synonymQuery, nicheConfig.search.synonymGroups);
        expect(result.map((p) => p.id)).toContain("a");
      });

      test("2) ATRIBUT KO'RSATISH: mahsulot sahifasida dinamik atribut to'g'ri {label, value} juftligiga aylanadi", () => {
        const entries = formatProductAttributesForDisplay(productA.attributes);
        expect(entries).toHaveLength(1);
        expect(entries[0].key).toBe(attrKey);
        expect(entries[0].labelKey).toBe(`productAttributes.${attrKey}.label`);
        expect(entries[0].value).toBe(valueA);
      });

      test("3) DINAMIK FILTR: katalogda shu atribut bo'yicha IKKITA farqli qiymat bo'lgani uchun, filtr avtomatik taklif qilinadi", () => {
        const defs = buildAttributeFilterDefs(nicheId, [productA, productB]);
        const filterForAttr = defs.find((d) => d.key === attrKey);
        expect(filterForAttr).toBeDefined();
        expect(filterForAttr.options.map((o) => o.value)).toEqual(expect.arrayContaining([valueA, valueB]));
      });
    }
  );
});
