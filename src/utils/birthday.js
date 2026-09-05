/**
 * Tug'ilgan kun avtomatik chegirmasi uchun sof yordamchi funksiya.
 *
 * Mijoz profilida sanani "YYYY-MM-DD" (HTML `<input type="date">`
 * standart formati) ko'rinishida kiritadi va shu holicha
 * `clients/{clientId}.birthDate`ga saqlanadi. LEKIN Firestore sana
 * QATORINING faqat oy-kun qismi bo'yicha to'g'ridan-to'g'ri so'rov
 * qila olmaydi (masalan "har bir yilning shu kuni" so'rovi) - shuning
 * uchun ALOHIDA, tayyor "MM-DD" maydoni (`birthdayMonthDay`) ham
 * saqlanadi. Kunlik tug'ilgan kun tekshiruvi
 * (`functions/birthdayRewards.js`) FAQAT shu maydon bo'yicha oddiy
 * tenglik so'rovi qiladi.
 *
 * @param {string} birthDateStr - "YYYY-MM-DD" formatidagi sana
 * @returns {string|null} "MM-DD" yoki noto'g'ri/bo'sh kiritilsa - null
 */
export function deriveBirthdayMonthDay(birthDateStr) {
  if (!birthDateStr || typeof birthDateStr !== "string") return null;
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(birthDateStr.trim());
  if (!match) return null;
  return `${match[1]}-${match[2]}`;
}
