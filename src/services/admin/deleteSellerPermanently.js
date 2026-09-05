import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * Super-admin panelidagi "Do'konni butunlay o'chirish" tugmasi
 * chaqiradigan xizmat. `functions/adminSellerManagement.js`dagi
 * `deleteSellerPermanently` onCall'iga mos — QAYTARIB BO'LMAYDIGAN
 * amal, shuning uchun do'kon nomini aniq tasdiqlash talab qilinadi
 * (server tomonida ham tekshiriladi, bu yerdagi tekshiruv emas).
 */
const deleteSellerPermanently = async (sellerId, confirmStoreName) => {
  if (!sellerId) throw new Error("Do'kon ID topilmadi.");
  const callable = httpsCallable(functions, "deleteSellerPermanently");
  const { data } = await callable({ sellerId, confirmStoreName });
  return data;
};

export default deleteSellerPermanently;
