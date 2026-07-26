import { useSelector, useDispatch } from "react-redux";
import { updateOrderStatusAsyncThunk } from "@/store/slices/seller/changeOrderSlice";
import { useCallback } from "react";
const useChangeOrderStatus = () => {
  const dispatch = useDispatch()
  const {status}  = useSelector(state => state.changeOrderStatus)
  const changeOrderStatus = useCallback(async (id, status) => {
    await dispatch(updateOrderStatusAsyncThunk({id, status})).unwrap()
  }, [dispatch])

  return {changeOrderStatus, status}
}

export default useChangeOrderStatus