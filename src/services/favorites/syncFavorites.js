import { db } from "@/firebase/config";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

/**
 * Sevimlilar ro'yxatini Firestore'ga sinxronlaydi - "like bosilgan
 * mahsulotni sotib olishga undash" bildirishnomasini ishga
 * tushirish uchun kerak bo'lgan yagona ma'lumot manbai.
 *
 * Sevimlilar faqat `localStorage`da saqlansa, server nimani
 * yoqtirilganini bila olmaydi, shuning uchun "like bosilgan
 * mahsulotga eslatma" funksiyasi serverda amalga oshirilishi uchun
 * bu ma'lumot Firestore'da ham saqlanishi kerak. `useCartSync.js`/
 * `syncCart.js` bilan bir xil, tekshirilgan naqsh (debounce, faqat
 * mijoz rolida, hujjat ID'si `{sellerId}_{clientId}`) qo'llaniladi.
 */
export const syncFavoritesToFirestore = async (sellerId, clientId, items) => {
  if (!sellerId || !clientId) return;
  const favRef = doc(db, "favorites", `${sellerId}_${clientId}`);

  try {
    if (!items || items.length === 0) {
      await deleteDoc(favRef).catch(() => {});
      return;
    }

    await setDoc(
      favRef,
      {
        sellerId,
        clientId,
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          image: item.image || null,
          price: Number(item.price) || 0,
        })),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Sevimlilarni sinxronlashda xatolik:", error);
  }
};
