import { useState, useEffect, useCallback } from "react";
import { onSnapshot } from "firebase/firestore";
import { createCoupon, deleteCoupon, couponsQuery } from "@/services/coupons/coupons";

export const useCoupons = (sellerId) => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      couponsQuery(sellerId),
      (snapshot) => {
        setCoupons(snapshot.docs.map((d) => d.data()));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [sellerId]);

  const create = useCallback(
    async (data) => {
      await createCoupon(sellerId, data);
    },
    [sellerId]
  );

  const remove = useCallback(
    async (code) => {
      await deleteCoupon(sellerId, code);
    },
    [sellerId]
  );

  return { coupons, loading, error, create, remove };
};
