import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * Sotuvchi ZeloShop kartasiga o'tkazma qilib, to'lov chekining
 * skrinshotini yuklaganidan keyin — admin ko'rib chiqishi uchun
 * navbatga qo'yadi. Batafsil izoh: `functions/manualTariffPayments.js`
 * dagi `submitManualTariffPayment`.
 *
 * @param {"start"|"pro"} plan
 * @param {string} receiptUrl
 * @returns {Promise<{paymentDocId: string, status: "pending_review", amountSom: number}>}
 */
const submitManualTariffPayment = async (plan, receiptUrl) => {
  const callable = httpsCallable(functions, "submitManualTariffPayment");
  const { data } = await callable({ plan, receiptUrl });
  return data;
};

export default submitManualTariffPayment;
