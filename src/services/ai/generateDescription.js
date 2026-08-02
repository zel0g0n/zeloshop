import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * "AI bilan to'ldirish" tugmasi chaqiradigan xizmat — mahsulot nomi
 * va kategoriyasi asosida haqiqiy AI (Gemini) yordamida tavsif yaratadi.
 */
export const generateProductDescription = async (productName, category, imageData) => {
  const callable = httpsCallable(functions, "generateProductDescription");
  const { data } = await callable({
    productName,
    category,
    imageBase64: imageData?.base64 || null,
    imageMimeType: imageData?.mimeType || null,
  });
  return data.description;
};
