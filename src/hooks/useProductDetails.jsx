import { singleProductAsyncThunk, clearProduct } from '@/store/slices/product/getSingleProductSlice';
import { useDispatch, useSelector } from 'react-redux';
import { useCallback } from 'react';

export const useProductDetail = () => {
  const dispatch = useDispatch();
  const { product, loading, error } = useSelector(state => state.singleProduct);

  const getSingleProduct = useCallback((id) => {
    dispatch(singleProductAsyncThunk(id));
  }, [dispatch]);

  const handleClearProduct = useCallback(() => {
    dispatch(clearProduct());
  }, [dispatch]);

  return { getSingleProduct, handleClearProduct, product, loading, error };
};