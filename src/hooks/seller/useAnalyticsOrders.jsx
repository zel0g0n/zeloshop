import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * Analitika sahifalari uchun — sotuvchining TO'LIQ (150 talik
 * cheklovsiz) buyurtmalar tarixini serverdan oladi. Oddiy Buyurtmalar
 * boshqaruv sahifasidagi `useFilterOrders` (Redux-keshlangan, 150
 * talik) hookidan ATAYLAB FARQLI - bu yerda to'liqlik muhimroq,
 * tezlik/xarajatdan ustun.
 */
export const useAnalyticsOrders = (sellerId) => {
  const [orders, setOrders] = useState([]);
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
        const getOrders = httpsCallable(functions, "getAnalyticsOrders");
        const { data } = await getOrders();
        if (cancelled) return;
        setOrders(data.orders || []);
        setTruncated(Boolean(data.truncated));
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [sellerId]);

  return { orders, loading, error, truncated };
};
