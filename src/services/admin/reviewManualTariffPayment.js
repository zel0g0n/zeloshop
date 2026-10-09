import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * Admin panelidagi "To'lov tekshiruvi" ro'yxatida bitta qo'lda
 * to'lovni hal qiladi (`AdminManualTariffPaymentsPage.jsx`). Batafsil
 * izoh: `functions/manualTariffPayments.js`dagi
 * `reviewManualTariffPayment` — tasdiqlash `functions/tariffPayments.js`dagi
 * `activateTariffPayment` orqali sotuvchi tarifini faollashtiradi.
 *
 * @param {string} paymentDocId
 * @param {"approve"|"reject"} action
 * @param {string} [rejectReason]
 */
const reviewManualTariffPayment = async (paymentDocId, action, rejectReason) => {
  const callable = httpsCallable(functions, "reviewManualTariffPayment");
  const { data } = await callable({ paymentDocId, action, rejectReason });
  return data;
};

export default reviewManualTariffPayment;
