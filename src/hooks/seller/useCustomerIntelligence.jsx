import { useState, useEffect, useCallback } from "react";
import { getCustomerIntelligence } from "@/services/crm/customerIntelligence";

/**
 * MIJOZLAR RAZVEDKASI (Advanced Customer Intelligence, Z-Biznes,
 * 2026-09 punkt-royxati, 9-band) — `getCustomerIntelligence` onCall'ini
 * chaqiradi va natijani (serverda TO'LIQ tasniflangan mijozlar
 * ro'yxati + `counts`/`tagCounts`) React holatiga aylantiradi.
 *
 * `useCrmOrders`dan (Z-Pro CRM) FARQLI: JONLI Firestore tinglovchisi
 * EMAS — bitta so'rov, `refetch` orqali qo'lda yangilanadi. Bunga
 * sabab: tasniflash (`carts`/`favorites` bilan cross-referens)
 * serverda, chaqiruv bo'yicha hisoblanadi (batafsil izoh:
 * `functions/customerIntelligence.js`) — doimiy jonli tinglash
 * mantiqsiz/qimmat bo'lardi (har bir savatcha o'zgarishida butun
 * tasnifni qayta hisoblash shart emas).
 *
 * @param {boolean} enabled - FAQAT Biznes tarifidagi (yoki uning
 *   faol sinovidagi) sotuvchi UI'da shu bo'limni ochganda `true`
 *   berilishi kerak — aks holda onCall UMUMAN chaqirilmaydi (xarajat
 *   nazorati, `askAiCeo`ning `aiCeoEnabled` gatelash g'oyasi bilan
 *   bir xil).
 */
const useCustomerIntelligence = (enabled) => {
  const [data, setData] = useState(null); // { customers, counts, tagCounts, isApproximate }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getCustomerIntelligence();
      setData(result);
    } catch (err) {
      setError(err?.message || "Mijozlar tahlilini yuklashda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
};

export default useCustomerIntelligence;
