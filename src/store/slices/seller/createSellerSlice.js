import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import createSeller from "@/services/sellers/createSeller";

export const createSellerAsyncThunk = createAsyncThunk(
  "seller/createSeller",
  async ({ uid, storeData }, { rejectWithValue }) => {
    try {
      return await createSeller(uid, storeData);
    } catch (error) {
      return rejectWithValue(error.message || "Do'kon yaratishda xatolik yuz berdi");
    }
  }
);

const initialState = {
  loading: false,
  error: null,
  success: false,
};

const createSellerSlice = createSlice({
  name: "createSeller",
  initialState,
  reducers: {
    resetCreateSellerStatus: (state) => {
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createSellerAsyncThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createSellerAsyncThunk.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(createSellerAsyncThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { resetCreateSellerStatus } = createSellerSlice.actions;
export default createSellerSlice.reducer;
