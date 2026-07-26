import { createSlice } from "@reduxjs/toolkit";

const getCartProducts = () => {
  try {
    const cartProducts = localStorage.getItem('cart');
    return cartProducts ? JSON.parse(cartProducts) : [];
  } catch(error) {
    console.log('LocalStorage da xatolik bor ' + error);
    return [];
  }
};

const cartSlice = createSlice({
  name: 'carts',
  initialState: {
    items: getCartProducts()
  },
  reducers: {
    toggleCartActions: (state, action) => {
      const product = action.payload;
      // 🔥 TUZATILDI: Mahsulot savatda allaqachon bormi, tekshiramiz (Takrorlanishni oldini oladi)
      const existingItem = state.items.find(item => item.id === product.id);
      
      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        state.items.push({...product, quantity: 1});
      }
      localStorage.setItem('cart', JSON.stringify(state.items));
    },
    removeCart: (state, action) => {
      const product = action.payload;
      state.items = state.items.filter(item => item.id !== product.id);
      localStorage.setItem('cart', JSON.stringify(state.items));
    },
    quantityDec: (state, action) => {
      const productId = action.payload;
      const item = state.items.find(item => item.id === productId);
      if (item) {
        if (item.quantity > 1) {
          item.quantity -= 1;
        } else {
          // 🔥 TUZATILDI: Soni 1 dan kamaysa, savatdan avtomat o'chadi
          state.items = state.items.filter(i => i.id !== productId);
        }
      }
      localStorage.setItem('cart', JSON.stringify(state.items));
    },
    quantityInc: (state, action) => {
      const productId = action.payload;
      const item = state.items.find(item => item.id === productId);
      // 🚨 TUZATILDI: if (item.quantity) xatosi olib tashlandi, oddiygina item bormiligi tekshiriladi
      if (item) {
        item.quantity += 1;
      }
      localStorage.setItem('cart', JSON.stringify(state.items));
    },
    clearCart: (state) => {
      state.items = [];
      localStorage.removeItem('cart');
    }
  }
});

export const { toggleCartActions, removeCart, quantityDec, quantityInc, clearCart } = cartSlice.actions;
export default cartSlice.reducer;
