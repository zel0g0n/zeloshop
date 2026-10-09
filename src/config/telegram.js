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
 * MUHIM (2026-10, veb-kirish): `index.html` Telegram SDK skriptini
 * HAR DOIM yuklaydi, shuning uchun `window.Telegram.WebApp` obyekti
 * oddiy brauzerda ham mavjud bo'ladi — faqat uning `platform` maydoni
 * "unknown" bo'lib qoladi (haqiqiy Telegram mijozlari buni URL
 * parametri orqali "android"/"ios"/"tdesktop"/"web..." deb o'rnatadi,
 * va bu `initData`dan OLDIN, skript yuklanishi bilan darhol ma'lum
 * bo'ladi — "sovuq" ochilishda `initData` bir zumga bo'sh bo'lsa ham
 * adashmaydi). Shuning uchun: `initData` to'liq bo'lsa YOKI `platform`
 * "unknown" emas bo'lsa — Telegram ichidamiz.
 */
export const isRunningInTelegram = () => {
  const webApp = getTelegramWebApp();
  if (!webApp) return false;
  if (webApp.initData) return true;
  return Boolean(webApp.platform) && webApp.platform !== "unknown";
};

/**
 * Telegram havolasini (masalan "ulashish") ochadi: Telegram ichida —
 * uning o'z oynasi bilan, oddiy brauzerda — yangi tabda.
 */
export const openTelegramLinkSafe = (url) => {
  const webApp = getTelegramWebApp();
  if (isRunningInTelegram() && webApp?.openTelegramLink) {
    webApp.openTelegramLink(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};

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
 * Botning Telegram username'i (@ belgisisiz). Do'kon havolasini
 * yasash uchun kerak.
 * MUHIM: bot nomini o'zgartirsangiz, shu joyni ham yangilang.
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

/**
 * Telegram haptic (tebranish) signalini XAVFSIZ chaqiradi — kuryer
 * ilovasidagi "kichik qulayliklar" so'rovi bilan qo'shildi.
 *
 * MUHIM: bu — SOF QULAYLIK xususiyati. Eski Telegram mijozlarida
 * (yoki ilova oddiy brauzerda ochilganda) `HapticFeedback` obyekti
 * umuman mavjud bo'lmasligi mumkin — shuning uchun har doim optional
 * chaining + try/catch bilan o'raladi va xato chiqsa ham JIM
 * yutiladi (asosiy funksionallikka — masalan buyurtma holatini
 * yangilashga — HECH QANDAY ta'sir qilmasligi SHART).
 */
export const triggerHaptic = (kind = "impact", style) => {
  try {
    const haptic = getTelegramWebApp()?.HapticFeedback;
    if (!haptic) return;
    if (kind === "notification") haptic.notificationOccurred(style || "success");
    else if (kind === "selection") haptic.selectionChanged();
    else haptic.impactOccurred(style || "light");
  } catch {
    // sekundar (ikkinchi darajali) xususiyat — xato yutiladi
  }
};
