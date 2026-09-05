import { useState, useEffect, useCallback } from "react";
import { onSnapshot } from "firebase/firestore";
import { createBundle, deleteBundle, toggleBundleActive, sellerBundlesQuery } from "@/services/bundles/bundles";

export const useBundles = (sellerId) => {
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      sellerBundlesQuery(sellerId),
      (snapshot) => {
        setBundles(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
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
      await createBundle(sellerId, data);
    },
    [sellerId]
  );

  const remove = useCallback(
    async (bundleId) => {
      await deleteBundle(sellerId, bundleId);
    },
    [sellerId]
  );

  const toggleActive = useCallback(
    async (bundleId, isActive) => {
      await toggleBundleActive(sellerId, bundleId, isActive);
    },
    [sellerId]
  );

  return { bundles, loading, error, create, remove, toggleActive };
};
