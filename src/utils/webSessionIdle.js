// Brauzer sessiyasi uchun HARAKATSIZLIK bo'yicha avtomatik chiqish
// (umumiy/begona kompyuterda panelni ochiq qoldirib ketish xavfiga qarshi).
// Sof funksiyalar — `SessionContext.jsx` va test shu yerdan foydalanadi.

export const WEB_IDLE_LIMIT_MS = 12 * 60 * 60 * 1000; // 12 soat
export const LAST_ACTIVE_STORAGE_KEY = "zeloshop_last_active";
export const ACTIVITY_WRITE_THROTTLE_MS = 30 * 1000;

export const isIdleExpired = (lastActiveMs, nowMs, limitMs = WEB_IDLE_LIMIT_MS) => {
  // Qiymat yo'q/yaroqsiz bo'lsa (birinchi kirish yoki o'chirilgan storage)
  // — muddati o'tgan deb HISOBLAMAYMIZ, aks holda yangi login darhol chiqib ketardi.
  if (!Number.isFinite(lastActiveMs) || lastActiveMs <= 0) return false;
  return nowMs - lastActiveMs > limitMs;
};

export const readLastActive = () => {
  try {
    return Number(localStorage.getItem(LAST_ACTIVE_STORAGE_KEY));
  } catch {
    return NaN;
  }
};

export const writeLastActive = (nowMs = Date.now()) => {
  try {
    localStorage.setItem(LAST_ACTIVE_STORAGE_KEY, String(nowMs));
  } catch {
    // storage mavjud emas — jim o'tamiz (faqat qulaylik/himoya qatlami)
  }
};

export const clearLastActive = () => {
  try {
    localStorage.removeItem(LAST_ACTIVE_STORAGE_KEY);
  } catch {
    // jim
  }
};
