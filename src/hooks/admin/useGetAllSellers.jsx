import { useEffect, useState } from "react";
import { subscribeAllSellers } from "@/services/admin/getAllSellers";

// Bu yerda ataylab Redux ishlatilmadi (ilovaning qolgan qismidan farqli
// o'laroq) — bu ma'lumot faqat bitta komponentda (AdminSellersPage)
// ishlatiladi, boshqa hech qayerga uzatilmaydi, shuning uchun lokal
// state yetarli va soddaroq.
const useGetAllSellers = () => {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeAllSellers(
      (data) => {
        setSellers(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return { sellers, loading, error };
};

export default useGetAllSellers;
