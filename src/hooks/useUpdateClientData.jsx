import { useDispatch, useSelector } from "react-redux";
import { updateClientDataAsyncThunk, resetProfileStatus } from "@/store/slices/profile/updateProfileSlice";
import { useCallback } from "react";

const useUpdateClientData = () => {
  const dispatch = useDispatch();
  
  const loading = useSelector((state) => state.profileEdit?.loading);
  const error = useSelector((state) => state.profileEdit?.error);
  const success = useSelector((state) => state.profileEdit?.success);
  const clientInfo = useSelector((state) => state.profileEdit?.clientInfo);
  const updateClient = useCallback(async (userID, fieldsToUpdate) => {
    try {
      await dispatch(updateClientDataAsyncThunk({ userID, updatedFields: fieldsToUpdate })).unwrap();
    } catch (err) {
      console.error("Hook error updating client data:", err);
      throw err;
    }
  }, [dispatch]);

  const clearStatus = useCallback(() => {
    dispatch(resetProfileStatus());
  }, [dispatch]);

  return { loading, error, success, clientInfo, updateClient, clearStatus };
};

export default useUpdateClientData;