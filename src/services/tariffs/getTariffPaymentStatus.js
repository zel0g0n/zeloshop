import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * Sotuvchi o'z tarif to'lovining (qo'lda tasdiqlash, to'lov cheki)
 * holatini so'raydi. Batafsil izoh: `functions/tariffPayments.js`dagi
 * `getTariffPaymentStatus`.
 *
 * @param {string} transactionId - Firestore hujjat ID'si (`submitManualTariffPayment` qaytargan `paymentDocId`)
 * @returns {Promise<{status: "paid"|"pending_review"|"rejected", plan: string, paidUntilMs?: number, amountSom?: number, rejectReason?: string|null}>}
 */
const getTariffPaymentStatus = async (transactionId) => {
  const callable = httpsCallable(functions, "getTariffPaymentStatus");
  const { data } = await callable({ transactionId });
  return data;
};

export default getTariffPaymentStatus;
