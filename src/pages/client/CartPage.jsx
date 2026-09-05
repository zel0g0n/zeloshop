import { useMemo } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import CartList from "@/features/shop/components/cart/CartList";
import { useCartList } from "../../hooks/useAddToCard";
import { useLanguage } from "@/context/LanguageContext";

const CartPage = () => {
  const navigate = useNavigate()
  const {carts} = useCartList()
  const { t } = useLanguage();
  const totalSum = useMemo(
    () => carts.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [carts]
  );

  return (
    <div className="bg-gray-50/50 dark:bg-slate-950 min-h-screen pb-44 transition-colors duration-300">
      <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 z-20 border-b border-gray-100 dark:border-slate-800 shadow-xs p-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center shrink-0 active:scale-95 transition-transform"
        >
          <ArrowLeft size={16} className="text-gray-600 dark:text-slate-300" />
        </button>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight flex-1">{t("cart.title")}</h1>
        <span className="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold px-2.5 py-1 rounded-lg shrink-0">
          {carts.length} {t("cart.itemsCount")}
        </span>
      </div>
      <div className="pt-4">
        <CartList cartItems={carts} />
      </div>
      {carts.length > 0 && (
        <div className="fixed bottom-24 left-0 right-0 z-40 px-[10px]">
          <div className="max-w-[440px] mx-auto bg-white/95 dark:bg-slate-900/95 border border-gray-100 dark:border-slate-800 p-4 flex items-center justify-between shadow-lg rounded-[24px]">
            <div>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider">{t("cart.total")}</p>
              <p className="text-xl font-black text-gray-800 dark:text-white">{totalSum.toLocaleString()} so'm</p>
            </div>
            <button onClick={() => navigate('/checkout')} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-6 py-3.5 rounded-xl shadow-md shadow-blue-600/10 active:scale-95 transition-all duration-200">
              {t("cart.checkout")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;
