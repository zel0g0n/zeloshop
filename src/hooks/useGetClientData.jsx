import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import { getClientDataAsyncThunk } from "@/store/slices/profile/getClientDataSlice";
import { useSession } from "@/context/SessionContext";

const useGetClientData = () => {
  const dispatch = useDispatch();
  const { clientId } = useSession();
  const { clientInfo, loading, error } = useSelector((state) => state.profile);

  useEffect(() => {
    // clientInfo allaqachon (shu sessiya davomida) yuklangan bo'lsa yoki
    // hozir yuklanayotgan bo'lsa — Firestore'ga qayta so'rov yubormaymiz.
    if (!clientId || clientInfo || loading) return;
    dispatch(getClientDataAsyncThunk(clientId));
  }, [dispatch, clientId, clientInfo, loading]);

  return { clientInfo, loading, error };
};

export default useGetClientData;
