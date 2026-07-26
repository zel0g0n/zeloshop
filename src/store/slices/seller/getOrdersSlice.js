import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  orders: [],
  loading: false,
  success: false,
  error: null,
  ordersCounter: 0
};

const getOrdersDataSlice = createSlice({
  name: 'sellerOrdersList',
  initialState,
  reducers: {
    setOrdersLoading(state) {
      state.loading = true;
      state.error = null;
      state.success = false;
    },

    setOrdersSuccess(state, action) {
      state.loading = false;
      state.success = true;
      state.error = null;
      state.orders = action.payload;
      state.ordersCounter = action.payload.length; // ✅ To'g'ri hisoblash
    },

    
    setOrdersError(state, action) {
      state.loading = false;
      state.success = false;
      state.error = action.payload;
    },

    // Statusni o'zgartirish uchun (optimistic update yoki mahalliy state o'zgarishi)
    changeOrderStatus(state, action) {
      const { orderId, newStatus } = action.payload;
      const order = state.orders.find(o => o.id === orderId);
      if (order) {
        order.status = newStatus;
      }
    }
  }
});

export const {
  setOrdersLoading,
  setOrdersSuccess,
  setOrdersError,
  changeOrderStatus
} = getOrdersDataSlice.actions;

export default getOrdersDataSlice.reducer;