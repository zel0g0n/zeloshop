import { useEffect, useState } from "react";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";

/**
 * "Universal Inbox" MVP (ZeloShop TOP 15, #12) — sotuvchi tomonidan,
 * BARCHA mijozlarga yuborilgan avtomatik xabarlar jurnalini
 * (`notificationLogs`, `sellerId` bo'yicha, `clientId`siz) JONLI
 * kuzatadi. `useNotificationLog.jsx`dan FARQI: o'sha hook BITTA mijoz
 * (`clientId` + `sellerId`) uchun, mijozning O'ZI ko'radigan sahifada
 * ishlatiladi — bu esa SOTUVCHI uchun, BARCHA mijozlarga ketgan
 * xabarlarni ko'rsatadi (boshqa so'rov shakli, shuning uchun alohida
 * Firestore kompozit indeksi kerak bo'ldi — `firestore.indexes.json`).
 */
export function useSellerNotificationLog(sellerId) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // `sellerId` o'zgarganda ESKI holatni RENDER vaqtida (useEffect
  // ICHIDA shartsiz setState sifatida emas) tozalaymiz - batafsil
  // izoh: `useAiCeoPendingActions.jsx`.
  const [trackedSellerId, setTrackedSellerId] = useState(sellerId);
  if (sellerId !== trackedSellerId) {
    setTrackedSellerId(sellerId);
    setNotifications([]);
    setError(null);
    setLoading(Boolean(sellerId));
  }

  useEffect(() => {
    if (!sellerId) return;

    const q = query(
      collection(db, "notificationLogs"),
      where("sellerId", "==", sellerId),
      orderBy("sentAt", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setNotifications(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("Sotuvchi bildirishnomalar jurnalini kuzatishda xatolik:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [sellerId]);

  return { notifications, loading, error };
}
