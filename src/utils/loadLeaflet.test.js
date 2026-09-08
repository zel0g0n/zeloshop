import { describe, test, expect, vi } from "vitest";
import { applyMapTileLayer } from "./loadLeaflet";

/**
 * `applyMapTileLayer`ning ZAXIRA (fallback) mantig'i uchun testlar
 * (2026-09, foydalanuvchi xabari: "Telegramda xarita HAR DOIM bo'sh
 * chiqadi, CARTO plitkalariga o'tgandan keyin"). Haqiqiy Leaflet
 * kutubxonasi (va tarmoq) shart emas - `L.tileLayer`ni soxta
 * (mock) obyekt bilan almashtirib, faqat mantiqni (necha marta
 * xato bo'lsa zaxiraga o'tish) tekshiramiz.
 */
const makeFakeLeaflet = () => {
  const createdLayers = [];

  const L = {
    tileLayer: vi.fn((url, options) => {
      const handlers = {};
      const layer = {
        url,
        options,
        on: vi.fn((event, cb) => {
          handlers[event] = cb;
          return layer;
        }),
        addTo: vi.fn((map) => {
          layer.addedToMap = map;
          return layer;
        }),
        // Test yordamchisi - haqiqiy Leaflet'da yo'q, faqat shu yerda
        // tegishli hodisani qo'lda "otish" uchun.
        __fire: (event) => handlers[event]?.(),
      };
      createdLayers.push(layer);
      return layer;
    }),
  };

  return { L, createdLayers };
};

const makeFakeMap = () => ({
  removeLayer: vi.fn(),
});

describe("applyMapTileLayer", () => {
  test("plitka muvaffaqiyatli yuklansa (tileload), zaxiraga o'tilmaydi", () => {
    const { L, createdLayers } = makeFakeLeaflet();
    const map = makeFakeMap();
    const tileLayerRef = { current: null };

    applyMapTileLayer(L, map, tileLayerRef, false);
    expect(createdLayers).toHaveLength(1);

    const primaryLayer = createdLayers[0];
    primaryLayer.__fire("tileload");
    // Bir nechta xato kelsa ham, avval MUVAFFAQIYATLI yuklanish
    // bo'lgani uchun zaxiraga o'tilmasligi kerak.
    primaryLayer.__fire("tileerror");
    primaryLayer.__fire("tileerror");
    primaryLayer.__fire("tileerror");
    primaryLayer.__fire("tileerror");

    expect(map.removeLayer).not.toHaveBeenCalled();
    expect(createdLayers).toHaveLength(1);
    expect(tileLayerRef.current).toBe(primaryLayer);
  });

  test("1-2 ta plitka xatosi (hali chegaraga yetmagan) zaxirani ishga tushirmaydi", () => {
    const { L, createdLayers } = makeFakeLeaflet();
    const map = makeFakeMap();
    const tileLayerRef = { current: null };

    applyMapTileLayer(L, map, tileLayerRef, false);
    const primaryLayer = createdLayers[0];

    primaryLayer.__fire("tileerror");
    primaryLayer.__fire("tileerror");

    expect(map.removeLayer).not.toHaveBeenCalled();
    expect(createdLayers).toHaveLength(1);
  });

  test("3 marta ketma-ket xato (birorta ham muvaffaqiyatli yuklanmasdan) OpenStreetMap zaxirasiga o'tkazadi", () => {
    const { L, createdLayers } = makeFakeLeaflet();
    const map = makeFakeMap();
    const tileLayerRef = { current: null };

    applyMapTileLayer(L, map, tileLayerRef, false);
    const primaryLayer = createdLayers[0];

    primaryLayer.__fire("tileerror");
    primaryLayer.__fire("tileerror");
    primaryLayer.__fire("tileerror");

    // Asosiy (CARTO) qatlam xaritadan olib tashlangan bo'lishi kerak.
    expect(map.removeLayer).toHaveBeenCalledWith(primaryLayer);
    // Zaxira sifatida IKKINCHI (yangi) qatlam yaratilgan bo'lishi kerak.
    expect(createdLayers).toHaveLength(2);
    const fallbackLayer = createdLayers[1];
    expect(fallbackLayer.url).toBe("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
    expect(fallbackLayer.addedToMap).toBe(map);
    expect(tileLayerRef.current).toBe(fallbackLayer);
  });

  test("zaxiraga faqat BIR MARTA o'tiladi (qo'shimcha xatolar takroriy almashtirmaydi)", () => {
    const { L, createdLayers } = makeFakeLeaflet();
    const map = makeFakeMap();
    const tileLayerRef = { current: null };

    applyMapTileLayer(L, map, tileLayerRef, false);
    const primaryLayer = createdLayers[0];

    primaryLayer.__fire("tileerror");
    primaryLayer.__fire("tileerror");
    primaryLayer.__fire("tileerror");
    primaryLayer.__fire("tileerror");
    primaryLayer.__fire("tileerror");

    expect(map.removeLayer).toHaveBeenCalledTimes(1);
    expect(createdLayers).toHaveLength(2);
  });

  test("tungi (dark) rejimda ham CARTO xato bersa OpenStreetMap zaxirasiga o'tadi", () => {
    const { L, createdLayers } = makeFakeLeaflet();
    const map = makeFakeMap();
    const tileLayerRef = { current: null };

    applyMapTileLayer(L, map, tileLayerRef, true);
    const primaryLayer = createdLayers[0];
    expect(primaryLayer.url).toContain("dark_matter");

    primaryLayer.__fire("tileerror");
    primaryLayer.__fire("tileerror");
    primaryLayer.__fire("tileerror");

    expect(createdLayers[1].url).toBe("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
  });
});
