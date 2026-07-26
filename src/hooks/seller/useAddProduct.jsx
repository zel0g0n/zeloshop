import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  addProductAsyncThunk,
  resetAddProductState,
} from "@/store/slices/seller/addProductSlice"; // Yo'lingizni tekshiring
import { useSession } from "@/context/SessionContext";

const useAddProduct = () => {
  const dispatch = useDispatch();
  const { sellerId } = useSession();

  // Redux store'dan stateni olamiz (agar u ulanmagan bo'lsa qulab tushmasligi uchun || {} qo'shildi)
  const { loading, success, error } = useSelector(
    (state) => state.addProduct || {}
  );

  // Mahsulot qo'shish funksiyasi
  const addProductData = useCallback(
    async (productData) => {
      // eslint-disable-next-line no-useless-catch
      try {
        // .unwrap() component ichidagi try/catch xatolikni ushlay olishi uchun kerak
        const result = await dispatch(
          addProductAsyncThunk({ productData, sellerId })
        ).unwrap();
        return result;
      } catch (err) {
        throw err; // Xatolikni komponentga uzatamiz
      }
    },
    [dispatch, sellerId]
  );

  // Statelarni tozalash funksiyasi
  const resetState = useCallback(() => {
    dispatch(resetAddProductState());
  }, [dispatch]);

  return {
    addProduct: addProductData,
    loading,
    success,
    error,
    resetState,
  };
};

export default useAddProduct;