import { AiOutlineMinus, AiOutlinePlus, IoTrashOutline } from "@/constants/icons";
import {useAddToCart} from "@/hooks/useAddToCard";




const CartItem = ({ item }) => {
  const { removeFromCart, incrementQuantity, decrementQuantity, carts } = useAddToCart(item);
  
    return (
      <div 
        key={item.id} 
        className="flex justify-between bg-white rounded-[22px] border border-gray-100 p-2 shadow-sm hover:shadow-md/5 transition-all duration-300 relative overflow-hidden group"
      >
        <div className="w-[65%] flex items-center bg-gray-50 rounded-[18px] overflow-hidden shrink-0">
                      <img 
                        src={item.image} 
                        alt={item.title} 
                        className="w-24 h-24 object-cover"
                      />
                      <div className="px-3">
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                          {item.category}
                        </span>
                        <h3 className="text-sm font-bold text-gray-800 line-clamp-1 mt-0.5">
                          {item.title}
                        </h3>
                        <span className="text-base font-black text-blue-600">
                          ${item.price}
                        </span>
                      </div>
         </div>
      
          
      
        <div className=" flex flex-col gap-2 ">
          <div className="flex items-center justify-between bg-gray-100 rounded-xl p-1 gap-2 border border-gray-200/20">
            <button 
                              onClick={() => decrementQuantity()}
                              className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-blue-600 active:scale-90 transition-transform shadow-sm"
            >
              <AiOutlineMinus size={12} />
            </button>
            <span className="text-xs font-bold text-blue-600 min-w-[14px] text-center">
              {carts.find(cartItem => cartItem.id === item.id)?.quantity || item.quantity}
            </span>
            <button 
              onClick={() => incrementQuantity()}
              className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-blue-600 active:scale-90 transition-transform shadow-sm"
            >
              <AiOutlinePlus size={12} />
            </button>
                            
          </div>
          <button 
            onClick={() => removeFromCart()}
            className="w-full h-9 bg-gray-100 text-blue-600 flex items-center justify-center rounded-[12px]"
          >
            <IoTrashOutline size={18} />
          </button>
        </div>
      </div>
    )
}

export default CartItem