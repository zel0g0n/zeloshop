import { createSlice,createAsyncThunk } from "@reduxjs/toolkit";
import getProducts from "@/services/products/getProducts";

export const getProductAsyncThunk  = createAsyncThunk(
  'products/fetchProducts',
  async (_, {rejectWithValue}) => {
    try {
      const data = await getProducts()
      return data
    } catch (error) {
      return (rejectWithValue(error.message || `Xatolik yuz berdi`))
    }
  }
)

const initialState = {
  products: [],
  loading: false,
  error: null,
  queryKey: "",
  activeCategory: "all"
}

const getProductSlice = createSlice({
  name: 'products',
  reducers: {
    liveSearchProduct: (state, action) => {
      state.queryKey = action.payload
    },
    filterCategory: (state, action) => {
      state.activeCategory = action.payload
    }
   
    
  },
  initialState,
  extraReducers: (builder) => {
    builder
      .addCase(getProductAsyncThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getProductAsyncThunk.fulfilled, (state,action) => {
        state.products = action.payload
        state.loading = false
      })
      .addCase(getProductAsyncThunk.rejected, (state, action) => {
        state.error = action.payload
        state.loading = false
      })
  }
})
export const {liveSearchProduct, filterCategory} = getProductSlice.actions
export default getProductSlice.reducer