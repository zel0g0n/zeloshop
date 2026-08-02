import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import getProducts from "@/services/products/getProducts";

export const getProductAsyncThunk = createAsyncThunk(
  'products/fetchProducts',
  async (sellerId, { rejectWithValue }) => {
    try {
      const data = await getProducts(sellerId)
      return { products: data, sellerId }
    } catch (error) {
      return (rejectWithValue(error.message || `Xatolik yuz berdi`))
    }
  }
)

// OLDIN: qidiruv/filtr holati (`queryKey`, `activeCategory`, `activeType`)
// shu yerda, Redux'da (butun ilova uchun umumiy) saqlanardi. Bu Bosh
// sahifa va Katalog sahifasini keraksiz bog'lab qo'ygan edi. Endi bu
// holat faqat Katalogga tegishli — `context/CatalogFilterContext.jsx`da
// yashaydi. Bu yerda faqat HAQIQIY, umumiy ma'lumot — mahsulotlarning
// o'zi — saqlanadi.
const initialState = {
  products: [],
  loading: false,
  error: null,
  // Keshlangan `products` massivi AYNAN qaysi sotuvchiga tegishli
  // ekanini kuzatib boradi — shu orqali sotuvchi o'zgarsa (masalan
  // ikkinchi Mini App sessiyasi), eski keshdan foydalanib qolinmaydi.
  loadedForSellerId: null,
}

const getProductSlice = createSlice({
  name: 'products',
  reducers: {},
  initialState,
  extraReducers: (builder) => {
    builder
      .addCase(getProductAsyncThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getProductAsyncThunk.fulfilled, (state, action) => {
        state.products = action.payload.products
        state.loadedForSellerId = action.payload.sellerId
        state.loading = false
      })
      .addCase(getProductAsyncThunk.rejected, (state, action) => {
        state.error = action.payload
        state.loading = false
      })
  }
})

export default getProductSlice.reducer
