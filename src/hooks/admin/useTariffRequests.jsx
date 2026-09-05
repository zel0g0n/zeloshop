import { useCallback, useEffect, useState } from "react";
import { getPendingTariffRequests } from "@/services/admin/getTariffRequests";
import resolveTariffRequest from "@/services/admin/resolveTariffRequest";
import { auth } from "@/firebase/config";

/**
 * `AdminTariffRequestsPage.jsx` uchun — kutilayotgan tarif
 * so'rovlarini bir martalik yuklaydi (boshqa admin ro'yxatlari kabi
 * jonli tinglovchi EMAS, `useGetAllSellers.jsx`dagi bilan bir xil
 * qaror: admin real-vaqt kerak bo'lsa sahifani qayta ochadi).
 * Hal qilingan so'rov ro'yxatdan QO'LDA olib tashlanadi (server
 * bilan sinxronlash uchun qayta so'rov yubormasdan) — xuddi
 * `useGetAllSellers.jsx`ning `removeSeller`si kabi.
 */
const useTariffRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);
  const [resolveError, setResolveError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPendingTariffRequests();
      setRequests(data);
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
    async (request, action) => {
      setResolvingId(request.id);
      setResolveError(null);
      try {
        await resolveTariffRequest(request, action, auth.currentUser?.uid);
        setRequests((prev) => prev.filter((r) => r.id !== request.id));
      } catch (err) {
        setResolveError(err.message);
      } finally {
        setResolvingId(null);
      }
    },
    []
  );

  return { requests, loading, error, resolvingId, resolveError, resolve, reload: load };
};

export default useTariffRequests;
