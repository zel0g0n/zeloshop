import { useDispatch, useSelector } from "react-redux";
import { useEffect, useRef } from "react";
import { getClientDataAsyncThunk } from "@/store/slices/profile/getClientDataSlice";
import { useSession } from "@/context/SessionContext";

const useGetClientData = () => {
  const dispatch = useDispatch();
  const { clientId } = useSession();
  const { clientInfo, loading, error } = useSelector((state) => state.profile);

  // clientInfo topilmasa (masalan hujjat hali yaratilmagan bo'lsa) u
  // doimiy `null` bo'lib qoladi — shu sabab faqat clientInfo'ga qarab
  // "hali so'rov yuborilmadi" deb bo'lmaydi, aks holda har safar
  // `loading` false'ga qaytganda qayta-qayta dispatch qilinib, cheksiz
  // tsiklga aylanib qolardi. Shu uchun alohida "so'rov yuborildimi"
  // belgisi ishlatiladi.
  //
  // OLDIN: bu belgi faqat `useRef` bilan saqlanardi — lekin Kabinet
  // sahifasidan chiqib qayta kirganda (marshrut o'zgarganda) komponent
  // QAYTA MONTAJ qilinadi va `useRef` YANGI, boshlang'ich (false)
  // qiymat bilan boshlanadi — garchi `clientInfo` Redux'da (global,
  // marshrutlar orasida saqlanadigan) allaqachon mavjud bo'lsa ham!
  // Natijada har safar Kabinet ochilganda keraksiz qayta so'rov va
  // skeleton ko'rsatilardi. Endi avval `clientInfo`ning o'zi
  // tekshiriladi (bu — Redux'da haqiqatan saqlanib qoladigan manba).
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    hasFetchedRef.current = false;
  }, [clientId]);

  useEffect(() => {
    if (!clientId || loading) return;
    if (clientInfo) return; // Redux'da allaqachon bor — qayta so'ramaymiz
    if (hasFetchedRef.current) return; // shu montajda bir marta urinib ko'rdik
    hasFetchedRef.current = true;
    dispatch(getClientDataAsyncThunk(clientId));
  }, [dispatch, clientId, loading, clientInfo]);

  return { clientInfo, loading, error };
};

export default useGetClientData;
