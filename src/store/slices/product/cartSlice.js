import { createSlice } from "@reduxjs/toolkit";

// XAVFSIZLIK/MA'LUMOT TOZALIGI TUZATISHI: OLDIN savat bitta, UMUMIY
// `'cart'` kalitida saqlanardi — sotuvchidan qat'i nazar. Bu degani,
// agar mijoz 2-3 xil sotuvchining do'konidan foydalansa, BIR
// do'kondagi savat, boshqa do'konni ochganda ham KO'RINIB QOLARDI —
// hatto o'sha mahsulotlar bu (joriy) sotuvchiga umuman tegishli
// bo'lmasa ham! Endi har bir sotuvchi uchun ALOHIDA kalit
// (`cart:{sellerId}`) ishlatiladi, va savat FAQAT sellerId ma'lum
// bo'lgach ("hydrateCart" orqali) yuklanadi — modul yuklanish
// vaqtida emas (chunki o'sha payt sellerId hali noma'lum).
const buildKey = (sellerId) => `cart:${sellerId}`;

// TUZATISH (mahsulot bandllari/combo takliflar): OLDIN localStorage'da
// FAQAT savat massivi saqlanardi. Endi "hozir FAOL combo qaysi"
// ma'lumoti ham SHU YERDA, BIR XIL kalitda saqlanadi — aks holda
// sahifa yangilanganda (F5) combo holati yo'qolib, mijoz combo
// mahsulotlarini savatda ko'rgani holda, chegirma checkout'da
// kutilmaganda yo'qolib qolardi. Eski (faqat massiv) formatdagi
// saqlangan ma'lumotlar bilan ORQAGA MOSLIK ta'minlangan.
const readCartFor = (sellerId) => {
  if (!sellerId) return { items: [], activeBundle: null };
  try {
    const raw = localStorage.getItem(buildKey(sellerId));
    if (!raw) return { items: [], activeBundle: null };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { items: parsed, activeBundle: null };
    return {
      items: Array.isArray(parsed?.items) ? parsed.items : [],
      activeBundle: parsed?.activeBundle || null,
    };
  } catch (error) {
    console.log('LocalStorage da xatolik bor ' + error);
    return { items: [], activeBundle: null };
  }
};

const persistCart = (state) => {
  if (!state.scopedSellerId) return;
  localStorage.setItem(
    buildKey(state.scopedSellerId),
    JSON.stringify({ items: state.items, activeBundle: state.activeBundle })
  );
};

