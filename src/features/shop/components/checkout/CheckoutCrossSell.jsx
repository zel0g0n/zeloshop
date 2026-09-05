import { memo } from "react";
import { useCheckoutCrossSell } from "@/hooks/useCheckoutCrossSell";
import { productHorizontalListStyle } from "@/constants/custom-css";
import ProductList from "../product/ProductList";
import { useLanguage } from "@/context/LanguageContext";

/**
 * Checkout'dagi "ko'pincha birga olishadi" bloki - `RelatedProducts.jsx`
 * (mahsulot sahifasidagi) bilan bir xil g'oya, faqat BITTA mahsulot
 * o'rniga SAVATDAGI BARCHA mahsulotlarga asoslanadi
 * (`useCheckoutCrossSell.jsx`). Har bir tavsiya odatdagi `ProductCard`
 * orqali ko'rsatiladi - shu bilan mavjud "bir tugma bilan savatga
 * qo'shish/soni oshirish" mantig'i (`useAddToCart`) va kam-qoldiq/
 * ko'p-sotilgan belgilari BEPUL qayta ishlatiladi.
 */
const CheckoutCrossSell = memo(({ cartItems }) => {
  const { t } = useLanguage();
  const { items, basis } = useCheckoutCrossSell(cartItems);

  // Bo'sh bo'lsa, sarlavhasi bilan bo'sh joy qoldirish o'rniga butunlay yashiramiz.
  if (items.length === 0) return null;

  const titleKey = basis === "cooccurrence" ? "checkout.crossSellTitleFrequentlyBought" : "checkout.crossSellTitle";

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-gray-100/80 dark:border-slate-800">
      <h2 className="text-sm font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">{t(titleKey)}</h2>
      <ProductList products={items} filterTypeStyle={productHorizontalListStyle} isHorizontal />
    </div>
  );
});

CheckoutCrossSell.displayName = "CheckoutCrossSell";
export default CheckoutCrossSell;
