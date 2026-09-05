import { useState, useEffect } from "react";
import { getRecentOrderData } from "@/services/orders/getOrderData";

/**
 * Dashboard uchun — faqat so'nggi N kunlik buyurtmalarni yuklaydi
 * (standart: 30 kun — "Oy" tabiga aniq mos keladi).
 * Buyurtmalar boshqaruv sahifasidagi (`useFilterOrders`) umumiy Redux
 * holatidan ATAYLAB MUSTAQIL — shu sababli bu yerdagi cheklov o'sha
 * sahifaga hech qanday ta'sir qilmaydi.
 */
const useRecentOrders = (sellerId, daysBack = 30) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sellerId) return;

    setLoading(true);
    const unsubscribe = getRecentOrderData(
      sellerId,
      daysBack,
      (data) => {
        setOrders(data);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [sellerId, daysBack]);

  return { orders, loading };
};

export default useRecentOrders;
