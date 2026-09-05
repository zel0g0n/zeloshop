/**
 * "Sellerga vaqt sotamiz" - `functions/aiCeo.js`ning
 * `computeTimeSavedMinutes` natijasini ("X daqiqa") o'qish uchun
 * qulay matnga o'giradi. Sof funksiya - to'g'ridan-to'g'ri test
 * qilinadi, React komponentidan alohida (`react-refresh/only-export-components`
 * qoidasiga tegmaslik uchun ham - komponent fayli faqat komponent
 * eksport qilishi kerak).
 *
 * @param {number} totalMinutes
 * @param {(key: string, params?: object) => string} t - LanguageContext'ning tarjima funksiyasi
 */
export function formatTimeSaved(totalMinutes, t) {
  const minutes = Math.max(0, Math.round(Number(totalMinutes) || 0));
  if (minutes < 60) return t("aiCeo.timeSavedMinutes", { count: minutes });
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0
    ? t("aiCeo.timeSavedHoursMinutes", { hours, minutes: remainder })
    : t("aiCeo.timeSavedHours", { count: hours });
}
