import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import changeOrderStatus from "@/services/orders/changeOrderStatus";
export const updateOrderStatusAsyncThunk = createAsyncThunk(
  'orders/updateOrderStatus',
  async ({id, status},{rejectWithValue}) => {
    try {
      const result = await changeOrderStatus(id, status)
      return result
    } catch(error) {
      return rejectWithValue(error.message || 'Xatolik yuz berdi');
    }
  }
)

const initialState = {
  loading: false,
  status: '',
  error: null
}

const updateOrderSlice = createSlice({
  name: 'changeOrderStatus',
  reducers: {},
  initialState,
  extraReducers: (builder) => {
    builder
      .addCase(updateOrderStatusAsyncThunk.pending, state => {
        state.loading = true
      })
      .addCase(updateOrderStatusAsyncThunk.fulfilled, (state, action) => {
        state.error = false
        state.status = action.payload
        state.loading = false
      })
      .addCase(updateOrderStatusAsyncThunk.rejected, (state, action) => {
        state.error = true
        state.error = action.payload
      })
  }
})

export default updateOrderSlice.reducer