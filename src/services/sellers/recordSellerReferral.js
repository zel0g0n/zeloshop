import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * Yangi sotuvchi do'konini yaratgandan DARHOL so'ng (agar u boshqa
 * sotuvchining taklif havolasi orqali kelgan bo'lsa) chaqiriladi -
 * batafsil izoh: `functions/sellerReferrals.js`.
 *
 * MUHIM: bu — ixtiyoriy, "eng yaxshi urinish" (best-effort) chaqiruv.
 * Xato bo'lsa ham, do'kon yaratish jarayonining o'zi ALLAQACHON
 * muvaffaqiyatli tugagan - shuning uchun `CreateStoreScreen.jsx` bu
 * funksiya xato tashlasa ham, foydalanuvchiga hech qanday xatolik
 * ko'rsatmasligi kerak (`saveYandexDeliveryConfig` bilan bir xil
 * pattern, o'sha faylda).
 */
const recordSellerReferral = async (referrerSellerId) => {
  const callable = httpsCallable(functions, "recordSellerReferral");
  const { data } = await callable({ referrerSellerId });
  return data;
};

export default recordSellerReferral;
