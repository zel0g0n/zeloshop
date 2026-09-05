import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * "Bo'lib to'lash" rejasidagi KEYINGI (2-, 3-...) qismning to'lov
 * chekini biriktirish uchun — `functions/installments.js`dagi
 * `submitInstallmentPayment` onCall funksiyasini chaqiradi.
 *
 * Xaridor o'zining `orders/{orderId}` hujjatini to'g'ridan-to'g'ri
 * Firestore orqali yangilay olmaydi (`firestore.rules`), shuning
 * uchun bu ANIQ maqsadli server funksiyasi orqali amalga oshiriladi.
 *
 * @param {string} orderId
 * @param {string} receiptUrl
 * @returns {Promise<{partsPaid: number, totalParts: number, isFullyPaid: boolean}>}
 */
const submitInstallmentPayment = async (orderId, receiptUrl) => {
  if (!orderId || !receiptUrl) throw new Error("Buyurtma yoki chek ma'lumoti to'liq emas.");
  const callable = httpsCallable(functions, "submitInstallmentPayment");
  const { data } = await callable({ orderId, receiptUrl });
  return data;
};

export default submitInstallmentPayment;
