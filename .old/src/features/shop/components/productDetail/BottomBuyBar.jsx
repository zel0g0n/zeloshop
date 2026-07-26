import { MdOutlineShoppingBag } from "@/constants/icons";
import { useAddToCart } from "@/hooks/useAddToCard";
import { useNavigate } from "react-router";

export const BottomBuyBar = ({price, product}) => {
  const {toggleCart} = useAddToCart(product)
  const navigate = useNavigate()
  const buyNow = () => {
    navigate('/checkout')
    toggleCart()
  }
  return (
    <div className="fixed bottom-[120px] left-0 right-0 z-50 px-4">
      
      <div className="max-w-[440px] mx-auto">
        
        <div className="flex items-center justify-between rounded-[32px] border border-white/20 bg-white/80 p-4 shadow-[0_12px_40px_rgba(37,99,235,0.18)] backdrop-blur-2xl">
          
          <div>
            <p className="text-sm text-slate-400">
              Total Price
            </p>

            <h3 className="mt-1 text-[20px] font-black leading-none text-blue-600">
              {price} so'm
            </h3>
          </div>

          <div className="flex items-center gap-3">
            
            <button onClick={ toggleCart} className="flex h-[58px] w-[58px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-slate-700 transition-all duration-300 active:scale-95">
              <MdOutlineShoppingBag className="text-[24px]" />
            </button>

            <button onClick={buyNow} className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-7 py-4 text-sm font-bold text-white shadow-[0_10px_30px_rgba(37,99,235,0.35)] transition-all duration-300 active:scale-95">
              Buy Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
