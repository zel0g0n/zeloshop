import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import addProduct from "@/services/products/addProduct";

export const addProductAsyncThunk = createAsyncThunk(
  "product/addProduct",
  async (productData, { rejectWithValue }) => {
    try {
      return await addProduct(productData);
    } catch (error) {
      return rejectWithValue(
        error.message || "Mahsulot qo'shishda xatolik yuz berdi"
      );
    }
  }
);

const initialState = {
  loading: false,
  success: false,
  error: null,
};

const addProductSlice = createSlice({
  name: "addProduct",
  initialState,
  reducers: {
    resetAddProductState(state) {
      state.loading = false;
      state.success = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(addProductAsyncThunk.pending, (state) => {
        state.loading = true;
        state.success = false;
        state.error = null;
      })
      .addCase(addProductAsyncThunk.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
        state.error = null;
      })
      .addCase(addProductAsyncThunk.rejected, (state, action) => {
        state.loading = false;
        state.success = false;
        state.error = action.payload; // Servisdan qaytgan aniq xato xabari
      });
  },
});

export const { resetAddProductState } = addProductSlice.actions;
export default addProductSlice.reducer;