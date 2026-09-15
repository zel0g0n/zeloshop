import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * Sotuvchi "To'lash" tugmasini bosganda — Atmos'da chernovik
 * tranzaksiya yaratadi va hosted checkout havolasini so'raydi.
 * Batafsil izoh: `functions/atmosPayments.js`dagi `createTariffPayment`.
 *
 * @param {"start"|"pro"} plan
 * @returns {Promise<{transactionId: number|string, checkoutUrl: string, amountSom: number}>}
 */
const createTariffPayment = async (plan) => {
  const callable = httpsCallable(functions, "createTariffPayment");
  const { data } = await callable({ plan });
  return data;
};

export default createTariffPayment;
