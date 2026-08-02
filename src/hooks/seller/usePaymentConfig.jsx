import { useCallback, useEffect, useState } from "react";
import { getPaymentConfig, savePaymentConfig } from "@/services/payments/paymentConfig";

export const usePaymentConfig = (sellerId) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!sellerId) {
      setLoading(false);
      return;
    }
    getPaymentConfig(sellerId)
      .then((data) => {
        if (!cancelled) {
          setConfig(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  const save = useCallback(
    async (newConfig) => {
      setSaving(true);
      setError(null);
      try {
        await savePaymentConfig(sellerId, newConfig);
        setConfig(newConfig);
        return true;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [sellerId]
  );

  return { config, loading, saving, error, save };
};
