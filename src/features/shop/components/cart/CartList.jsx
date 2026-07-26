import {IoTrashOutline } from "@/constants/icons";
import CartItem from "@/features/shop/components/cart/CartItem.jsx";
const CartList = ({ cartItems, updateQuantity }) => {
  return (
    <div className="p-4 space-y-3">
      {cartItems.length > 0 ? (
        cartItems.map((item) => (
          <CartItem
            key={item.id}
            item={item}
            updateQuantity={updateQuantity}
          />
        ))
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
            <IoTrashOutline size={28} />
          </div>
          <p className="text-sm font-medium text-gray-400">Savatchangiz hozircha bo'sh</p>
      </div>)}
    </div>
  )
}
export default CartList