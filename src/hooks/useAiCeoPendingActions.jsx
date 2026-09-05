import { useEffect, useState } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";

/**
 * "Universal Inbox" MVP (ZeloShop TOP 15, #12) — sotuvchining
 * `sellers/{sellerId}/aiCeoPendingActions` to'plamini JONLI kuzatadi
 * (Telegram bot orqali yuboriladigan "1-tugmali tasdiqlash" xabarlari
 * bilan BIR XIL manba - `functions/telegramApproval.js`).
 *
 * ATAYLAB `status`ga qarab FILTRLANMAYDI (faqat "pending" emas, hammasi
 * qaytariladi) — sabab: bitta sotuvchida kunига atigi ~2 ta hujjat
 * (VIP/churn) yaratiladi, shuning uchun bu to'plam tabiiy ravishda
 * juda kichik — status bo'yicha serverda filtrlash yangi Firestore
 * kompozit indeksini talab qilardi (`status` + `orderBy(createdAt)`),
 * bunga hojat yo'q — chaqiruvchi (`InboxPage.jsx`) kerak bo'lsa o'zi,
 * xotirada, `status === "pending"` bo'yicha ajratadi.
 */
export function useAiCeoPendingActions(sellerId) {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // `sellerId` o'zgarganda (shu jumladan `null`ga o'tganda) ESKI
  // holatni tozalash/qayta boshlash kerak - buni useEffect ICHIDA
  // shartsiz setState sifatida emas, RENDER vaqtida (React
  // hujjatlaridagi tavsiya etilgan "moslashtirish" andozasi) qilamiz -
  // effekt ICHIDA faqat `onSnapshot` NATIJASI kelganda (haqiqiy tashqi
  // hodisa) setState chaqiriladi, bu "kaskad render" lint
  // ogohlantirishini yaratmaydi.
  const [trackedSellerId, setTrackedSellerId] = useState(sellerId);
  if (sellerId !== trackedSellerId) {
    setTrackedSellerId(sellerId);
    setActions([]);
    setError(null);
    setLoading(Boolean(sellerId));
  }

  useEffect(() => {
    if (!sellerId) return;

    const q = query(
      collection(db, "sellers", sellerId, "aiCeoPendingActions"),
      orderBy("createdAt", "desc"),
      limit(30)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setActions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("AI CEO kutilayotgan harakatlarini kuzatishda xatolik:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [sellerId]);

  return { actions, loading, error };
}
