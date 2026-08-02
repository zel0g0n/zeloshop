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

    if (window.__appLoadStart !== undefined) {
      console.log(
        "6️⃣a Sahifa boshidan Mahsulotlar effekti BOSHLANGUNICHA:",
        (performance.now() - window.__appLoadStart).toFixed(2),
        "ms"
      );
    }

    dispatch(setProductsLoading());
    console.time("6️⃣ Mahsulotlar — birinchi Firestore javobi");
    let timedOnce = false;

    const unsubscribe = getSellerProducts(

      ID,

      (products) => {

        if (!timedOnce) {
          timedOnce = true;
          console.timeEnd("6️⃣ Mahsulotlar — birinchi Firestore javobi");
        }
        dispatch(setProductsSuccess(products));

      },

      (error) => {

        if (!timedOnce) {
          timedOnce = true;
          console.timeEnd("6️⃣ Mahsulotlar — birinchi Firestore javobi");
        }
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