import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { subscribeSharedProducts } from "@/services/products/liveProductsRegistry";
import { productsLoading, productsLiveUpdated, productsLoadError } from "@/store/slices/product/getProductSlice";

/**
 * Mijoz tomonidagi (do'kon) mahsulot ro'yxatini JONLI (real-vaqtli)
 * ushlab turadi, va Redux keshiga (`state.products`) yozadi — bir
 * necha komponent (Bosh sahifa, Katalog, Bog'liq mahsulotlar,
 * Checkout cross-sell) shu bitta keshdan o'qiydi.
 *
 * XAVFSIZLIK/SAMARADORLIK AUDITI (2026-09, caching audit): OLDIN bu
 * hook HAR BIR mount uchun O'Z ALOHIDA `onSnapshot` tinglovchisini
 * o'rnatardi ("allaqachon yuklangan" tekshiruvi ATAYLAB
 * ishlatilmasdi — chunki bitta komponent unmount bo'lganda uning
 * obunasi bekor bo'lib, boshqa komponent "allaqachon yuklangan" deb
 * o'z obunasini o'rnatmasa, ma'lumot ABADIY eskirib qolishi mumkin
 * edi). Amalda buning oqibati — bir xil sotuvchining mahsulot
 * ro'yxatiga 4 tagacha (Bosh sahifa, Katalog, Bog'liq mahsulotlar,
 * Checkout cross-sell) PARALEL Firestore tinglovchisi ochilishi edi.
 *
 * ENDI: `subscribeSharedProducts` (REF-COUNTED umumiy registry)
 * ishlatiladi — sotuvchi bo'yicha FAQAT BITTA haqiqiy Firestore
 * tinglovchisi bo'ladi, nechta komponent obuna bo'lishidan qat'i
 * nazar. Eski xavf QAYTA TUG'ILMAYDI: obuna faqat va faqat HECH KIM
 * tinglamay qolganda (ref-count nolga tushganda) to'xtaydi — kamida
 * bitta iste'molchi bor ekan, ma'lumot doim jonli yangilanib turadi.
 */
export function useLiveShopProducts(sellerId) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (!sellerId) return;

    dispatch(productsLoading());
    const unsubscribe = subscribeSharedProducts(
      sellerId,
      (products) => dispatch(productsLiveUpdated({ products, sellerId })),
      (error) => dispatch(productsLoadError(error.message || "Mahsulotlarni yuklashda xatolik yuz berdi"))
    );

    return () => unsubscribe();
  }, [dispatch, sellerId]);
}
