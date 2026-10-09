import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * Admin panelidagi "To'lov tekshiruvi" sahifasidan ZeloShop'ning
 * qo'lda-to'lov karta ma'lumotini kiritadi/yangilaydi, yoki
 * `enabled: false` bilan vaqtincha yashiradi (ma'lumotni o'chirmasdan).
 * Batafsil izoh: `functions/manualTariffPayments.js`dagi
 * `setManualTariffPaymentInfo`.
 *
 * @param {{cardNumber?: string, cardHolderName?: string, enabled: boolean}} params
 */
const updateManualTariffPaymentSettings = async ({ cardNumber, cardHolderName, enabled }) => {
  const callable = httpsCallable(functions, "setManualTariffPaymentInfo");
  const { data } = await callable({ cardNumber, cardHolderName, enabled });
  return data;
};

export default updateManualTariffPaymentSettings;
