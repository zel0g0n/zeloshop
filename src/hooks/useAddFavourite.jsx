import { useDispatch, useSelector } from 'react-redux';
import { toggleFavoriteAction } from '@/store/slices/product/favoriteSlice';

// Xuddi useAddToCard.jsx dagi kabi — faqat shu mahsulotga tegishli
// boolean useSelector ICHIDA hisoblanadi, shunda boshqa mahsulot
// yoqtirilganda/olib tashlanganda bu komponent qayta render bo'lmaydi.
const useAddFavorite = (product) => {
  const dispatch = useDispatch();
  const productId = product?.id;

  const isFavorite = useSelector((state) =>
    productId ? Boolean(state.favorites?.items?.some((item) => item.id === productId)) : false
  );

  const toggleFavorite = () => {
    if (!product?.id) return;
    dispatch(toggleFavoriteAction(product));
  };

  return { isFavorite, toggleFavorite };
};

// To'liq ro'yxat kerak bo'lgan joylar uchun (Navbar badge, Saqlanganlar sahifasi).
export const useFavoritesList = () => {
  const favorites = useSelector((state) => state.favorites?.items || []);
  return { favorites };
};

export { useAddFavorite };
