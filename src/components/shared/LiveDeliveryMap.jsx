import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { loadLeaflet, applyMapTileLayer } from "@/utils/loadLeaflet";
import { useTheme } from "@/context/ThemeContext";

/**
 * QAYTA ISHLATILADIGAN jonli yetkazma xaritasi — `YandexDeliveryPage.jsx`
 * dagi Leaflet+OpenStreetMap naqshning O'ZI (bepul, API kalitisiz),
 * lekin UMUMIY komponentga chiqarilgan holda: buni HAM kuryer
 * ilovasi (o'zining "Jarayonda" bosqichida, kuryer o'ziga), HAM
 * mijozning kuzatuv sahifasi (`CourierTrackingPage.jsx`) ishlatadi —
 * ikkalasi ham AYNAN BIR XIL xarita mantig'iga muhtoj (manzil belgisi
 * + kuryerning jonli, vaqti-vaqti bilan yangilanadigan belgisi).
 *
 * `accentColor` — chaqiruvchi tomonning "o'z rangi" bilan mos kelishi
 * uchun (kuryer=teal, mijoz=blue) - loyihaning "har bir rol o'z
 * rangiga ega" konventsiyasi.
 *
 * YANGI (foydalanuvchi so'rovi): to'liq ekranga yoyish/qaytarish
 * tugmasi — xaritani ko'rish uchun kartochkani skrol qilish shart
 * bo'lmasligi uchun. `isFullscreen` FAQAT shu komponent ICHIDAGI
 * vizual holat (`position:fixed` overlay) — sahifaning qolgan qismi
 * o'zgarmaydi, shuning uchun `YandexDeliveryPage.jsx`da ILGARI
 * sinalgan va MUVAFFAQIYATSIZ bo'lgan "doimiy to'liq ekran tuzilishi"
 * BILAN ADASHTIRMASLIK KERAK - bu yerda fullscreen FAQAT bosilganda,
 * vaqtinchalik ustma-ust overlay sifatida ishga tushadi, asosiy
 * joylashuv (layout) HECH QACHON o'zgartirilmaydi. Leaflet'ga
 * konteyner o'lchami o'zgarganini bildirish uchun `invalidateSize()`
 * MAJBURIY (aks holda xarita eski o'lchamda "muzlab" qoladi/bo'sh
 * joylar chizilib qoladi) - CSS animatsiyasi tugashi uchun ozgina
 * kechikish bilan chaqiriladi.
 *
 * `expandLabel`/`collapseLabel` — chaqiruvchi tomon o'z tilidagi
 * (`useLanguage`) matnini beradi (bu komponentning o'zi TARJIMASIZ,
 * sof taqdimot komponenti sifatida qoladi - `accentColor` bilan BIR
 * XIL naqsh).
 */
const makeDivIcon = (L, bgColor, innerHtml) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${bgColor};width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid white;">${innerHtml}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

const BIKE_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`;

// YANGI: manzil belgisi endi harf ("M") EMAS, munosib joylashuv-pin
// ikonkasi (lucide "MapPin" bilan BIR XIL yo'l ma'lumotlari, xuddi
// yuqoridagi BIKE_SVG'ning "shaklga mos ikonka" naqshi bilan bir xil).
const PIN_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`;

const LiveDeliveryMap = ({ destination, courierPosition, accentColor = "#0d9488", height = 240, expandLabel = "Kattalashtirish", collapseLabel = "Kichraytirish" }) => {
  const { isDark } = useTheme();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const courierMarkerRef = useRef(null);
  const lineRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // XARITANI BIR MARTA ishga tushirish (manzil belgisi bilan).
  useEffect(() => {
    if (!destination?.lat || !containerRef.current || mapRef.current) return undefined;

    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current).setView([destination.lat, destination.lng], 14);
      applyMapTileLayer(L, map, tileLayerRef, isDark);
      mapRef.current = map;
      destMarkerRef.current = L.marker([destination.lat, destination.lng], {
        icon: makeDivIcon(L, "#10b981", PIN_SVG),
      }).addTo(map);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        tileLayerRef.current = null;
        destMarkerRef.current = null;
        courierMarkerRef.current = null;
        lineRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination?.lat, destination?.lng]);

  // TEMA (dark/light) foydalanuvchi tomonidan almashtirilsa — xarita
  // ALLAQACHON ochiq bo'lsa ham, plitka qatlamini mos ravishda
  // yangilaymiz (xaritani qaytadan yaratmasdan, faqat vizual uslub
  // almashadi — markerlar/hudud saqlanib qoladi).
  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    applyMapTileLayer(window.L, mapRef.current, tileLayerRef, isDark);
  }, [isDark]);

  // KURYER BELGISINI yangilash — xarita allaqachon mavjud bo'lganda,
  // har safar yangi joylashuv kelganda ishga tushadi.
  useEffect(() => {
    if (!courierPosition?.lat || !mapRef.current || !window.L) return;
    const L = window.L;

    if (courierMarkerRef.current) {
      courierMarkerRef.current.setLatLng([courierPosition.lat, courierPosition.lng]);
    } else {
      courierMarkerRef.current = L.marker([courierPosition.lat, courierPosition.lng], {
        icon: makeDivIcon(L, accentColor, BIKE_SVG),
      }).addTo(mapRef.current);
    }

    if (destMarkerRef.current) {
      const destLatLng = destMarkerRef.current.getLatLng();
      if (lineRef.current) mapRef.current.removeLayer(lineRef.current);
      lineRef.current = L.polyline(
        [[courierPosition.lat, courierPosition.lng], [destLatLng.lat, destLatLng.lng]],
        { color: accentColor, weight: 2, dashArray: "6,6", opacity: 0.6 }
      ).addTo(mapRef.current);
      mapRef.current.fitBounds(
        [[courierPosition.lat, courierPosition.lng], [destLatLng.lat, destLatLng.lng]],
        { padding: [30, 30] }
      );
    } else {
      mapRef.current.panTo([courierPosition.lat, courierPosition.lng]);
    }
  }, [courierPosition, accentColor]);

  // To'liq ekran holati o'zgarganda, Leaflet'ga konteyner o'lchami
  // o'zgarganini MAJBURIY bildiramiz - aks holda xarita eski
  // o'lchamdagi kabi chizilib qoladi (Leaflet'ning taniqli "container
  // resize" muammosi). CSS `transition`/layout joylashib bo'lishi
  // uchun ozgina kechikish bilan.
  useEffect(() => {
    if (!mapRef.current) return undefined;
    const id = setTimeout(() => mapRef.current?.invalidateSize(), 80);
    return () => clearTimeout(id);
  }, [isFullscreen]);

  return (
    <div className={isFullscreen ? "fixed inset-0 z-[999] bg-white dark:bg-slate-950" : "relative z-0 isolate overflow-hidden rounded-2xl"}>
      <div ref={containerRef} style={{ height: isFullscreen ? "100%" : height, width: "100%" }} />
      <button
        type="button"
        onClick={() => setIsFullscreen((v) => !v)}
        aria-label={isFullscreen ? collapseLabel : expandLabel}
        className="absolute top-2.5 right-2.5 z-[1000] w-8 h-8 rounded-full bg-white/95 dark:bg-slate-800/95 border border-gray-200 dark:border-slate-700 shadow-md flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-transform"
      >
        {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>
    </div>
  );
};

export default LiveDeliveryMap;
