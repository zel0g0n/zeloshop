// O'zbekiston telefon raqami uchun format/validatsiya.
// Format: +998 XX XXX XX XX (mamlakat kodidan keyin aniq 9 ta raqam).
// OLDIN: telefon input oddiy matn maydoni edi — foydalanuvchi xohlagancha
// uzun raqam kiritishi mumkin edi (masalan 100 ta raqam), formatlash yoki
// uzunlik chegarasi umuman yo'q edi.

const DIGITS_AFTER_CODE = 9; // 998 dan keyingi 9 ta raqam (XX XXX XX XX)

/** Foydalanuvchi kiritayotgan qiymatdan faqat raqamlarni ajratib oladi. */
const extractDigits = (value) => (value || "").replace(/\D/g, "");

/**
 * Xom kiritishni "+998 XX XXX XX XX" ko'rinishiga formatlaydi.
 * Ortiqcha raqamlar (9 tadan ko'p) kesib tashlanadi — shu bilan
 * "100 ta raqam kiritish" kabi holatning oldi tabiiy ravishda olinadi.
 */
export const formatUzPhone = (rawValue) => {
  let digits = extractDigits(rawValue);

  // Agar foydalanuvchi "998" bilan boshlagan bo'lsa, uni mamlakat kodi
  // sifatida hisoblab, qolganini asosiy raqam sifatida olamiz.
  if (digits.startsWith("998")) {
    digits = digits.slice(3);
  }
  digits = digits.slice(0, DIGITS_AFTER_CODE);

  if (digits.length === 0) return "+998 ";

  const part1 = digits.slice(0, 2);
  const part2 = digits.slice(2, 5);
  const part3 = digits.slice(5, 7);
  const part4 = digits.slice(7, 9);

  let formatted = "+998";
  if (part1) formatted += ` ${part1}`;
  if (part2) formatted += ` ${part2}`;
  if (part3) formatted += ` ${part3}`;
  if (part4) formatted += ` ${part4}`;
  return formatted;
};

/** Raqam to'liq (9 xonali) va haqiqiy ko'rinishga ega ekanini tekshiradi. */
export const isValidUzPhone = (value) => {
  let digits = extractDigits(value);
  if (digits.startsWith("998")) digits = digits.slice(3);
  return digits.length === DIGITS_AFTER_CODE;
};
