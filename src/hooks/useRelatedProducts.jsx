import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getProductAsyncThunk } from "@/store/slices/product/getProductSlice";
import { useSession } from "@/context/SessionContext";

// OLDIN: bu hook har bir mahsulot sahifasi ochilganda getProducts() orqali
// "products" kolleksiyasini TO'LIQ (barcha sotuvchilarning) qayta o'qirdi.
// ENDI: allaqachon Redux'da (state.products.products) mavjud bo'lgan,
// JORIY sotuvchiga tegishli keshlangan ro'yxatdan foydalanamiz — bu
// kesh Home/Catalog sahifasi bilan bir xil, sotuvchi bo'yicha to'g'ri
// filtrlangan manba.
export const useRelatedProducts = (product) => {
  const dispatch = useDispatch();
  const { sellerId } = useSession();
  const { products, loading, loadedForSellerId } = useSelector((state) => state.products);

  useEffect(() => {
    if (sellerId && loadedForSellerId !== sellerId && !loading) {
      dispatch(getProductAsyncThunk(sellerId));
    }
  }, [dispatch, sellerId, loadedForSellerId, loading]);

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
