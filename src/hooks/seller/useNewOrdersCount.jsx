import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";

/**
 * Sotuvchining "yangi" (hali ko'rib chiqilmagan) buyurtmalari sonini
 * JONLI (real-time) kuzatadi — mijoz tomonidagi Navbar'da savat/
 * sevimlilar soni qanday jonli ko'rsatilsa, sotuvchi tomonida ham
 * shunga o'xshab, yangi buyurtma kelganda navbar belgisi DARHOL,
 * SAHIFANI QAYTA YUKLAMASDAN yangilanadi (`onSnapshot`).
 *
 * MUHIM: bu hook `SellerLayout.jsx`da BIR MARTA joylashtirilgan
 * `SellerNavbar.jsx` ichida ishlatiladi (har bir sahifada QAYTA
 * o'rnatilmaydi) - shuning uchun BUTUN sotuvchi sessiyasi davomida
 * FAQAT BITTA tinglovchi ishlaydi, sahifadan-sahifaga o'tishda
 * qayta ulanmaydi.
 */
export function useNewOrdersCount(sellerId) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!sellerId) {
      setCount(0);
      return;
    }

    const q = query(
      collection(db, "orders"),
      where("sellerId", "==", sellerId),
      where("status", "==", "new")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => setCount(snapshot.size),
      (error) => {
        console.error("Yangi buyurtmalar sonini kuzatishda xatolik:", error);
        setCount(0);
      }
    );

    return () => unsubscribe();
  }, [sellerId]);

  return count;
}
