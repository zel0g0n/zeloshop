import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * Checkout'da "Bonus hisobim" bo'limini ko'rsatish uchun — mijozning
 * shu SOTUVCHI uchun yig'gan bonus balansini oladi
 * (`functions/loyalty.js`). Sotuvchida sodiqlik dasturi o'chirilgan
 * bo'lsa, `enabled: false, balance: 0` qaytadi — chaqiruvchi bu
 * holatda bonus bo'limini umuman ko'rsatmasligi kerak.
 */
const getMyLoyaltyBalance = async (sellerId) => {
  if (!sellerId) throw new Error("Sotuvchi ID topilmadi.");
  const callable = httpsCallable(functions, "getMyLoyaltyBalance");
  const { data } = await callable({ sellerId });
  return data; // { enabled, balance, earnPercent, maxRedeemPercent }
};

export default getMyLoyaltyBalance;
