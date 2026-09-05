import { createSlice } from "@reduxjs/toolkit";

// XAVFSIZLIK/MA'LUMOT TOZALIGI TUZATISHI: cartSlice.js bilan bir xil
// sabab — sevimlilar ro'yxati endi har bir sotuvchi uchun ALOHIDA
// kalitda (`favorites:{sellerId}`) saqlanadi, va faqat sellerId
// ma'lum bo'lgach yuklanadi.
const buildKey = (sellerId) => `favorites:${sellerId}`;

const readFavoritesFor = (sellerId) => {
  if (!sellerId) return [];
  try {
    const raw = localStorage.getItem(buildKey(sellerId));
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.log(`LocalStorageda xatolik bor!!! ${error}`);
    return [];
  }
};

const favoritesSlice = createSlice({
  name: 'favorites',
  initialState: {
    items: [],
    scopedSellerId: null,
  },
  reducers: {
    hydrateFavorites: (state, action) => {
      const sellerId = action.payload;
      state.scopedSellerId = sellerId;
      state.items = readFavoritesFor(sellerId);
    },
    toggleFavoriteAction: (state, action) => {
      const product = action.payload;
      const exists = state.items.some((item) => item.id === product.id);

      if (exists) {
        state.items = state.items.filter((item) => item.id !== product.id);
      } else {
        state.items.push(product);
      }

      if (state.scopedSellerId) {
        localStorage.setItem(buildKey(state.scopedSellerId), JSON.stringify(state.items));
      }
    }
  }
});

export const { hydrateFavorites, toggleFavoriteAction } = favoritesSlice.actions;
export default favoritesSlice.reducer;
