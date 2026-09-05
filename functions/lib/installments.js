/**
 * "BO'LIB TO'LASH" (installment) uchun sof yordamchi funksiya.
 *
 * Umumiy summani BERILGAN sonli TENG qismlarga bo'ladi - tiyin/so'm
 * darajasidagi yaxlitlash xatosi YIG'ILIB QOLMASLIGI uchun, oxirgi
 * qism QOLDIQNI o'zига oladi (masalan 100 000 so'mni 3 qismga bo'lsak:
 * 33 333 + 33 333 + 33 334 = 100 000 - aniq TENG emas, lekin yig'indi
 * har doim ANIQ to'g'ri).
 *
 * Bu FAQAT server tomonida (`functions/orders.js`) HAQIQIY, YAKUNIY
 * `totalAmount`dan chaqiriladi - mijoz tomonidan yuborilgan hech
 * qanday summa/bo'linma ISHONIB QOLINMAYDI.
 *
 * @param {number} totalAmount
 * @param {number} parts
 * @returns {number[]} uzunligi `parts`ga teng, yig'indisi `totalAmount`ga teng massiv
 */
function computeInstallmentAmounts(totalAmount, parts) {
  const total = Math.max(0, Math.round(Number(totalAmount) || 0));
  const n = Math.max(1, Math.round(Number(parts) || 1));
  if (n <= 1) return [total];

  const base = Math.floor(total / n);
  const amounts = new Array(n).fill(base);
  amounts[n - 1] = total - base * (n - 1);
  return amounts;
}

module.exports = { computeInstallmentAmounts };
