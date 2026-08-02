import { db } from "@/firebase/config";
import { collection, getCountFromServer } from "firebase/firestore";

/**
 * Platforma bo'yicha umumiy statistika — Firestore'ning aggregatsiya
 * so'rovi (`getCountFromServer`) orqali, BARCHA hujjatlarni yuklab
 * olmasdan, faqat sonini hisoblaydi (tez va arzon).
 */
const getPlatformStats = async () => {
  try {
    const [sellersSnap, productsSnap, ordersSnap] = await Promise.all([
      getCountFromServer(collection(db, "sellers")),
      getCountFromServer(collection(db, "products")),
      getCountFromServer(collection(db, "orders")),
    ]);

    return {
      totalSellers: sellersSnap.data().count,
      totalProducts: productsSnap.data().count,
      totalOrders: ordersSnap.data().count,
    };
  } catch (error) {
    throw new Error(error.message || "Statistikani yuklashda xatolik", { cause: error });
  }
};

export default getPlatformStats;
