import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { createSellerAsyncThunk, resetCreateSellerStatus } from "@/store/slices/seller/createSellerSlice";

const useCreateSeller = () => {
  const dispatch = useDispatch();
  const { loading, error, success } = useSelector((state) => state.createSeller);

  const createStore = useCallback(
    async (uid, storeData) => {
      return dispatch(createSellerAsyncThunk({ uid, storeData })).unwrap();
    },
    [dispatch]
  );

  const resetStatus = useCallback(() => dispatch(resetCreateSellerStatus()), [dispatch]);

  return { createStore, loading, error, success, resetStatus };
};

export default useCreateSeller;
