/**
 * Leaflet (bepul, API kalitisiz xarita kutubxonasi) ni JONLI
 * yuklaydigan UMUMIY funksiya - avval bu faqat `LocationPickerModal.jsx`
 * ichida takrorlanmas holda yozilgan edi, endi YANGI xarita
 * ehtiyoji (`YandexDeliveryPage.jsx`dagi kuzatish xaritasi) uchun
 * ham ishlatilishi kerak bo'lgani sababli, KODNI TAKRORLAMASLIK
 * uchun shu YAGONA joyga chiqarildi.
 */
const LEAFLET_CSS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
const LEAFLET_JS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";

let leafletLoadPromise = null;

export const loadLeaflet = () => {
  if (window.L) return Promise.resolve(window.L);
  if (leafletLoadPromise) return leafletLoadPromise;

  leafletLoadPromise = new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.body.appendChild(script);
  });

  return leafletLoadPromise;
};

// XARITA PLITKALARI (2026-10 TUZATISH): CARTO'ning bepul "basemaps"
// plitkalari (Voyager / Dark Matter) endi API kalit talab qiladi —
// ular XATO QAYTARMAYDI, balki har bir plitka ustiga "API KEY REQUIRED"
// suv belgisi chizilgan rasm qaytaradi (shuning uchun avvalgi
// "xato bo'lsa zaxiraga o'tish" mantig'i ham ishlamadi: plitka
// "muvaffaqiyatli" yuklangan hisoblandi) va xarita foydalanib bo'lmas
// holga keldi.
//
// ENDI: kalitsiz, barqaror OpenStreetMap standart plitkalari. Qorong'i
// rejimda plitka qatlamiga `app-map-tiles-dark` klassi beriladi
// (`styles/index.css`da CSS filtri bilan invert qilinadi) — alohida
// plitka serveri kerak emas.
const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export const getMapTileConfig = (isDark) => ({
  url: OSM_TILE_URL,
  attribution: OSM_ATTRIBUTION,
  className: isDark ? "app-map-tiles-dark" : "",
});

// Xarita plitka qatlamini yaratadi/yangilaydi — agar oldingi qatlam
// (masalan tema almashgani uchun) mavjud bo'lsa, avval o'shani
// xaritadan olib tashlaydi. `tileLayerRef` — chaqiruvchi komponentning
// useRef obyekti.
export const applyMapTileLayer = (L, map, tileLayerRef, isDark) => {
  if (tileLayerRef.current) {
    map.removeLayer(tileLayerRef.current);
  }
  const { url, attribution, className } = getMapTileConfig(isDark);
  const layer = L.tileLayer(url, {
    attribution,
    className,
    maxZoom: 19,
    detectRetina: true,
  }).addTo(map);
  tileLayerRef.current = layer;
  return layer;
};
