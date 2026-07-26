import { useDispatch, useSelector } from 'react-redux';
import { toggleCartActions, removeCart, quantityDec, quantityInc } from '@/store/slices/product/cartSlice';

// OLDIN: bu hook har chaqirilganda `state.carts.items` (TO'LIQ massiv)ga
// obuna bo'lardi, keyin komponent ichida `.find()` bilan kerakli elementni
// qidirardi. Muammo: Redux Toolkit (Immer) har bir savat o'zgarishida
// (boshqa mahsulot qo'shilsa ham) YANGI massiv obyektini yaratadi — bu esa
// useSelector'ning standart tenglik tekshiruvidan o'tolmay, HAR BIR
// ProductCard/CartItem componentini (hattoki o'zgarishga aloqasi bo'lmagan
// mahsulotlar ham) qayta render qilishga majburlardi.
//
// ENDI: faqat shu MAHSULOTGA tegishli yozuv useSelector ICHIDA qidiriladi.
// Redux Toolkit/Immer o'zgarmagan elementlar uchun eski obyekt referensini
// saqlab qoladi (structural sharing) — shu sabab boshqa mahsulot
// o'zgarganda bu komponent umuman qayta render bo'lmaydi.
export const useAddToCart = (product) => {
  const dispatch = useDispatch();
  const productId = product?.id;

  const cartItem = useSelector((state) =>
    productId ? state.carts?.items?.find((item) => item.id === productId) : undefined
  );

  const quantity = cartItem?.quantity || 0;
  const isInCart = quantity > 0;

  const toggleCart = () => {
    if (!product?.id) return;
    dispatch(toggleCartActions(product));
  };

  const decrementQuantity = () => {
    if (!product?.id) return;
    dispatch(quantityDec(product.id));
  };

  const incrementQuantity = () => {
    if (!product?.id) return;
    dispatch(quantityInc(product.id));
  };

  const removeFromCart = () => {
    if (!product?.id) return;
    dispatch(removeCart(product));
  };

  return { isInCart, quantity, toggleCart, removeFromCart, decrementQuantity, incrementQuantity };
};

// Savatning TO'LIQ ro'yxati kerak bo'lgan joylar uchun (masalan CartPage) —
// bu hook ataylab har qanday savat o'zgarishida qayta render bo'ladi,
// chunki bu sahifa aynan shuni ko'rsatishi kerak.
export const useCartList = () => {
  const carts = useSelector((state) => state.carts?.items || []);
  return { carts };
};
