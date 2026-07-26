import { singleProductAsyncThunk, clearProduct } from '@/store/slices/product/getSingleProductSlice';
import { useDispatch, useSelector } from 'react-redux';

export const useProductDetail = () => {
  const dispatch = useDispatch();
  // 🔥 loading holatini ham olamiz
  const { product, loading, error } = useSelector(state => state.singleProduct);

  const getSingleProduct = (id) => {
    dispatch(singleProductAsyncThunk(id));
  };

  // 🔥 Sahifadan chiqib ketganda yoki id o'zgarganda tozalash uchun
  const handleClearProduct = () => {
    dispatch(clearProduct());
  };

  return { getSingleProduct, handleClearProduct, product, loading, error };
};