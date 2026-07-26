import { useSelector, useDispatch } from "react-redux";
import { useCallback } from "react";
import { sendOrderAsyncThunk } from "@/store/slices/order/sendOrderSlice";
import { clearCart } from "../store/slices/product/cartSlice";
const useSendOrder = () => {
  const dispatch = useDispatch();
  const loading = useSelector(state => state.orders?.loading);
  const error = useSelector(state => state.orders?.error);
  const success = useSelector(state => state.orders?.success);
  const carts = useSelector(state => state.carts?.items || []);

  const sendOrder = useCallback(async (customerData, cartData, sellerId, userID) => {
    try {
      const result = await dispatch(sendOrderAsyncThunk({ 
        customerData, 
        cartData, 
        sellerId, 
        userID 
      })).unwrap();
      
      localStorage.removeItem('cart'); 
      dispatch(clearCart());
      return result;
    } catch (err) {
      console.error("Hook order error:", err);
      throw err;
    }
  }, [dispatch]);

  return { sendOrder, loading, error, success, carts };
};

export default useSendOrder;
