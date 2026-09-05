import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * Analitika sahifasi uchun — sotuvchining TO'LIQ (100 talik
 * cheklovsiz) mahsulotlar ro'yxatini serverdan oladi.
 */
export const useAnalyticsProducts = (sellerId) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const getProducts = httpsCallable(functions, "getAnalyticsProducts");
        const { data } = await getProducts();
        if (cancelled) return;
        setProducts(data.products || []);
        setTruncated(Boolean(data.truncated));
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [sellerId]);

  return { products, loading, error, truncated };
};
