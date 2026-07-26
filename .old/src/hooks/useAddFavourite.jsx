import { useDispatch, useSelector } from 'react-redux';
import { toggleFavoriteAction } from '@/store/slices/product/favoriteSlice';

const useAddFavorite = (product) => {
  const dispatch = useDispatch();
  const favorites = useSelector((state) => state.favorites.items || []);

  const isFavorite = product?.id 
    ? favorites.some((item) => item.id === product.id) 
    : false;

  const toggleFavorite = () => {
    if (!product?.id) return;
    dispatch(toggleFavoriteAction(product));
  };

  return { isFavorite, toggleFavorite, favorites };
};

export { useAddFavorite };