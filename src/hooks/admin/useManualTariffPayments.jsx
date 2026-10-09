import { useCallback, useEffect, useState } from "react";
import getPendingManualTariffPayments from "@/services/admin/getPendingManualTariffPayments";
import reviewManualTariffPayment from "@/services/admin/reviewManualTariffPayment";

/**
 * `AdminManualTariffPaymentsPage.jsx` uchun — kutilayotgan qo'lda
 * to'lovlarni bir martalik yuklaydi (`useTariffRequests.jsx`dagi bilan
 * BIR XIL qaror: admin real-vaqt kerak bo'lsa sahifani qayta ochadi).
 * Hal qilingan to'lov ro'yxatdan QO'LDA olib tashlanadi (server bilan
 * sinxronlash uchun qayta so'rov yubormasdan).
 */
const useManualTariffPayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);
  const [resolveError, setResolveError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPendingManualTariffPayments();
      setPayments(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = useCallback(
    async (payment, action, rejectReason) => {
      setResolvingId(payment.id);
      setResolveError(null);
      try {
        await reviewManualTariffPayment(payment.id, action, rejectReason);
        setPayments((prev) => prev.filter((p) => p.id !== payment.id));
      } catch (err) {
        setResolveError(err.message);
      } finally {
        setResolvingId(null);
      }
    },
    []
  );

  return { payments, loading, error, resolvingId, resolveError, resolve, reload: load };
};

export default useManualTariffPayments;
