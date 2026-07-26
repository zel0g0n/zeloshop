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
 */
export const isRunningInTelegram = () => Boolean(getTelegramWebApp()?.initData);

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
