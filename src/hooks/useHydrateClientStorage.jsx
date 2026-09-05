import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useSession } from "@/context/SessionContext";
import { hydrateCart } from "@/store/slices/product/cartSlice";
import { hydrateFavorites } from "@/store/slices/product/favoriteSlice";

/**
 * Savat va sevimlilarni, HAQIQIY (joriy) sotuvchiga tegishli
 * localStorage kalitidan yuklaydi. `sellerId` o'zgarsa (masalan,
 * mijoz boshqa sotuvchining do'kon havolasi orqali qayta kirsa),
 * qayta yuklaydi — shu orqali oldingi sotuvchining savati/
 * sevimlilari YANGI sotuvchida hech qachon ko'rinmaydi.
 */
export function useHydrateClientStorage() {
  const dispatch = useDispatch();
  const { sellerId } = useSession();

  useEffect(() => {
    if (!sellerId) return;
    dispatch(hydrateCart(sellerId));
    dispatch(hydrateFavorites(sellerId));
  }, [dispatch, sellerId]);
}