const cartSlice = createSlice({
  name: 'carts',
  initialState: {
    items: [],
    // Hozir yuklangan savat AYNAN qaysi sotuvchiga tegishli ekanini
    // kuzatib boradi — shu orqali sotuvchi o'zgarganda (masalan
    // boshqa do'kon havolasi orqali kirilganda), eski savat
    // NOTO'G'RI ko'rinib qolmaydi.
    scopedSellerId: null,
    // Mijoz mahsulot sahifasidan "combo sifatida qo'shish" tugmasini
    // bosgan bo'lsa - shu combo haqidagi ma'lumot (checkout'da
    // chegirmani OLDINDAN ko'rsatish uchun; HAQIQIY chegirma har doim
    // serverda - `functions/orders.js` - qayta hisoblanadi).
    activeBundle: null,
  },
  reducers: {
    // Sellerld ma'lum bo'lgach (SessionContext orqali) chaqiriladi —
    // o'sha SOTUVCHIGA tegishli savatni localStorage'dan yuklaydi.
    hydrateCart: (state, action) => {
      const sellerId = action.payload;
      state.scopedSellerId = sellerId;
      const { items, activeBundle } = readCartFor(sellerId);
      state.items = items;
      state.activeBundle = activeBundle;
    },
    toggleCartActions: (state, action) => {
      const product = action.payload;
      // TUZATILDI: Mahsulot savatda allaqachon bormi, tekshiramiz (Takrorlanishni oldini oladi)
      const existingItem = state.items.find(item => item.id === product.id);

      // OLDIN: savat har doim `product.price`ni (to'liq narx) saqlardi,
      // hatto mahsulotda haqiqiy chegirma (`discountPrice`) bo'lsa ham —
      // natijada xaridor mahsulot sahifasida chegirmali narxni ko'rib,
      // lekin savat/checkout'da TO'LIQ narxni to'lashga majbur bo'lardi.
      // Endi savatga qo'shishda HAQIQIY (chegirma bo'lsa — chegirmali)
      // narx saqlanadi.
      const hasDiscount = product.discountPrice &&
        Number(product.discountPrice) > 0 &&
        Number(product.discountPrice) < Number(product.price);
      const effectivePrice = hasDiscount ? Number(product.discountPrice) : Number(product.price) || 0;

      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        state.items.push({...product, price: effectivePrice, quantity: 1});
      }
      persistCart(state);
    },
    removeCart: (state, action) => {
      const product = action.payload;
      state.items = state.items.filter(item => item.id !== product.id);
      persistCart(state);
    },
    quantityDec: (state, action) => {
      const productId = action.payload;
      const item = state.items.find(item => item.id === productId);
      if (item) {
        if (item.quantity > 1) {
          item.quantity -= 1;
        } else {
          // TUZATILDI: Soni 1 dan kamaysa, savatdan avtomat o'chadi
          state.items = state.items.filter(i => i.id !== productId);
        }
      }
      persistCart(state);
    },
    quantityInc: (state, action) => {
      const productId = action.payload;
      const item = state.items.find(item => item.id === productId);
      // TUZATILDI: if (item.quantity) xatosi olib tashlandi, oddiygina item bormiligi tekshiriladi
      if (item) {
        item.quantity += 1;
      }
      persistCart(state);
    },
    clearCart: (state) => {
      state.items = [];
      state.activeBundle = null;
      if (state.scopedSellerId) {
        localStorage.removeItem(buildKey(state.scopedSellerId));
      }
    },
    // "COMBO SIFATIDA QO'SHISH" - mahsulot sahifasidagi combo
    // taklifini bosganda, combo'ga kiruvchi BARCHA mahsulotlar bir
    // yo'la savatga qo'shiladi (mavjud bo'lsa - soni oshiriladi), va
    // qaysi combo FAOL ekani state'da belgilanadi - checkout sahifasi
    // shu orqali chegirmani OLDINDAN ko'rsatadi. HAQIQIY chegirma
    // baribir serverda (`functions/orders.js`) qayta hisoblanadi va
    // tekshiriladi - shuning uchun bu yerdagi narx hech qachon
    // xaridorga NOTO'G'RI summa to'latmaydi.
    addBundleToCart: (state, action) => {
      const { bundleId, name, bundlePrice, products } = action.payload;
      const list = Array.isArray(products) ? products : [];

      list.forEach((product) => {
        const existingItem = state.items.find((item) => item.id === product.id);
        const hasDiscount = product.discountPrice &&
          Number(product.discountPrice) > 0 &&
          Number(product.discountPrice) < Number(product.price);
        const effectivePrice = hasDiscount ? Number(product.discountPrice) : Number(product.price) || 0;

        if (existingItem) {
          existingItem.quantity += 1;
        } else {
          state.items.push({ ...product, price: effectivePrice, quantity: 1 });
        }
      });

      state.activeBundle = {
        bundleId,
        name: name || null,
        bundlePrice: Number(bundlePrice) || 0,
        productIds: list.map((p) => p.id),
      };
      persistCart(state);
    },
    // "BIR TUGMA BILAN QAYTA BUYURTMA" - oldingi buyurtma tarkibini
    // savatga TO'LIQ almashtirib qo'yadi (mavjud savat bilan
    // qo'shilmaydi - "aynan shu buyurtmani takrorlash" degan aniq,
    // bashorat qilinadigan xatti-harakat uchun).
    //
    // XAVFSIZLIK ESLATMASI: bu yerda saqlangan narx faqat EKRANDA
    // ko'rsatish uchun - haqiqiy to'lov summasi baribir
    // `createOrder`ning server tranzaksiyasida QAYTA hisoblanadi
    // (mavjud, tekshirilgan arxitektura) - shuning uchun narx
    // o'zgargan bo'lsa ham, xaridor NOTO'G'RI summa to'lamaydi.
    reorderFromPastOrder: (state, action) => {
      const items = Array.isArray(action.payload) ? action.payload : [];
      state.items = items.map((item) => ({
        id: item.id,
        name: item.name,
        image: item.image || null,
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1,
      }));
      persistCart(state);
    }
  }
});

export const { hydrateCart, toggleCartActions, removeCart, quantityDec, quantityInc, clearCart, reorderFromPastOrder, addBundleToCart } = cartSlice.actions;
export default cartSlice.reducer;
