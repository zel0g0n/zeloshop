import { memo } from "react";
import { MdOutlineShoppingBag } from "@/constants/icons";
import { useAddToCart } from "@/hooks/useAddToCard";
import { useNavigate } from "react-router";
import { useLanguage } from "@/context/LanguageContext";

/**
 * MUHIM TUZATISH: OLDIN bu panel `position: fixed` bilan ekranning
 * pastida DOIM suzib turardi - sahifa hali yuqorida (mahsulot
 * rasmi ko'rinib turgan joyda) bo'lsa ham, bu panel RASMNING
 * USTIGA tushib, uni to'sib qo'yardi. Endi bu - ODDIY, sahifa
 * oqimidagi (document flow) element - `ProductDetailPage.jsx`dagi
 * boshqa bo'limlar (narx, tavsif) bilan BIR XIL konteyner ichida
 * joylashgan, shuning uchun o'zining alohida kenglik/padding
 * o'rami SHART EMAS (ikki marta padding qo'shilib qolmasligi uchun).
 */
export const BottomBuyBar = memo(({price, product}) => {
  const { t } = useLanguage();
  const {toggleCart} = useAddToCart(product)
  const navigate = useNavigate()
  const buyNow = () => {
    toggleCart()
    navigate('/checkout')
  }
  return (
    <div className="flex items-center justify-between rounded-[32px] border border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-900 p-4 shadow-[0_8px_30px_rgba(37,99,235,0.1)]">

      <div>
        <p className="text-sm text-slate-400 dark:text-slate-500">
          {t("productDetail.totalPrice")}
        </p>

        <h3 className="mt-1 text-[20px] font-black leading-none text-blue-600 dark:text-blue-400">
          {(Number(price) || 0).toLocaleString()} so'm
        </h3>
      </div>

      <div className="flex items-center gap-3">

        <button onClick={ toggleCart} className="flex h-[58px] w-[58px] items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition-all duration-300 active:scale-95">
          <MdOutlineShoppingBag className="text-[24px]" />
        </button>

        <button onClick={buyNow} className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-7 py-4 text-sm font-bold text-white shadow-[0_10px_30px_rgba(37,99,235,0.35)] transition-all duration-300 active:scale-95">
          {t("productDetail.buyNow")}
        </button>
      </div>
    </div>
  );
});
