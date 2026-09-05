import { useState, useEffect, useCallback } from "react";
import { onSnapshot } from "firebase/firestore";
import {
  sellerPricingSuggestionsCollection,
  applyPricingSuggestion,
  dismissPricingSuggestion,
} from "@/services/products/pricingSuggestions";

/**
 * "AI narx tavsiyalari" — `useCoupons.jsx`/`useBundles.jsx` bilan bir
 * xil naqsh (jonli `onSnapshot` o'qish), lekin YOZISH tomoni butunlay
 * boshqacha: to'g'ridan-to'g'ri Firestore yozuvi YO'Q, faqat ikkita
 * onCall chaqiruv (`apply`/`dismiss`) — sabab: `firestore.rules`da bu
 * kolleksiya yozish uchun butunlay yopiq (`functions/pricingSuggestions.js`ga
 * qarang).
 */
export const usePricingSuggestions = (sellerId) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      sellerPricingSuggestionsCollection(sellerId),
      (snapshot) => {
        setSuggestions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [sellerId]);

  const apply = useCallback(async (productId) => applyPricingSuggestion(productId), []);
  const dismiss = useCallback(async (productId) => dismissPricingSuggestion(productId), []);

  return { suggestions, loading, error, apply, dismiss };
};
