import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useSession } from "@/context/SessionContext";
import { useLiveShopProducts } from "@/hooks/useLiveShopProducts";
import { pickCheckoutCrossSell } from "@/utils/checkoutCrossSell";

/**
 * `useRelatedProducts.jsx` bilan bir xil naqsh (jonli Redux keshidan
 * o'qish, sof hisoblash funksiyasini chaqirish), lekin BITTA mahsulot
 * o'rniga SAVATDAGI BARCHA mahsulotlarni hisobga oladi - checkout
 * sahifasidagi "ko'pincha birga olishadi" bloki uchun.
 */
export const useCheckoutCrossSell = (cartItems) => {
  const { sellerId, store } = useSession();
  useLiveShopProducts(sellerId);

  const { products } = useSelector((state) => state.products);

  return useMemo(() => {
    try {
      // 15-NICHE UNIVERSAL PLATFORMA: `nicheId` (store.category) 3-daraja
      // ("bog'liq kategoriya") zaxirasi uchun uzatiladi.
      return pickCheckoutCrossSell(products, cartItems, { nicheId: store?.category });
    } catch (error) {
      console.error("Checkout cross-sell hisoblashda xatolik:", error);
      return { items: [], basis: "none" };
    }
  }, [products, cartItems, store?.category]);
};
