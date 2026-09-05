import { useState, useCallback, useRef, useEffect } from "react";
import { generateSocialPost as generateSocialPostService } from "@/services/ai/generateSocialPost";
import { imageToBase64Payload } from "@/utils/imageToBase64";

/**
 * AI orqali ijtimoiy tarmoq posti yaratish - `useAIDescription.jsx`
 * bilan bir xil ehtiyot choralari (komponent yo'q qilingandan keyin
 * holatni yangilamaslik).
 */
export const useSocialPost = ({ productName, description, price, thumbnailImage }) => {
  const [platform, setPlatform] = useState("instagram");
  const [postText, setPostText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

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
      const result = await generateSocialPostService({ productName, description, price, platform, imageData });
      if (isMountedRef.current) setPostText(result);
    } catch (err) {
      if (isMountedRef.current) setError(err.message || "Post yaratib bo'lmadi.");
    } finally {
      if (isMountedRef.current) setGenerating(false);
    }
  }, [productName, description, price, platform, thumbnailImage]);

  return { platform, setPlatform, postText, setPostText, generating, error, generate };
};
