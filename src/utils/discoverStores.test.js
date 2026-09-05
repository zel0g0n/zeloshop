import { describe, test, expect } from "vitest";
import { filterVisibleStores, buildStoreSubtitle } from "./discoverStores";

describe("filterVisibleStores", () => {
  test("to'xtatilgan (suspended) do'konlarni chiqarib tashlaydi", () => {
    const stores = [
      { id: "a", storeName: "A", status: "active" },
      { id: "b", storeName: "B", status: "suspended" },
    ];
    expect(filterVisibleStores(stores).map((s) => s.id)).toEqual(["a"]);
  });

  test("nomi yo'q do'konlarni chiqarib tashlaydi", () => {
    const stores = [{ id: "a", storeName: "" }, { id: "b", storeName: "B" }];
    expect(filterVisibleStores(stores).map((s) => s.id)).toEqual(["b"]);
  });

  test("massiv bo'lmagan kirish uchun bo'sh massiv qaytaradi", () => {
    expect(filterVisibleStores(null)).toEqual([]);
    expect(filterVisibleStores(undefined)).toEqual([]);
  });

  test("status maydoni umuman bo'lmasa ham (yangi do'kon) ko'rsatiladi", () => {
    const stores = [{ id: "a", storeName: "A" }];
    expect(filterVisibleStores(stores)).toHaveLength(1);
  });
});

describe("buildStoreSubtitle", () => {
  test("kategoriya va hududni ' · ' bilan birlashtiradi", () => {
    expect(buildStoreSubtitle({ category: "Kosmetika", region: "Toshkent" })).toBe("Kosmetika · Toshkent");
  });

  test("faqat bittasi bo'lsa, ajratgichsiz qaytaradi", () => {
    expect(buildStoreSubtitle({ category: "Kosmetika" })).toBe("Kosmetika");
    expect(buildStoreSubtitle({ region: "Toshkent" })).toBe("Toshkent");
  });

  test("ikkalasi ham bo'lmasa, bo'sh qator qaytaradi", () => {
    expect(buildStoreSubtitle({})).toBe("");
  });
});
