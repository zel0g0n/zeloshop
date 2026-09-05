import { useState, useCallback, useRef, useEffect } from "react";
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

  // MUHIM TUZATISH: AI javobi bir necha soniya davom etishi mumkin —
  // agar shu vaqt ichida foydalanuvchi sahifadan chiqib ketsa (masalan
  // "Orqaga" tugmasini bossa), natija tayyor bo'lganda `setGenerating`/
  // `setError`/`onResult` allaqachon YO'Q QILINGAN komponentga
  // chaqirilmasligi kerak.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

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
      if (isMountedRef.current) onResult(result);
    } catch (err) {
      if (isMountedRef.current) setError(err.message || "Tavsif yaratib bo'lmadi.");
    } finally {
      if (isMountedRef.current) setGenerating(false);
    }
  }, [productName, category, thumbnailImage, onResult]);

  return { generating, error, generate, clearError: () => setError(null) };
};
