import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * Sotuvchining o'z (faqat xaridorlar uchun) botini ulash/uzish
 * xizmatlari. Token — hech qachon frontend'da saqlanmaydi, faqat
 * bir martalik so'rov sifatida serverga yuboriladi (u yerda
 * tekshiriladi va maxfiy joyda saqlanadi).
 */
export const connectCustomBot = async (botToken) => {
  const callable = httpsCallable(functions, "connectCustomBot");
  const { data } = await callable({ botToken });
  return data;
};

export const disconnectCustomBot = async () => {
  const callable = httpsCallable(functions, "disconnectCustomBot");
  const { data } = await callable();
  return data;
};
