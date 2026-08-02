import { memo } from "react";
import {IoTrashOutline } from "@/constants/icons";
import CartItem from "@/features/shop/components/cart/CartItem.jsx";
import { useLanguage } from "@/context/LanguageContext";

// OLDIN: `updateQuantity` prop qabul qilinardi va CartItem'ga uzatilardi,
// lekin CartItem endi o'zining `useAddToCart` hooki orqali sonini
// mustaqil boshqaradi — bu prop hech qayerda ishlatilmasdi.
const CartList = ({ cartItems }) => {
  const { t } = useLanguage();
  return (
    <div className="p-4 space-y-3">
      {cartItems.length > 0 ? (
        cartItems.map((item) => (
          <CartItem
            key={item.id}
            item={item}
          />
        ))
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-gray-400 dark:text-slate-500">
            <IoTrashOutline size={28} />
          </div>
          <p className="text-sm font-medium text-gray-400 dark:text-slate-500">{t("cart.empty")}</p>
      </div>)}
    </div>
  )
}
export default memo(CartList)
