import { useSelector, useDispatch } from "react-redux";
import { updateOrderStatusAsyncThunk } from "@/store/slices/seller/changeOrderSlice";
import { useCallback } from "react";
const useChangeOrderStatus = () => {
  const dispatch = useDispatch()
  const {status}  = useSelector(state => state.changeOrderStatus)
  const changeOrderStatus = useCallback(async (id, status, extraFields) => {
    await dispatch(updateOrderStatusAsyncThunk({id, status, extraFields})).unwrap()
  }, [dispatch])

  return {changeOrderStatus, status}
}

export default useChangeOrderStatus