import { useState, useEffect } from "react";
import { onSnapshot } from "firebase/firestore";
import { productStockAuditLogQuery } from "@/services/products/stockAuditLog";

/**
 * ZAXIRA HARAKATI AUDIT JURNALI (2026-09) — bitta mahsulotning so'nggi
 * zaxira harakatlarini jonli (real-vaqtli) o'qiydi. `useExpenses.jsx`
 * bilan BIR XIL, sinovdan o'tgan naqsh.
 */
export const useStockAuditLog = (sellerId, productId) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sellerId || !productId) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      productStockAuditLogQuery(sellerId, productId),
      (snapshot) => {
        setEntries(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsubscribe();
  }, [sellerId, productId]);

  return { entries, loading };
};
