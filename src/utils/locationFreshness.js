import { toMillis } from "./firestoreTime";

/**
 * KURYERNING jonli joylashuvi — Telegram Mini App'ning tabiiy chegarasi
 * tufayli — FAQAT ilova OCHIQ turgan paytda yangilanadi (fon rejimida
 * GPS kuzatuvi ISHLAMAYDI, brauzer sahifasi kabi). Foydalanuvchiga
 * (kuryerning o'ziga HAM, mijozga HAM) buni SOXTA "jonli" ko'rsatish
 * o'rniga, xaritadagi nuqta QANCHALIK YANGI ekanligini OCHIQ
 * ko'rsatish — kuryer ilovani yopib qo'ygan yoki tarmoq yo'qolgan
 * holatda, foydalanuvchi "xarita buzilgan" deb o'ylamasligi uchun.
 *
 * Chegaralar geolokatsiya so'rovi taxminan har 8 soniyada bir marta
 * yuborilishiga asoslangan (`geolocation.js`dagi `watchCourierLocation`) —
 * shuning uchun "fresh" chegarasi ancha zaxira bilan (30s) o'rnatilgan,
 * bitta-ikkita o'tkazib yuborilgan so'rovni HAM "eskirgan" deb
 * ko'rsatib qo'ymaslik uchun.
 */
export const LOCATION_FRESH_MS = 30000; // ~30 soniya
export const LOCATION_STALE_MS = 120000; // ~2 daqiqa

/**
 * `courierLocation.updatedAt`dan hozirgi vaqtgacha o'tgan millisoniya.
 * Joylashuv umuman yozilmagan bo'lsa (`updatedAt` yo'q/noto'g'ri) —
 * `null` qaytaradi ("hali umuman aniqlanmagan", "eskirgan"dan FARQLI
 * holat — chaqiruvchi buni alohida ko'rsatishi kerak).
 */
export const getLocationAgeMs = (updatedAt) => {
  const ms = toMillis(updatedAt);
  if (ms === null) return null;
  return Math.max(0, Date.now() - ms);
};

/**
 * Uchta holatdan birini qaytaradi:
 * - "unknown" — joylashuv HALI UMUMAN kelmagan (masalan "Boshlash"
 *   bosilgandan keyin birinchi GPS o'qishi hali yetib kelmagan).
 * - "fresh" — yaqinda yangilangan, xaritaga to'liq ishonish mumkin.
 * - "stale" — biroz eskirgan (masalan kuryer tarmoqni yo'qotgan),
 *   ogohlantirish ko'rsatiladi, lekin oxirgi ma'lum joylashuv baribir
 *   foydali.
 * - "very_stale" — ancha eskirgan (2 daqiqadan ko'p) — kuryer
 *   ilovani yopgan bo'lishi extremely ehtimoli, foydalanuvchiga buni
 *   ANIQ aytish kerak.
 */
export const getLocationFreshness = (updatedAt) => {
  const age = getLocationAgeMs(updatedAt);
  if (age === null) return "unknown";
  if (age <= LOCATION_FRESH_MS) return "fresh";
  if (age <= LOCATION_STALE_MS) return "stale";
  return "very_stale";
};
