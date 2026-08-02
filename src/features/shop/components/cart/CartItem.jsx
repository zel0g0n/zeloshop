import { memo } from "react";
import { AiOutlineMinus, AiOutlinePlus, IoTrashOutline } from "@/constants/icons";
import {useAddToCart} from "@/hooks/useAddToCard";

const CartItem = ({ item }) => {
  // Hook o'zi shu mahsulotning savatdagi joriy sonini (quantity) qaytaradi —
  // avvalgidek alohida to'liq `carts` massivini olib, qayta qidirish
  // shart emas (bu ham ortiqcha render manbai edi).
  const { removeFromCart, incrementQuantity, decrementQuantity, quantity } = useAddToCart(item);

  // OLDIN: `item.title` ishlatilgan edi, lekin haqiqiy Firestore mahsulot
  // hujjatida bu maydon `name` deb ataladi (`title` faqat qo'shish
  // formasining vaqtinchalik holatida bo'ladi) — natijada savatdagi
  // mahsulot nomi va rasm alt matni doim BO'SH ko'rinardi.
  const title = item.name || item.title || "Nomsiz mahsulot";

    return (
      <div 
        className="flex justify-between bg-white dark:bg-slate-900 rounded-[22px] border border-gray-100 dark:border-slate-800 p-2 shadow-sm hover:shadow-md/5 transition-all duration-300 relative overflow-hidden group"
      >
        <div className="w-[65%] flex items-center bg-gray-50 dark:bg-slate-800 rounded-[18px] overflow-hidden shrink-0">
                      <img 
                        src={item.image} 
                        alt={title} 
                        className="w-24 h-24 object-cover"
                      />
                      <div className="px-3">
                        <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500 tracking-wider">
                          {item.category}
                        </span>
                        <h3 className="text-sm font-bold text-gray-800 dark:text-white line-clamp-1 mt-0.5">
                          {title}
                        </h3>
                        <span className="text-base font-black text-blue-600 dark:text-blue-400">
                          {Number(item.price).toLocaleString()} so'm
                        </span>
                      </div>
         </div>
      
          
      
        <div className=" flex flex-col gap-2 ">
          <div className="flex items-center justify-between bg-gray-100 dark:bg-slate-800 rounded-xl p-1 gap-2 border border-gray-200/20 dark:border-slate-700">
            <button 
                              onClick={() => decrementQuantity()}
                              className="w-8 h-8 bg-white dark:bg-slate-700 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400 active:scale-90 transition-transform shadow-sm"
            >
              <AiOutlineMinus size={12} />
            </button>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 min-w-[14px] text-center">
              {quantity || item.quantity}
            </span>
            <button 
              onClick={() => incrementQuantity()}
              className="w-8 h-8 bg-white dark:bg-slate-700 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400 active:scale-90 transition-transform shadow-sm"
            >
              <AiOutlinePlus size={12} />
            </button>
                            
          </div>
          <button 
            onClick={() => removeFromCart()}
            className="w-full h-9 bg-gray-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 flex items-center justify-center rounded-[12px]"
          >
            <IoTrashOutline size={18} />
          </button>
        </div>
      </div>
    )
}

export default memo(CartItem)
