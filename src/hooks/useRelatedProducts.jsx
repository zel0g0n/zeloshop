import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getProductAsyncThunk } from "@/store/slices/product/getProductSlice";

// OLDIN: bu hook har bir mahsulot sahifasi ochilganda getProducts() orqali
// "products" kolleksiyasini TO'LIQ qayta o'qirdi (getDocs), garchi bu
// ma'lumot Home sahifasida allaqachon Redux'da keshlangan bo'lsa ham.
// Bitta mahsulotni ko'rish oqibatida butun katalogni qayta yuklash —
// Firebase o'qishlarini keraksiz ko'paytirar edi.
//
// ENDI: allaqachon Redux'da (state.products.products) mavjud bo'lgan
// keshlangan ro'yxatdan foydalanamiz; agar u hali bo'sh bo'lsa (masalan
// foydalanuvchi to'g'ridan-to'g'ri mahsulot havolasi orqali kirgan bo'lsa),
// faqat o'shanda BIR MARTA yuklaymiz — Home sahifasi ham aynan shu keshni
// ishlatgani uchun qo'shimcha o'qish deyarli hech qachon sodir bo'lmaydi.
export const useRelatedProducts = (product) => {
  const dispatch = useDispatch();
  const { products, loading } = useSelector((state) => state.products);

  useEffect(() => {
    if (products.length === 0 && !loading) {
      dispatch(getProductAsyncThunk());
    }
  }, [dispatch, products.length, loading]);

  const relatedProducts = useMemo(() => {
    try {
      if (!product || !product.tags || !Array.isArray(product.tags)) return [];

      return products
        .filter((item) => String(item.id) !== String(product.id))
        .filter((item) => Array.isArray(item.tags) && item.tags.some((tag) => product.tags.includes(tag)));
    } catch (error) {
      console.error("Xatolik yuz berdi:", error);
      return [];
    }
  }, [product, products]);

  return relatedProducts;
};
