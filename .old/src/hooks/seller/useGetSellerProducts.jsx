import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import getSellerProducts from "@/services/products/getSellerProducts";

import {
  setProductsLoading,
  setProductsSuccess,
  setProductsError
} from "@/store/slices/seller/getSellerProductsSlice";

const useGetProductsData = (ID) => {

  const {
    loading,
    error,
    success,
    products,
    productsCounter
  } = useSelector(state => state.sellerProductsList);

  const dispatch = useDispatch();

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

      }

    );

    return () => {

      unsubscribe();

    };

  }, [dispatch, ID]);

  return {

    products,
    loading,
    error,
    success,
    productsCounter

  };

};

export default useGetProductsData;