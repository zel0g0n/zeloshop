import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * Checkout'da "Karta orqali to'lash" tanlanganda — sotuvchining
 * shaxsiy karta raqami + F.I.SH'ini oladi (`functions/paymentCardInfo.js`).
 * Sotuvchi bu usulni yoqmagan bo'lsa, funksiya "not-found" xatosi
 * bilan rad etadi — chaqiruvchi shu holatni "karta orqali to'lov
 * mavjud emas" deb ko'rsatishi kerak.
 */
const getSellerPaymentCardInfo = async (sellerId) => {
  if (!sellerId) throw new Error("Sotuvchi ID topilmadi.");
  const callable = httpsCallable(functions, "getSellerPaymentCardInfo");
  const { data } = await callable({ sellerId });
  return data; // { cardNumber, cardHolderName }
};

export default getSellerPaymentCardInfo;
