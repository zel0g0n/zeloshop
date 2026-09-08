// src/utils/authErrorClassifier.js
//
// 13/14-band ("Telegramda refresh qilsa chiqarib yuboradi" bug'i va
// "tarmoq xatoligida tizimdan chiqarmaslik" talabi) uchun MARKAZIY,
// React'dan MUSTAQIL sof mantiq. `SessionContext.jsx` shu yerdan
// foydalanadi — alohida faylga chiqarilishining sababi: `SessionContext.jsx`
// bitta komponent (`SessionProvider`) va bitta hook (`useSession`)dan
// tashqari narsa eksport qilsa, Fast Refresh (`react-refresh/only-export-
// components` ESLint qoidasi) buzilardi.

// Autentifikatsiya urinishlari orasidagi kutish oraliqlari (millisoniyalarda).
// Birinchi urinish darhol, keyingilari orasida biroz kutiladi — Telegram
// WebView'ning "sovuq" qayta yuklanishda `initData`ni to'ldirib ulgurishi
// yoki vaqtinchalik tarmoq muammosi tuzalishi uchun vaqt beriladi.
export const AUTH_RETRY_DELAYS_MS = [0, 1200, 2500];

/**
 * Xatolik TARMOQQA O'XSHASH (vaqtinchalik, qayta urinish bilan tuzaladigan)
 * ekanligini aniqlaydi — Telegram signature haqiqatan noto'g'ri bo'lgan
 * (doimiy, qayta urinish foyda bermaydigan) holatdan farqlash uchun.
 *
 * MUHIM: bu — 14-band talabi bo'yicha markaziy funksiya. Agar xatolik
 * shu yerda "tarmoqqa o'xshash" deb topilsa, foydalanuvchi HECH QACHON
 * "tizimdan chiqarilmaydi" — buning o'rniga sekin internet haqida
 * ogohlantiruvchi modal ko'rsatiladi (`SessionGate.jsx`dagi
 * `status === "network-error"` holati).
 */
export const isLikelyNetworkError = (err) => {
  if (!err) return false;
  // `initData` bo'sh chiqqanda `SessionContext.jsx` o'zi shu bayroqni
  // qo'yadi (Telegram WebView hali ma'lumotni to'ldirmagan bo'lishi mumkin).
  if (err.isNetworkLike) return true;

  const code = err.code || "";
  if (
    [
      "functions/unavailable",
      "functions/deadline-exceeded",
      "functions/internal",
      "functions/cancelled",
      "functions/resource-exhausted",
      "auth/network-request-failed",
    ].includes(code)
  ) {
    return true;
  }

  const msg = String(err.message || "").toLowerCase();
  return ["network", "failed to fetch", "timeout", "offline", "connection", "internet"].some((needle) =>
    msg.includes(needle)
  );
};
