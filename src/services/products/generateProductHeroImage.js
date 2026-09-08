import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * Sotuvchi TALAB BO'YICHA, tanlangan uslubda ("adCreative" yoki
 * "premiumShowcase") mahsulot uchun AI "asosiy rasm" (hero image)
 * yaratadi va uni DARHOL mahsulotning asosiy (birinchi) rasmi
 * sifatida saqlaydi — `functions/heroImage.js`dagi
 * `generateProductHeroImage` onCall funksiyasini chaqiradi. Faqat AI
 * CEO yoqilgan sotuvchilar uchun ishlaydi (server tomonida ham
 * tekshiriladi).
 *
 * @param {string} productId
 * @param {"adCreative"|"premiumShowcase"} style
 * @returns {Promise<{imageUrl: string, images: string[]}>}
 */
const generateProductHeroImage = async (productId, style) => {
  if (!productId) throw new Error("Mahsulot ID'si topilmadi.");
  const callable = httpsCallable(functions, "generateProductHeroImage");
  const { data } = await callable({ productId, style });
  return data;
};

export default generateProductHeroImage;
