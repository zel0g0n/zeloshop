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

    dispatch(setOrdersLoading());

    const unsubscribe = getOrderData(

      ID,

      (orders) => {

        dispatch(setOrdersSuccess(orders));

      },

      (error) => {

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