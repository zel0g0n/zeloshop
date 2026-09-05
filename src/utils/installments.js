/**
 * "BO'LIB TO'LASH" (installment) uchun sof yordamchi funksiya -
 * `functions/lib/installments.js`dagi bilan BIR XIL mantiq, faqat
 * frontendda checkout paytida OLDINDAN ko'rsatish uchun. HAQIQIY,
 * YAKUNIY bo'linma har doim serverda (`functions/orders.js`) qayta
 * hisoblanadi va tekshiriladi.
 *
 * @param {number} totalAmount
 * @param {number} parts
 * @returns {number[]}
 */
export function computeInstallmentAmounts(totalAmount, parts) {
  const total = Math.max(0, Math.round(Number(totalAmount) || 0));
  const n = Math.max(1, Math.round(Number(parts) || 1));
  if (n <= 1) return [total];

  const base = Math.floor(total / n);
  const amounts = new Array(n).fill(base);
  amounts[n - 1] = total - base * (n - 1);
  return amounts;
}
