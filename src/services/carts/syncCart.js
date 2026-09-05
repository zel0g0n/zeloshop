import { db } from "@/firebase/config";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

/**
 * Savatni Firestore'ga sinxronlaydi - "tashlab ketilgan savat"
 * eslatmasini (`functions/carts.js`dagi vaqt bo'yicha funksiya)
 * ishga tushirish uchun kerak bo'lgan YAGONA ma'lumot manbai.
 *
 * MUHIM: bu funksiya HAR BIR SAVAT O'ZGARISHIDA emas, balki
 * DEBOUNCE qilingan holda (`useCartSync.js`) chaqiriladi - shu
 * orqali Firestore yozuvlari soni (demak, Firebase xarajati) tabiiy
 * ravishda kam ushlanadi, hatto foydalanuvchi sonni tez-tez
 * o'zgartirsa ham.
 *
 * Hujjat ID'si `{sellerId}_{clientId}` - har bir mijoz-sotuvchi
 * juftligi uchun BITTA hujjat, cheksiz ko'payib ketmaydi.
 */
export const syncCartToFirestore = async (sellerId, clientId, items) => {
  if (!sellerId || !clientId) return;
  const cartRef = doc(db, "carts", `${sellerId}_${clientId}`);

  try {
    if (!items || items.length === 0) {
      // Savat bo'shagan - eslatma yuborishga hojat yo'q, hujjatni
      // butunlay o'chirib qo'yamiz (bo'sh holatni saqlab turishning
      // ma'nosi yo'q).
      await deleteDoc(cartRef).catch(() => {}); // hujjat allaqachon yo'q bo'lsa - muammo emas
      return;
    }

    await setDoc(
      cartRef,
      {
        sellerId,
        clientId,
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          image: item.image || null,
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 1,
        })),
        // MUHIM: har bir sinxronlashda "active"ga qaytariladi - agar
        // bu savat avval "reminded" (eslatma yuborilgan) holatda
        // bo'lsa-yu, mijoz qaytib savatni yana o'zgartirsa, bu YANGI
        // faollik hisoblanadi va eslatma tizimi uni qayta kuzata
        // boshlaydi.
        status: "active",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    // Bu - FONDA ishlaydigan, MUHIM BO'LMAGAN sinxronlash (savatning
    // o'zi baribir localStorage'da to'liq ishlaydi) - xato bo'lsa,
    // faqat konsolga yozamiz, foydalanuvchi tajribasiga ta'sir
    // qilmaydi.
    console.error("Savatni sinxronlashda xatolik:", error);
  }
};
