import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  addProductAsyncThunk,
  resetAddProductState,
} from "@/store/slices/seller/addProductSlice"; // Yo'lingizni tekshiring

const useAddProduct = () => {
  const dispatch = useDispatch();

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
        const result = await dispatch(addProductAsyncThunk(productData)).unwrap();
        return result;
      } catch (err) {
        throw err; // Xatolikni komponentga uzatamiz
      }
    },
    [dispatch]
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