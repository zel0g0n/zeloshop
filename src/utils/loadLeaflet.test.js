import { describe, test, expect, vi } from "vitest";
import { applyMapTileLayer, getMapTileConfig } from "./loadLeaflet";

/**
 * Xarita plitkalari: CARTO API kalit talab qilib qo'ygani uchun
 * (plitkalar "API KEY REQUIRED" suv belgisi bilan keladi) kalitsiz
 * OpenStreetMap'ga qaytilgan. Bu testlar manba URL'i CARTO'ga
 * qaytib ketmasligini va qorong'i rejim klassini tekshiradi.
 */
const makeFakeLeaflet = () => {
  const layers = [];
  const L = {
    tileLayer: vi.fn((url, options) => {
      const layer = { url, options, addTo: vi.fn(() => layer) };
      layers.push(layer);
      return layer;
    }),
  };
  return { L, layers };
};

describe("getMapTileConfig", () => {
  test("yorug' va qorong'i rejimda ham kalitsiz OpenStreetMap ishlatiladi (CARTO emas)", () => {
    for (const isDark of [false, true]) {
      const { url } = getMapTileConfig(isDark);
      expect(url).toBe("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
      expect(url).not.toContain("cartocdn");
    }
  });

  test("faqat qorong'i rejimda invert klassi beriladi", () => {
    expect(getMapTileConfig(false).className).toBe("");
    expect(getMapTileConfig(true).className).toBe("app-map-tiles-dark");
  });
});

describe("applyMapTileLayer", () => {
  test("qatlam yaratilib xaritaga qo'shiladi va ref'ga yoziladi", () => {
    const { L, layers } = makeFakeLeaflet();
    const map = { removeLayer: vi.fn() };
    const ref = { current: null };
    const layer = applyMapTileLayer(L, map, ref, false);
    expect(layers).toHaveLength(1);
    expect(layer.addTo).toHaveBeenCalledWith(map);
    expect(ref.current).toBe(layer);
  });

  test("tema almashganda eski qatlam olib tashlanadi", () => {
    const { L, layers } = makeFakeLeaflet();
    const map = { removeLayer: vi.fn() };
    const ref = { current: null };
    const first = applyMapTileLayer(L, map, ref, false);
    applyMapTileLayer(L, map, ref, true);
    expect(map.removeLayer).toHaveBeenCalledWith(first);
    expect(layers[1].options.className).toBe("app-map-tiles-dark");
  });
});
