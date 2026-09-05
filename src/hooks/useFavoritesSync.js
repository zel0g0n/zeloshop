import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { useSession } from "@/context/SessionContext";
import { syncFavoritesToFirestore } from "@/services/favorites/syncFavorites";

const DEBOUNCE_MS = 4000;

/**
 * Sevimlilar o'zgarishlarini Firestore'ga DEBOUNCE qilingan holda
 * jo'natadi - `useCartSync.js` bilan BIR XIL naqsh, "like bosilgan
 * mahsulotga eslatma" funksiyasi uchun yagona ma'lumot manbai.
 */
export const useFavoritesSync = () => {
  const { sellerId, clientId } = useSession();
  const items = useSelector((state) => state.favorites?.items || []);
  const debounceRef = useRef(null);
  const isFirstRunRef = useRef(true);

  useEffect(() => {
    if (!sellerId || !clientId) return;

    // Birinchi ishga tushishda (localStorage'dan o'qilgandan keyin)
    // darhol sinxronlamaymiz - bu haqiqiy foydalanuvchi harakati emas.
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      syncFavoritesToFirestore(sellerId, clientId, items);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [items, sellerId, clientId]);
};
