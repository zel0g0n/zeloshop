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

// XARITA PLITKALARI (2026-09, foydalanuvchi so'rovi: "hamma joyda bir
// xil oddiy xarita ishlatganmiz, buning o'rniga zamonaviy batafsil
// xarita ishlatishimiz mumkinmi"): OLDIN uchala xarita komponenti ham
// klassik OpenStreetMap raster plitkalarini ("tile.openstreetmap.org")
// ishlatardi — bepul, lekin dizayni eskicha (xira ranglar, ingichka
// chiziqlar) va ILOVANING DARK REJIMIGA UMUMAN MOSLASHMASDI (xarita
// har doim och rangda qolardi). Endi CARTO'ning bepul, API kalitisiz
// plitkalariga o'tildi: "Voyager" (och rejim uchun — zamonaviy, tiniq,
// rangli) va "Dark Matter" (qorong'i rejim uchun — ilovaning `.dark`
// klassi bilan bir vaqtda almashadi). Bu YAGONA joyga chiqarilgan —
// uchala xarita komponenti (`LiveDeliveryMap.jsx`, `LocationPickerModal.jsx`,
// `YandexDeliveryPage.jsx`) ham shu funksiyani chaqiradi, KODNI
// TAKRORLAMASLIK uchun (`loadLeaflet`ning o'zi kabi).
export const getMapTileConfig = (isDark) => ({
  url: isDark
    ? "https://{s}.basemaps.cartocdn.com/rastertiles/dark_matter/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
});

// ZAXIRA (fallback) PLITKA MANBAI — klassik OpenStreetMap standart
// plitkalari. Bu — CARTO'ga o'tishdan OLDIN ishlatilgan, ishonchli
// manba (2026-09gacha barcha uch xarita komponentida shu ishlatilgan).
const FALLBACK_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const FALLBACK_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Nechta plitka RAD ETILGANDAN keyin (birorta ham MUVAFFAQIYATLI
// yuklanmagan holda) zaxira manbaga o'tish kerakligi. 1 emas - bitta
// tasodifiy/chekka plitka xatosi (masalan xarita chegarasidan tashqari)
// normal holat, lekin bir nechtasi ketma-ket rad etilishi CARTO'ning
// UMUMAN ishlamayotganidan darak beradi.
const FALLBACK_ERROR_THRESHOLD = 3;

// Xarita plitka qatlamini (tile layer) yaratadi/yangilaydi — agar
// oldingi qatlam (masalan tema almashgani uchun) mavjud bo'lsa, avval
// o'shani xaritadan olib tashlaydi. `tileLayerRef` — chaqiruvchi
// komponentning useRef obyekti (React re-render kutmasdan, to'g'ridan
// -to'g'ri Leaflet holatini boshqarish uchun).
//
// MUHIM TUZATISH (2026-09, foydalanuvchi xabari: "Telegramda xarita
// HAR DOIM bo'sh chiqadi, CARTO plitkalariga o'tgandan keyin buzildi"):
// CARTO'ning bepul plitka serveri (`basemaps.cartocdn.com`) Telegram
// ilovasi ICHIDA (aniq sabab - Telegram WebView'ning CSP'ni yoki
// tarmoq so'rovini boshqacha ishlashi - TASDIQLANMAGAN, lekin OQIBAT
// izchil) BARCHA foydalanuvchilarda DOIMIY ravishda ishlamay qolgan.
// Oddiy brauzerlarda buzilmasligi ham mumkin - shuning uchun bu FAQAT
// muayyan muhitlarga (masalan ba'zi WebView'lar) xos muammo bo'lishi
// mumkin.
//
// Aniq sababni tuzatish o'rniga (uni takrorlab, ishonchli aniqlash
// imkoni yo'q), BARDOSHLI (resilient) yechim tanlandi: plitka qatlami
// o'z-o'zini KUZATIB TURADI - agar bir nechta plitka RAD ETILSA-yu,
// birorta ham MUVAFFAQIYATLI yuklanmagan bo'lsa, AVTOMATIK ravishda
// ILGARI doim ishlab turgan, oddiy OpenStreetMap plitkalariga
// o'tkaziladi. Foydalanuvchi buni sezmaydi - xarita shunchaki HAR DOIM
// ko'rinadi, CARTO ishlasa - zamonaviy ko'rinishda, ishlamasa -
// klassik ko'rinishda.
export const applyMapTileLayer = (L, map, tileLayerRef, isDark) => {
  if (tileLayerRef.current) {
    map.removeLayer(tileLayerRef.current);
  }
  const { url, attribution } = getMapTileConfig(isDark);
  const layer = L.tileLayer(url, {
    attribution,
    maxZoom: 20,
    detectRetina: true,
  });

  let loadedAny = false;
  let errorCount = 0;
  let fallbackApplied = false;

  layer.on("tileload", () => {
    loadedAny = true;
  });

  layer.on("tileerror", () => {
    errorCount += 1;
    if (fallbackApplied || loadedAny || errorCount < FALLBACK_ERROR_THRESHOLD) return;
    fallbackApplied = true;
    map.removeLayer(layer);
    tileLayerRef.current = L.tileLayer(FALLBACK_TILE_URL, {
      attribution: FALLBACK_ATTRIBUTION,
      maxZoom: 19,
      detectRetina: true,
    }).addTo(map);
  });

  layer.addTo(map);
  tileLayerRef.current = layer;
  return layer;
};
