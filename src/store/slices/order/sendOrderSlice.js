import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import sendOrder from "@/services/orders/sendOrderData";

export const sendOrderAsyncThunk = createAsyncThunk(
  'orders/sendOrderAsync',
  async ({ customerData, cartData, sellerId, userID }, { rejectWithValue }) => {
    try {
      // Servicce'ga barcha kerakli IDlarni uzatamiz
      const data = await sendOrder(customerData, cartData, sellerId, userID);
      return data;
    } catch (error) {
      return rejectWithValue(error.message || `Xatolik yuz berdi`);
    }
  }
);

const initialState = {
  orders: [],
  loading: false,
  error: null,
  success: false 
};

const sendOrderSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    resetOrderStatus: (state) => {
      state.success = false;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder 
      .addCase(sendOrderAsyncThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(sendOrderAsyncThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.orders.push(action.payload); 
      })
      .addCase(sendOrderAsyncThunk.rejected, (state, action) => {
        state.loading = false;
        state.success = false;
        state.error = action.payload;
      })
      
  }
});

export const { resetOrderStatus } = sendOrderSlice.actions;
export default sendOrderSlice.reducer;
