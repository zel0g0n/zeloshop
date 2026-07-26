import { useDispatch, useSelector } from "react-redux";
import {useEffect} from "react";
import { getClientDataAsyncThunk } from "@/store/slices/profile/getClientDataSlice";
const useGetClientData = () => {
  const dispatch = useDispatch();
  const { clientInfo, loading, error } = useSelector((state) => state.profile);
  useEffect(() => {
    const fetchClientData = async () => {
      try {
        const userId = "0czQALhZ3D152vYawfgC"; 
        await dispatch(getClientDataAsyncThunk(userId));
      } catch (error) {
        console.error("Error fetching client data:", error);
      }
    };
    if (!clientInfo && !loading) {
      fetchClientData();
    }
  }, [dispatch]);
  return { clientInfo, loading, error };
};

export default useGetClientData;