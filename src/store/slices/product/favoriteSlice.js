import { createSlice } from "@reduxjs/toolkit";

const getFavorites = () => {
  try {
    const favorites = localStorage.getItem('favorites');
    return favorites ? JSON.parse(favorites) : [];
  } catch(error) {
    console.log(`LocalStorageda xatolik bor!!! ${error}`);
    return [];
  }   
};

const favoritesSlice = createSlice({
  name: 'favorites',
  initialState: {
    items: getFavorites()
  },
  reducers: {
    toggleFavoriteAction: (state, action) => {
      const product = action.payload;
      const exists = state.items.some((item) => item.id === product.id);
      
      if (exists) {
        state.items = state.items.filter((item) => item.id !== product.id);
      } else {
        state.items.push(product);
      }
      
      localStorage.setItem('favorites', JSON.stringify(state.items));
    }
  }
});

export const { toggleFavoriteAction } = favoritesSlice.actions;
export default favoritesSlice.reducer;