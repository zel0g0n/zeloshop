import { useNavigate } from "react-router";
import CartList from "@/features/shop/components/cart/CartList";
import { useCartList } from "../../hooks/useAddToCard";



const CartPage = () => {
  const navigate = useNavigate()
  const {carts} = useCartList()
  const totalSum = carts.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="bg-gray-50/50 min-h-screen pb-44">
      <div className="sticky top-0  backdrop-blur-md z-20 border-b border-gray-100 p-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">Savatcha</h1>
        <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2.5 py-1 rounded-lg">
          {carts.length} ta mahsulot
        </span>
      </div>
      <CartList cartItems={carts}  />
      {carts.length > 0 && (
        <div className="fixed bottom-[74px] left-0 right-0 max-w-[440px] mx-auto bg-white/90 backdrop-blur-md border-t border-gray-100 p-4 flex items-center justify-between shadow-[0_-8px_24px_rgba(0,0,0,0.04)] z-20 rounded-t-[24px]">
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Jami summa:</p>
            <p className="text-xl font-black text-gray-800">${totalSum}</p>
          </div>
          <button onClick={() => navigate('/checkout')} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-6 py-3.5 rounded-xl shadow-md shadow-blue-600/10 active:scale-95 transition-all duration-200">
            Xaridni rasmiylashtirish
          </button>
        </div>
      )}
    </div>
  );
};

export default CartPage;