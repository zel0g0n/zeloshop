import { useState, useEffect } from "react";
import { onSnapshot } from "firebase/firestore";
import { partnerCodeStatsQuery } from "@/services/coupons/partnerCodeStats";

/**
 * Hamkor/blogger kodlari samaradorligi (#117) - jonli (`onSnapshot`)
 * ro'yxat, eng ko'p savdo keltirgan kod birinchi bo'lib ko'rsatiladi
 * (`partnerCodeStatsQuery`dagi `orderBy("totalRevenue","desc")`).
 */
export const usePartnerCodeStats = (sellerId) => {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      partnerCodeStatsQuery(sellerId),
      (snapshot) => {
        setStats(snapshot.docs.map((d) => d.data()));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [sellerId]);

  return { stats, loading, error };
};
