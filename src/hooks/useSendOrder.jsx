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
  const activeBundle = useSelector(state => state.carts?.activeBundle || null);

  const sendOrder = useCallback(async (customerData, cartData, sellerId, userID) => {
    try {
      const result = await dispatch(sendOrderAsyncThunk({ 
        customerData, 
        cartData, 
        sellerId, 
        userID 
      })).unwrap();
      
      // MUHIM: `clearCart()` (pastda) endi JORIY sotuvchiga tegishli
      // (to'g'ri, sellerId bilan chegaralangan) kalitni o'zi
      // tozalaydi — shu sababli bu yerda alohida, ESKI (umumiy,
      // xato) `'cart'` kalitini qo'lda o'chirishga hojat yo'q.
      dispatch(clearCart());
      return result;
    } catch (err) {
      console.error("Hook order error:", err);
      // MUHIM TUZATISH: Redux Toolkit'ning `.unwrap()` funksiyasi
      // `rejectWithValue(string)` orqali rad etilgan thunk'larda
      // xato matnini ODDIY STRING sifatida "throw" qiladi (Error
      // obyekti emas). Bu, chaqiruvchi joyda `error.message` doim
      // `undefined` bo'lib, HAQIQIY server xatosi (masalan "omborda
      // yetarli emas") o'rniga umumiy "Buyurtma jo'natilmadi"
      // matni ko'rsatilishiga olib kelardi. Bu yerda har doim
      // to'g'ri `.message`ga ega Error obyektiga aylantiramiz.
      throw err instanceof Error ? err : new Error(typeof err === "string" ? err : "Buyurtma jo'natishda noma'lum xatolik yuz berdi.");
    }
  }, [dispatch]);

  return { sendOrder, loading, error, success, carts, activeBundle };
};

export default useSendOrder;
