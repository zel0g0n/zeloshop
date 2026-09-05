import { useEffect, useState } from "react";
import { collection, query, where, orderBy, documentId, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";

const TASHKENT_TZ = "Asia/Tashkent";

/** Millisekundni "YYYY-MM-DD" (Toshkent vaqti) kun kalitiga aylantiradi — server tomonidagi bilan BIR XIL qoida. */
const dateKeyFromMillis = (ms) => new Date(ms).toLocaleDateString("en-CA", { timeZone: TASHKENT_TZ });

/**
 * Server tomonida OLDINDAN hisoblangan KUNLIK yig'ma yozuvlarni
 * (`sellers/{id}/orderRollups/{YYYY-MM-DD}`, batafsil izoh:
 * `functions/orderRollups.js`) o'qiydi. Dashboard/P&L/Foyda tahlili
 * endi buyurtmalar tarixini TO'LIQ skanerlash o'rniga, faqat shu
 * (davr uzunligiga teng, ko'pi bilan bir necha yuzta) kunlik
 * hujjatlarni o'qiydi — bu, buyurtmalar soni necha o'n minglab
 * bo'lsa ham, sahifa tezligi/Firestore xarajati O'ZGARMAY qolishini
 * ta'minlaydi ("kengayishni hisobga olgan holda" qurilgan yechim).
 *
 * @param {string} sellerId
 * @param {number} sinceMs - shu sanadan buyon (masalan "1 yil oldin") — jonli tinglagich shu chegaradan boshlab kuzatadi.
 */
export const useOrderRollups = (sellerId, sinceMs) => {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sellerId || !sinceMs) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const sinceKey = dateKeyFromMillis(sinceMs);
    const rollupsQuery = query(
      collection(db, "sellers", sellerId, "orderRollups"),
      where(documentId(), ">=", sinceKey),
      orderBy(documentId(), "asc")
    );

    const unsubscribe = onSnapshot(
      rollupsQuery,
      (snapshot) => {
        setDays(
          snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              date: doc.id,
              // Kun kalitini (Toshkent vaqti, "00:00") millisekundga
              // qaytaramiz - davr chegaralari bilan solishtirish uchun.
              dateMs: new Date(`${doc.id}T00:00:00+05:00`).getTime(),
              revenue: Number(data.revenue) || 0,
              cogs: Number(data.cogs) || 0,
              deliveredCount: Number(data.deliveredCount) || 0,
              ordersCreatedCount: Number(data.ordersCreatedCount) || 0,
              // BIZNES BUYRUQ MARKAZI (2026-09, 3-band "mijoz jalb
              // qilish" tendentsiyasi): batafsil izoh - `functions/lib/rollups.js`.
              newCustomersCount: Number(data.newCustomersCount) || 0,
            };
          })
        );
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [sellerId, sinceMs]);

  return { days, loading, error };
};

export default useOrderRollups;
