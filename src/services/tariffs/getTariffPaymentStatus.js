import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * Sotuvchi Atmos checkout sahifasidan qaytgach (yoki sahifani qayta
 * ochib, "hali kutilmoqda" holatini yangilash uchun) — to'lov holatini
 * tekshiradi. Batafsil izoh: `functions/atmosPayments.js`dagi
 * `getTariffPaymentStatus`.
 *
 * @param {string|number} transactionId
 * @returns {Promise<{status: "created"|"paid", plan: string, paidUntilMs?: number, amountSom?: number}>}
 */
const getTariffPaymentStatus = async (transactionId) => {
  const callable = httpsCallable(functions, "getTariffPaymentStatus");
  const { data } = await callable({ transactionId });
  return data;
};

export default getTariffPaymentStatus;
