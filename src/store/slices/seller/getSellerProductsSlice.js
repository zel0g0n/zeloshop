import { createSlice} from "@reduxjs/toolkit";


const initialState = {
  products: [],
  loading: false,
  error: null,
  productsCounter: 0,
  success: false
}


const getSellerProductsSlice = createSlice({
  name: 'sellerProductsList',
  initialState,
  reducers: {
    setProductsLoading(state) {
      state.loading = true;
      state.error = null;
      state.success = false;
    },
    setProductsSuccess(state, action) {
      state.loading = false;
      state.success = true;
      state.error = null;
      state.products = action.payload;
      state.productsCounter = state.products.length;
    },
    setProductsError(state, action) {
      state.loading = false;
      state.success = false;
      state.error = action.payload;
    }
  }
});


export const {
  setProductsLoading,
  setProductsSuccess,
  setProductsError
} = getSellerProductsSlice.actions;

export default getSellerProductsSlice.reducer;