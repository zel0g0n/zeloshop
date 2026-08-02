// src/config/telegram.js
//
// Bitta joydan Telegram Web App (Mini App) ma'lumotlarini o'qiydigan yordamchi.
// Ilgari sellerId/clientId 8 xil faylda qo'lda yozilgan edi — bu esa
// har bir sotuvchi/mijoz uchun bitta xil (noto'g'ri) ma'lumot ko'rsatilishiga
// olib kelgan. Endi butun ilova shu yerdan foydalanadi (SessionContext orqali).

/**
 * Telegram WebApp obyektini xavfsiz qaytaradi (mavjud bo'lmasa null).
 */
export const getTelegramWebApp = () => {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp || null;
};

/**
 * Botni ishga tushirgan sotuvchi ID'sini aniqlaydi.
 * Bot start param orqali keladi: t.me/your_bot?start=SELLER_ID
 * (Telegram buni WebApp.initDataUnsafe.start_param ga joylaydi)
 */
export const getSellerIdFromTelegram = () => {
  const webApp = getTelegramWebApp();
  return webApp?.initDataUnsafe?.start_param || null;
};

/**
 * Joriy Telegram foydalanuvchisi haqidagi ma'lumot (mijoz sifatida).
 */
export const getTelegramUser = () => {
  const webApp = getTelegramWebApp();
  return webApp?.initDataUnsafe?.user || null;
};

/**
 * Ilova Telegram ichida ochilganmi yoki oddiy brauzerdami.
 *
 * OLDIN: bu funksiya `initData` bo'sh emasligini talab qilardi. Lekin
 * ba'zi Telegram mijozlarida (ayniqsa Desktop'da "sovuq" ochilishda)
 * `WebApp` obyekti allaqachon mavjud bo'lsa-da, `initData`ning o'zi
 * bir necha o'n millisoniyaga bo'sh bo'lib turishi mumkin — bu esa
 * ilovani "Telegram ichida emasmiz" deb noto'g'ri xulosaga keltirib,
 * zaxira (dev-fallback) rejimiga o'tkazib yuborardi. Endi faqat
 * `WebApp` obyektining mavjudligi tekshiriladi — bu ancha barqaror
 * signal, chunki u skript yuklanishi bilan darhol paydo bo'ladi.
 */
export const isRunningInTelegram = () => Boolean(getTelegramWebApp());

/**
 * `initData` hali bo'sh bo'lsa, uni bir necha marta (qisqa oraliqlar
 * bilan) qayta tekshiradi — Telegram uni to'ldirib ulguришини kutadi.
 * Odatda bu bir necha millisoniya ichida sodir bo'ladi.
 */
export const waitForInitData = async (maxAttempts = 20, delayMs = 100) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const webApp = getTelegramWebApp();
    if (webApp?.initData) return webApp.initData;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return getTelegramWebApp()?.initData || "";
};

/**
 * DEV / LOKAL TEST rejimi uchun zaxira ID'lar.
 * ⚠️ Bular faqat Telegram tashqarisida (masalan localhost'da) ishlaganda
 * ishlatiladi. Productionda WebApp.initData mavjud bo'lgani uchun ular
 * hech qachon ishlatilmaydi. Haqiqiy Firestore'dagi mavjud test
 * hujjatlariga mos keladi — shuning uchun loyihani localhost'da ochib
 * ko'rish darhol ishlaydi.
 */
export const DEV_FALLBACK_SELLER_ID = "yGsq7Cmn2C3IF103gtGm";
export const DEV_FALLBACK_CLIENT_ID = "QdPK91xipZh6c6JHaupV";

/**
 * Botning Telegram username'i (@ belgisisiz). Do'kon havolasini
 * yasash uchun kerak.
 * ⚠️ Bot nomini o'zgartirsangiz, shu joyni ham yangilang.
 */
export const BOT_USERNAME = "zeloshop_bot";

/**
 * BotFather'da `/newapp` orqali ro'yxatdan o'tkazilgan Mini App'ning
 * qisqa nomi (short name). Bu — oddiy `?startapp=` havolasi ishonchli
 * ishlashi uchun ZARUR bo'lgan qadam edi: faqat Menu Button
 * sozlangan bo'lsa, Telegram `start_param`ni ilova ichiga qo'ymaydi.
 * Havola shakli: t.me/BOT_USERNAME/APP_SHORT_NAME?startapp=qiymat
 */
export const APP_SHORT_NAME = "shop";
