import { useEffect, useState, useCallback } from "react";
import { collection, query, where, getCountFromServer } from "firebase/firestore";
import { db } from "@/firebase/config";

/**
 * "Kutilayotgan buyurtmalar" soni — bu HOZIRGI HOLAT ko'rsatkichi
 * (davr bo'yicha emas), shuning uchun kunlik yig'ma yozuvlar
 * (`useOrderRollups`) bunga mos kelmaydi. Buning o'rniga - Firestore
 * SERVER TOMONIDAGI `count()` agregatsiyasi ishlatiladi
 * (`getCountFromServer`): bu, mos keluvchi hujjatlarning O'ZINI
 * yuklamasdan, faqat SONINI so'raydi - xarajat/tezlik buyurtmalar
 * sonidan DEYARLI MUSTAQIL (bir necha ta ham, bir necha minglab ham
 * bo'lsin, bitta engil so'rov).
 */
export const usePendingOrdersCount = (sellerId) => {
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!sellerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const pendingQuery = query(
        collection(db, "orders"),
        where("sellerId", "==", sellerId),
        where("status", "in", ["pending", "new"])
      );
      const snap = await getCountFromServer(pendingQuery);
      setPendingCount(snap.data().count);
    } catch (err) {
      // Jim qoladi - Dashboard'ning qolgan qismi (savdo/foyda) bu
      // ko'rsatkichga bog'liq emas, shuning uchun ishlayverishi kerak.
      console.error("Kutilayotgan buyurtmalar sonini olishda xatolik:", err);
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { pendingCount, loading, refresh };
};

export default usePendingOrdersCount;
