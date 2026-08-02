import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";

import getOrderData from "@/services/orders/getOrderData";

import {
  setOrdersLoading,
  setOrdersSuccess,
  setOrdersError
} from "@/store/slices/seller/getOrdersSlice";

const useGetOrdersData = (ID) => {

  const {
    loading,
    error,
    success,
    orders,
    ordersCounter
  } = useSelector(state => state.sellerOrdersList);

  const dispatch = useDispatch();

  useEffect(() => {

    if (!ID) return;

    if (window.__appLoadStart !== undefined) {
      console.log(
        "5️⃣a Sahifa boshidan Buyurtmalar effekti BOSHLANGUNICHA:",
        (performance.now() - window.__appLoadStart).toFixed(2),
        "ms"
      );
    }

    dispatch(setOrdersLoading());
    console.time("5️⃣ Buyurtmalar — birinchi Firestore javobi");
    let timedOnce = false;

    const unsubscribe = getOrderData(

      ID,

      (orders) => {

        if (!timedOnce) {
          timedOnce = true;
          console.timeEnd("5️⃣ Buyurtmalar — birinchi Firestore javobi");
        }
        dispatch(setOrdersSuccess(orders));

      },

      (error) => {

        if (!timedOnce) {
          timedOnce = true;
          console.timeEnd("5️⃣ Buyurtmalar — birinchi Firestore javobi");
        }
        dispatch(
          setOrdersError(error.message)
        );

      }

    );

    return () => {

      unsubscribe();

    };

  }, [dispatch, ID]);

  return {

    orders,
    loading,
    error,
    success,
    ordersCounter

  };

};

export default useGetOrdersData;