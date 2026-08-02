import { useEffect, useRef, useState } from "react";

const LEAFLET_CSS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
const LEAFLET_JS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";

// Toshkent markazi — standart boshlang'ich nuqta.
const DEFAULT_CENTER = { lat: 41.311081, lng: 69.240562 };

let leafletLoadPromise = null;
const loadLeaflet = () => {
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

/**
 * Xarita orqali joylashuv tanlash — qo'lda manzil yozish o'rniga
 * muqobil variant. Leaflet + OpenStreetMap ishlatiladi (bepul, hech
 * qanday API kalit talab qilmaydi).
 *
 * MUHIM: mapContainerRef ulangan DOM elementi ICHIGA hech qanday
 * React bola (children) chiqarilmaydi — Leaflet o'sha elementni
 * to'g'ridan-to'g'ri o'zi boshqaradi, va agar React ham o'sha yerga
 * biror narsa chiqarishga urinsa, ikkalasi orasida ziddiyat
 * (reconciliation xatosi) yuzaga kelishi mumkin. Shuning uchun
 * "yuklanmoqda" matni alohida, ustma-ust joylashgan qatlam sifatida
 * ko'rsatiladi.
 */
const LocationPickerModal = ({ initialLocation, onConfirm, onClose }) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState(initialLocation || DEFAULT_CENTER);

  useEffect(() => {
    let cancelled = false;

    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapContainerRef.current) return;

        const start = initialLocation || DEFAULT_CENTER;
        const map = L.map(mapContainerRef.current).setView([start.lat, start.lng], 13);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);

        const marker = L.marker([start.lat, start.lng], { draggable: true }).addTo(map);
        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          setSelected({ lat: pos.lat, lng: pos.lng });
        });
        map.on("click", (e) => {
          marker.setLatLng(e.latlng);
          setSelected({ lat: e.latlng.lat, lng: e.latlng.lng });
        });

        mapRef.current = map;
        markerRef.current = marker;
        setReady(true);

        // Agar oldindan tanlangan joylashuv bo'lmasa, foydalanuvchining
        // haqiqiy joylashuvini so'raymiz (ruxsat berilsa) — ruxsat
        // berilmasa, xarita shunchaki Toshkent markazida qoladi.
        if (!initialLocation && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (cancelled) return;
              const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              map.setView([loc.lat, loc.lng], 15);
              marker.setLatLng([loc.lat, loc.lng]);
              setSelected(loc);
            },
            () => {},
            { timeout: 5000 }
          );
        }
      })
      .catch(() => {
        // Xarita yuklanmasa (masalan internet muammosi) — modal ochiq
        // qoladi, foydalanuvchi "Bekor qilish"ni bosib qo'lda kiritish
        // rejimiga qaytishi mumkin.
      });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [initialLocation]);

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center">
      <div className="bg-white dark:bg-slate-900 w-full max-w-[440px] rounded-t-[28px] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-gray-800 dark:text-white">Joylashuvni belgilang</h3>
          <button type="button" onClick={onClose} className="text-gray-400 dark:text-slate-500 text-lg leading-none">✕</button>
        </div>

        <div className="relative w-full h-[360px] bg-gray-100 dark:bg-slate-800">
          <div ref={mapContainerRef} className="w-full h-full" />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 dark:text-slate-500 pointer-events-none">
              Xarita yuklanmoqda...
            </div>
          )}
        </div>

        <p className="px-4 pt-3 text-[11px] text-gray-400 dark:text-slate-500 text-center">
          Xaritaga bosing yoki belgini suring — aniq joyni ko'rsating
        </p>

        <div className="p-4">
          <button
            type="button"
            disabled={!ready}
            onClick={() => onConfirm(selected)}
            className="w-full h-12 bg-blue-600 text-white font-bold rounded-2xl text-sm disabled:opacity-50"
          >
            Joylashuvni tasdiqlash
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationPickerModal;
