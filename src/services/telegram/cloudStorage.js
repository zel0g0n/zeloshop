import { getTelegramWebApp } from "@/config/telegram";

// Telegram `CloudStorage` API Bot API 6.9'dan boshlab mavjud. Bundan
// eski Telegram mijozlarida (yoki ilova oddiy brauzerda ochilganda)
// bu obyekt umuman yo'q — shuning uchun har doim mavjudligini
// TEKSHIRISH SHART, aks holda xato tashlanadi.
const CLOUD_STORAGE_MIN_VERSION = "6.9";

/**
 * SENSITIV BO'LMAGAN, foydalanuvchi tanlagan sozlamalarni
 * (til, tema va h.k.) Telegram akkauntiga bog'lab saqlash uchun
 * yupqa yordamchi — bu orqali foydalanuvchi qurilmani almashtirsa
 * ham (masalan telefon -> kompyuter), sozlamalari saqlanib qoladi.
 *
 * MUHIM (xavfsizlik): bu yerda HECH QACHON sensitiv ma'lumot (token,
 * parol, moliyaviy ma'lumot) saqlanmasin — CloudStorage Telegram
 * tomonidan boshqariladi va bizning nazoratimizdan tashqarida.
 *
 * MUHIM (source of truth): bu FAQAT foydalanuvchi qulayligi uchun —
 * agar mavjud bo'lmasa (eski mijoz, brauzer, yoki Telegram API xatosi),
 * chaqiruvchi kod albatta boshqa manba (localStorage, standart qiymat)
 * bilan davom eta olishi kerak. Hech qachon bu yerga "majburiy"
 * ma'lumot joylashtirilmasin.
 */
function isCloudStorageAvailable() {
  const webApp = getTelegramWebApp();
  if (!webApp?.CloudStorage) return false;
  if (typeof webApp.isVersionAtLeast === "function") {
    return webApp.isVersionAtLeast(CLOUD_STORAGE_MIN_VERSION);
  }
  // `isVersionAtLeast` topilmasa (juda eski build) — xavfsiz tomonda
  // qolib, "mavjud emas" deb hisoblaymiz (localStorage'ga tushamiz).
  return false;
}

/** @param {string} key @returns {Promise<string|null>} */
export function getCloudStorageItem(key) {
  return new Promise((resolve) => {
    if (!isCloudStorageAvailable()) {
      resolve(null);
      return;
    }
    try {
      getTelegramWebApp().CloudStorage.getItem(key, (error, value) => {
        resolve(error ? null : value || null);
      });
    } catch {
      resolve(null);
    }
  });
}

/** @param {string} key @param {string} value @returns {Promise<boolean>} muvaffaqiyatli saqlandimi */
export function setCloudStorageItem(key, value) {
  return new Promise((resolve) => {
    if (!isCloudStorageAvailable()) {
      resolve(false);
      return;
    }
    try {
      getTelegramWebApp().CloudStorage.setItem(key, value, (error, success) => {
        resolve(Boolean(!error && success));
      });
    } catch {
      resolve(false);
    }
  });
}

export { isCloudStorageAvailable };
