import { useEffect, useState } from "react";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";

/**
 * Mijozga yuborilgan bildirishnomalarni JONLI (real-time) kuzatadi -
 * `notificationLogs` kolleksiyasidan, faqat JORIY do'konga tegishli
 * (bir nechta do'konga xarid qilgan mijoz, boshqa do'konning
 * xabarlarini KO'RMASLIGI kerak) va faqat SO'NGGI 50 tasi.
 */
export function useNotificationLog(sellerId, clientId) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  // MUHIM TUZATISH: OLDIN xatolik faqat konsolga (`console.error`)
  // yozilardi - mijoz uchun bu, doimiy "hech qanday bildirishnoma
  // yo'q" bo'sh holatidan HECH FARQ QILMASDI (masalan, agar Firestore
  // indeksi hali yaratilmagan/deploy qilinmagan bo'lsa yoki qoidalar
  // ruxsat bermasa, ro'yxat SHUNCHAKI DOIM bo'sh ko'rinardi - haqiqiy
  // sabab ko'rinmasdi). Endi xatolik holati ALOHIDA qaytariladi -
  // sahifa buni haqiqiy bo'sh holatdan farqlab, aniq xabar ko'rsata
  // oladi.
  const [error, setError] = useState(null);
  // MUHIM TUZATISH: ID'lar (masalan `sellerId`/`clientId` sessiya
  // hali aniqlanmaganda `null`dan haqiqiy qiymatga) o'zgarganda,
  // effekt qayta ishga tushadi va YANGI so'rovga obuna bo'ladi -
  // lekin OLDIN `loading` qayta `true`ga qaytarilmasdi (faqat
  // boshlang'ich holatda `true` edi). Natijada, agar birinchi render
  // paytida ID'lar hali `null` bo'lsa, `loading` darhol `false`ga
  // tushib qolardi - keyin ID'lar kelganda ham, HAQIQIY ma'lumot
  // hali yuklanayotganiga qaramay, sahifa "bo'sh" holatni bir lahzaga
  // ko'rsatib qo'yishi mumkin edi.
  useEffect(() => {
    if (!sellerId || !clientId) {
      setNotifications([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, "notificationLogs"),
      where("clientId", "==", clientId),
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
        console.error("Bildirishnomalar jurnalini kuzatishda xatolik:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [sellerId, clientId]);

  return { notifications, loading, error };
}
