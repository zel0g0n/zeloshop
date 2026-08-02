import { useState, useCallback } from "react";
import { generateProductDescription } from "@/services/ai/generateDescription";
import { imageToBase64Payload } from "@/utils/imageToBase64";

/**
 * AI orqali mahsulot tavsifini yaratish — bu holat endi sahifa
 * darajasida (AddProductPage/EditProductPage) saqlanadi, shunda
 * ham yuqoridagi "AI banner", ham pastdagi tavsif kartochkasidagi
 * tugma BITTA umumiy holatdan (yuklanmoqda/xato) foydalanadi.
 */
export const useAIDescription = ({ productName, category, thumbnailImage, onResult }) => {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const generate = useCallback(async () => {
    if (!productName?.trim()) {
      setError("Avval mahsulot nomini kiriting.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const imageData = await imageToBase64Payload(thumbnailImage);
      const result = await generateProductDescription(productName, category, imageData);
      onResult(result);
    } catch (err) {
      setError(err.message || "Tavsif yaratib bo'lmadi.");
    } finally {
      setGenerating(false);
    }
  }, [productName, category, thumbnailImage, onResult]);

  return { generating, error, generate, clearError: () => setError(null) };
};
