import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * Sotuvchi TALAB BO'YICHA (o'zi tugma bosganda) bitta mahsulot uchun
 * 9:16 "Story" (Instagram/Telegram Stories) formatidagi AI reklama
 * surati so'raydi — `functions/storyImage.js`dagi `generateStoryImage`
 * onCall funksiyasini chaqiradi. Faqat AI CEO yoqilgan sotuvchilar
 * uchun ishlaydi (server tomonida ham tekshiriladi).
 *
 * @param {string} productId
 * @returns {Promise<{imageUrl: string}>}
 */
const generateStoryImage = async (productId) => {
  if (!productId) throw new Error("Mahsulot ID'si topilmadi.");
  const callable = httpsCallable(functions, "generateStoryImage");
  const { data } = await callable({ productId });
  return data;
};

export default generateStoryImage;
