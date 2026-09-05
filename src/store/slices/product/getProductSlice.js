import { createSlice } from "@reduxjs/toolkit";

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
  reducers: {
    // Obuna boshlanganda (birinchi ma'lumot hali kelmagan bo'lsa).
    productsLoading: (state) => {
      state.loading = true;
      state.error = null;
    },
    // Jonli (real-vaqtli) obuna orqali kelgan yangilanish — bu,
    // BIRINCHI yuklashdan KEYIN, istalgan vaqtda (masalan sotuvchi
    // mahsulotni o'chirganda) qayta-qayta chaqirilishi mumkin.
    productsLiveUpdated: (state, action) => {
      state.products = action.payload.products;
      state.loadedForSellerId = action.payload.sellerId;
      state.loading = false;
      state.error = null;
    },
    productsLoadError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
  },
  initialState,
})

export const { productsLoading, productsLiveUpdated, productsLoadError } = getProductSlice.actions;
export default getProductSlice.reducer
