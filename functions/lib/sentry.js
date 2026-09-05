const Sentry = require("@sentry/google-cloud-serverless");
const { defineSecret } = require("firebase-functions/params");

/**
 * BACKEND XATO KUZATUVI (Sentry) — YANGI QO'SHIMCHA.
 *
 * MUHIM: agar `SENTRY_DSN` sekret (secret) sozlanmagan bo'lsa,
 * funksiya JIM ravishda HECH NARSA QILMAYDI - bu, DSN olinmagunga
 * qadar, funksiyalarning XAVFSIZ ishlashini ta'minlaydi.
 */
const SENTRY_DSN = defineSecret("SENTRY_DSN");
let initialized = false;

function initSentry() {
  if (initialized) return;
  const dsn = SENTRY_DSN.value();
  if (!dsn) return;
  Sentry.init({ dsn, tracesSampleRate: 0.1 });
  initialized = true;
}

/**
 * `onCall`/`onSchedule`/`onRequest` funksiyalarini SHU BILAN O'RAB
 * olish - ICHIDA yuz bergan HAR QANDAY ushlanmagan xato, mijozga
 * qaytarilishidan OLDIN, AVTOMATIK ravishda Sentry'ga yuboriladi.
 * Bu, HAR BIR funksiyaga qo'lda `try/catch` + `Sentry.captureException`
 * yozishning o'rnini bosadi.
 *
 * KENGAYTIRISH (2026-09 audit, "logging/monitoring" bo'limi): oldin
 * bu funksiya FAQAT bitta argument (`request`) qabul qilardi - bu
 * `onCall`/`onSchedule` uchun to'g'ri edi (ular haqiqatda bitta
 * argument bilan chaqiriladi), LEKIN `onRequest` (Telegram bot
 * webhook'lari — `courierBot.js`, `staffBot.js`, `telegramApproval.js`
 * va h.k.) IKKITA argument bilan chaqiriladi: `(req, res)`. Agar
 * eski bir-argumentli wrapper ularga qo'llanilsa, `res` ICHKI
 * handler'ga UMUMAN YETIB BORMAS EDI — handler `res.status(...)`
 * chaqirmoqchi bo'lganda "Cannot read properties of undefined"
 * bilan qulab tushardi. Shuning uchun endi `...args` (spread) orqali
 * QANCHA argument kelsa ham, HAMMASI o'zgarishsiz handler'ga
 * uzatiladi - bir xil wrapper barcha uchta turdagi (`onCall`,
 * `onSchedule`, `onRequest`) funksiyaga xavfsiz qo'llanadi.
 * `request?.auth?.uid` esa faqat BIRINCHI argument haqiqatda
 * shunday shaklga ega bo'lganda (onCall) foydali bo'ladi - boshqa
 * turlar uchun bu shunchaki `undefined` bo'lib qoladi, xatoga sabab
 * bo'lmaydi (optional chaining orqali xavfsiz).
 */
function withSentry(handler) {
  return async (...args) => {
    initSentry();
    try {
      return await handler(...args);
    } catch (err) {
      if (initialized) {
        Sentry.captureException(err, { extra: { uid: args[0]?.auth?.uid || null } });
      }
      throw err; // MUHIM: xatoni Sentry'ga yuborgandan KEYIN ham,
      // asl xatti-harakat o'zgarmasligi uchun QAYTA TASHLANADI -
      // mijoz hamon to'g'ri xato xabarini oladi.
    }
  };
}

module.exports = { initSentry, withSentry, Sentry, SENTRY_DSN };
