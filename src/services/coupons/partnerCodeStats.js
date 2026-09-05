import { db } from "@/firebase/config";
import { collection, query, orderBy } from "firebase/firestore";

/**
 * Hamkor/blogger kodlari uchun SOTUV STATISTIKASI (#117) -
 * "sellers/{sellerId}/partnerCodeStats/{code}" quyi kolleksiyasi,
 * `functions/orders.js` tomonidan har bir buyurtmada AVTOMATIK
 * yangilanadi (buyurtmalar soni + umumiy sof savdo summasi). Bu
 * fayl faqat O'QISH uchun - yozish har doim taqiqlangan
 * (`firestore.rules`), faqat Cloud Function yozadi.
 */
export const partnerCodeStatsQuery = (sellerId) =>
  query(collection(db, "sellers", sellerId, "partnerCodeStats"), orderBy("totalRevenue", "desc"));
