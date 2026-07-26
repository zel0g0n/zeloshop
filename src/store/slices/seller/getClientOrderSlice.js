import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  orders: [],
  loading: false,
  success: false,
  error: null,
  ordersCounter: 0
};

const getClientOrdersDataSlice = createSlice({
  name: 'clientOrdersList',

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
      state.ordersCounter = state.orders.length;
    },

    setOrdersError(state, action) {
      state.loading = false;
      state.success = false;
      state.error = action.payload;
    }

  }

});

export const {
  setOrdersLoading,
  setOrdersSuccess,
  setOrdersError
} = getClientOrdersDataSlice.actions;

export default getClientOrdersDataSlice.reducer;