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
