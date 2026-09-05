import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState, useCallback } from "react";
import getSellerProducts from "@/services/products/getSellerProducts";

import {
  setProductsLoading,
  setProductsSuccess,
  setProductsError
} from "@/store/slices/seller/getSellerProductsSlice";

const PAGE_SIZE = 100;

const useGetProductsData = (ID) => {

  const {
    loading,
    error,
    success,
    products,
    productsCounter
  } = useSelector(state => state.sellerProductsList);

  const dispatch = useDispatch();
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  useEffect(() => {

    if (!ID) return;

    dispatch(setProductsLoading());

    const unsubscribe = getSellerProducts(

      ID,

      (products) => {

        dispatch(setProductsSuccess(products));

      },

      (error) => {

        dispatch(
          setProductsError(error.message)
        );

      },

      pageSize

    );

    return () => {

      unsubscribe();

    };

  }, [dispatch, ID, pageSize]);

  // Ro'yxat aynan `pageSize`ga teng bo'lsa — ehtimol yana ko'proq
  // mahsulot bor (aniq bilishning yagona arzon yo'li: agar to'liq
  // sahifa qaytgan bo'lsa, chegaraga yetgan bo'lishi mumkin).
  const hasMore = products.length >= pageSize;
  const loadMore = useCallback(() => {
    setPageSize((prev) => prev + PAGE_SIZE);
  }, []);

  return {

    products,
    loading,
    error,
    success,
    productsCounter,
    hasMore,
    loadMore

  };

};

export default useGetProductsData;