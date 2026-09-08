import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * "AI orqali post yaratish" tugmasi chaqiradigan xizmat - mahsulot
 * ma'lumoti asosida Instagram/TikTok uchun tayyor post matnini
 * yaratadi. FAQAT AI CEO premium sotuvchilari uchun (server tomonida
 * tekshiriladi).
 */
export const generateSocialPost = async ({ productName, description, price, platform, imageData }) => {
  const callable = httpsCallable(functions, "generateSocialPost");
  const { data } = await callable({
    productName,
    description,
    price,
    platform,
    imageBase64: imageData?.base64 || null,
    imageMimeType: imageData?.mimeType || null,
    imageUrl: imageData?.url || null,
  });
  return data.postText;
};
