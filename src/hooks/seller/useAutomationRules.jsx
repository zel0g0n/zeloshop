import { useState, useEffect, useCallback } from "react";
import { onSnapshot } from "firebase/firestore";
import {
  createAutomationRule, deleteAutomationRule, toggleAutomationRuleActive, sellerAutomationRulesQuery,
} from "@/services/automation/automationRules";

/**
 * ADVANCED AUTOMATION (Z-Biznes, 5-band) — `useBundles.jsx`/`useCoupons.jsx`
 * bilan BIR XIL naqsh: sotuvchining O'Z avtomatlashtirish qoidalariga
 * JONLI (onSnapshot) tinglovchi + CRUD amallar.
 */
export const useAutomationRules = (sellerId) => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      sellerAutomationRulesQuery(sellerId),
      (snapshot) => {
        setRules(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
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
      await createAutomationRule(sellerId, data);
    },
    [sellerId]
  );

  const remove = useCallback(
    async (ruleId) => {
      await deleteAutomationRule(sellerId, ruleId);
    },
    [sellerId]
  );

  const toggleActive = useCallback(
    async (ruleId, isActive) => {
      await toggleAutomationRuleActive(sellerId, ruleId, isActive);
    },
    [sellerId]
  );

  return { rules, loading, error, create, remove, toggleActive };
};
