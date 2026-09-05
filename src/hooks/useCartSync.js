import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { useSession } from "@/context/SessionContext";
import { syncCartToFirestore } from "@/services/carts/syncCart";

const DEBOUNCE_MS = 4000;

/**
 * Savat o'zgarishlarini Firestore'ga DEBOUNCE qilingan holda
 * jo'natadi - "tashlab ketilgan savat" eslatmasi funksiyasi uchun
 * yagona ma'lumot manbai.
 *
 * MUHIM (Firebase xarajati): 4 soniyalik debounce - foydalanuvchi
 * sonni ketma-ket bir necha marta bossa (masalan +1, +1, +1), buning
 * barchasi BITTA Firestore yozuviga birlashadi, uchtasiga emas.
 *
 * FAQAT xaridor (client) rolida ishlaydi - sotuvchi/admin panelida
 * `clientId` umuman mavjud emas, shuning uchun bu yerda hech narsa
 * sodir bo'lmaydi (keraksiz yozuvlar yo'q).
 */
export const useCartSync = () => {
  const { sellerId, clientId } = useSession();
  const items = useSelector((state) => state.carts?.items || []);
  const debounceRef = useRef(null);
  const isFirstRunRef = useRef(true);

  useEffect(() => {
    if (!sellerId || !clientId) return;

    // BIRINCHI ishga tushishda (sahifa ochilganda, `hydrateCart`dan
    // keyin) DARHOL sinxronlamaymiz - bu, savat localStorage'dan
    // shunchaki O'QILGANI uchun, haqiqiy "faollik" emas. Faqat
    // FOYDALANUVCHI harakati (keyingi o'zgarishlar) sinxronlashni
    // ishga tushiradi.
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      syncCartToFirestore(sellerId, clientId, items);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [items, sellerId, clientId]);
};
