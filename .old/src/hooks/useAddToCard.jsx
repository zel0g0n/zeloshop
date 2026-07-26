import { useDispatch, useSelector } from 'react-redux';
import { useMemo } from 'react';
import { toggleCartActions, removeCart, quantityDec, quantityInc } from '@/store/slices/product/cartSlice';

const useAddToCart = (product) => {
  const dispatch = useDispatch();
  const carts = useSelector((state) => state.carts?.items || []);

  const cartItem = useMemo(() => {
    return carts.find((item) => item.id === product?.id);
  }, [carts, product?.id]);

  const quantity = cartItem ? cartItem.quantity : 0;
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


  return { isInCart, quantity, toggleCart, carts, removeFromCart, decrementQuantity, incrementQuantity };
};

export { useAddToCart };
