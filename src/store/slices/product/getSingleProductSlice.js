import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import getSingleProduct from "@/services/products/getSingleProduct";

export const singleProductAsyncThunk = createAsyncThunk(
  'products/fetchSingleProduct',
  async (productId, { getState, rejectWithValue }) => {
    try {
      if (!productId) return rejectWithValue("Mahsulot ID si taqdim etilmadi");

      // Mahsulot allaqachon (Home/Catalog orqali) Redux keshida bo'lsa,
      // Firestore'dan qayta o'qimaymiz — bitta getDoc chaqiruvi tejaladi.
      const cached = getState().products?.products?.find(
        (p) => String(p.id) === String(productId)
      );
      if (cached) return cached;

      const data = await getSingleProduct(productId);
      return data;
    } catch (error) {
      return rejectWithValue(error.message || `Xatolik yuz berdi`);
    }
  }
)

const initialState = {
  product: null,
  loading: false,
  error: null
}

const singleProductSlice = createSlice({
  name: 'singleProduct',
  initialState,
  reducers: {
    clearProduct: (state) => {
      state.product = null;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(singleProductAsyncThunk.pending, (state) => {
        state.loading = true;
        state.product = null; 
        state.error = null;
      })
      .addCase(singleProductAsyncThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.product = action.payload;
      })
      .addCase(singleProductAsyncThunk.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
      })
  }
})

export const { clearProduct } = singleProductSlice.actions;
export default singleProductSlice.reducer;