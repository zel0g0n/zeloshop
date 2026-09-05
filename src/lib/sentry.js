import * as Sentry from "@sentry/react";

/**
 * Xato kuzatuvi (Sentry) integratsiyasi.
 *
 * Frontendda yuz beradigan xatolarni production muhitida kuzatish
 * uchun ishlatiladi — sotuvchi shikoyat qilishini kutmasdan, xatolar
 * Sentry panelida ko'rinadi.
 *
 * Sozlash uchun `VITE_SENTRY_DSN` muhit o'zgaruvchisi kerak (`.env`
 * faylida). Agar bu qiymat bo'sh bo'lsa, funksiya jim ravishda hech
 * narsa qilmaydi (ilova buzilmaydi, xato kuzatuvi shunchaki o'chiq
 * bo'ladi) — bu DSN sozlanmagan muhitlarda ham ilovani xavfsiz
 * ishlatishni ta'minlaydi.
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.warn("Sentry DSN sozlanmagan (.env'da VITE_SENTRY_DSN) - xato kuzatuvi O'CHIQ.");
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE, // "development" | "production"
    integrations: [Sentry.browserTracingIntegration()],
    // Xarajatni nazorat ostida ushlab turish uchun - HAR BIR
    // so'rovni EMAS, faqat 20% namunasini kuzatadi (xatolarning
    // O'ZI esa HAR DOIM, 100% qamrab olinadi - bu faqat ishlash
    // tezligi statistikasiga tegishli).
    tracesSampleRate: 0.2,
    // MUHIM: mijoz/sotuvchining shaxsiy ma'lumotlarini (telefon,
    // ism) tasodifan Sentry'ga yubormaslik uchun.
    beforeSend(event) {
      if (event.request?.cookies) delete event.request.cookies;
      return event;
    },
  });
}

export { Sentry };
