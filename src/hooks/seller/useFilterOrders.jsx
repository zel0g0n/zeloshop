import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState, useCallback } from "react";

import getOrderData from "@/services/orders/getOrderData";

import {
  setOrdersLoading,
  setOrdersSuccess,
  setOrdersError
} from "@/store/slices/seller/getOrdersSlice";

const PAGE_SIZE = 150;

const useGetOrdersData = (ID) => {

  const {
    loading,
    error,
    success,
    orders,
    ordersCounter
  } = useSelector(state => state.sellerOrdersList);

  const dispatch = useDispatch();
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

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

      },

      pageSize

    );

    return () => {

      unsubscribe();

    };

  }, [dispatch, ID, pageSize]);

  const hasMore = orders.length >= pageSize;
  const loadMore = useCallback(() => {
    setPageSize((prev) => prev + PAGE_SIZE);
  }, []);

  return {

    orders,
    loading,
    error,
    success,
    ordersCounter,
    hasMore,
    loadMore

  };

};

export default useGetOrdersData;