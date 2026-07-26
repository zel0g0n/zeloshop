import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";

import getClientOrderData from "@/services/orders/getClientOrder";
import {
  setOrdersLoading,
  setOrdersSuccess,
  setOrdersError
} from "@/store/slices/seller/getClientOrderSlice";

const useGetClientOrdersData = (ID) => {

  const {
    loading,
    error,
    success,
    orders,
    ordersCounter
  } = useSelector(state => state.clientOrdersList);

  const dispatch = useDispatch();

  useEffect(() => {

    if (!ID) return;

    dispatch(setOrdersLoading());

    const unsubscribe = getClientOrderData(

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

export default useGetClientOrdersData;