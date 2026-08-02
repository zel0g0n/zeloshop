import { useState, useEffect, useCallback } from "react";
import { onSnapshot } from "firebase/firestore";
import { addExpense, deleteExpense, expensesQuery } from "@/services/finance/expenses";

export const useExpenses = (sellerId) => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      expensesQuery(sellerId),
      (snapshot) => {
        setExpenses(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
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
      await addExpense(sellerId, data);
    },
    [sellerId]
  );

  const remove = useCallback(
    async (expenseId) => {
      await deleteExpense(sellerId, expenseId);
    },
    [sellerId]
  );

  return { expenses, loading, error, create, remove };
};
