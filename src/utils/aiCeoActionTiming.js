// AI CEO'ning tasdiq kutayotgan harakati kartasi (`AiCeoActionCard.jsx`,
// `InboxPage.jsx` va Biznes Buyruq Markazida ishlatiladi) uchun sof
// vaqt-formatlash yordamchilari — komponentlardan ALOHIDA, oddiy
// funksiyalar (React Fast Refresh — komponent bo'lmagan eksportlarni
// komponent faylida ushlab turishni yoqtirmaydi, shuning uchun bu yerga
// chiqarildi).
export const timeAgo = (ts, t) => {
  if (!ts) return "";
  const ms = ts.toMillis ? ts.toMillis() : new Date(ts).getTime();
  const diffMin = Math.floor((Date.now() - ms) / 60000);
  if (diffMin < 60) return t("notificationsInfo.minutesAgo", { count: Math.max(diffMin, 1) });
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return t("notificationsInfo.hoursAgo", { count: diffHour });
  const diffDay = Math.floor(diffHour / 24);
  return t("notificationsInfo.daysAgo", { count: diffDay });
};

// `expiresAtMs` (48 soatlik standart muddat, `lib/aiApprovalEngine.js`)
// asosida qolgan vaqtni inson o'qiydigan shaklda hisoblaydi - faqat
// hali hal qilinmagan ("pending") harakatlar uchun mazmunli.
export function expiryLabel(expiresAtMs, t) {
  if (!Number.isFinite(expiresAtMs)) return null;
  const remainingMs = expiresAtMs - Date.now();
  if (remainingMs <= 0) return t("inbox.expiresExpired");
  const hours = Math.max(1, Math.round(remainingMs / (60 * 60 * 1000)));
  return t("inbox.expiresInHours", { hours });
}
