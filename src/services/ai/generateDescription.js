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
    // TAHRIRLASH sahifasida rasm ALLAQACHON Storage'da bo'lsa,
    // `imageData` faqat `{ url }` bo'ladi (`imageToBase64.js`dagi
    // "Failed to fetch"/CORS tuzatishiga qarang) — backend uni o'zi
    // serverdan yuklab oladi.
    imageUrl: imageData?.url || null,
  });
  return data.description;
};
