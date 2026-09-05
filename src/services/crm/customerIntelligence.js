import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * MIJOZLAR RAZVEDKASI (Advanced Customer Intelligence, Z-Biznes,
 * 2026-09 punkt-royxati, 9-band) — CRM Hub sahifasidagi "Biznes
 * razvedkasi" bo'limi uchun. Backend (`functions/customerIntelligence.js`)
 * mijozlarni 7 ta segmentga (vip/high_value/sleeping/churn_risk/
 * at_risk/new/returning) va 2 ta belgiga (discount_hunter,
 * high_intent) ajratadi.
 *
 * NEGA to'g'ridan-to'g'ri `sellers/{id}/customers`ni o'qish YETARLI
 * EMAS (Z-Pro CRM'ning `useCrmOrders`sidan farqli): "high_intent"
 * belgisi mijozning FAOL savatchasi/sevimlilar ro'yxatiga bog'liq -
 * bu ikkala kolleksiya (`carts`/`favorites`) `firestore.rules`da
 * sotuvchiga HAM yopiq (maxfiylik uchun), shuning uchun tasnif FAQAT
 * server tomonida (Admin SDK) hisoblanishi mumkin.
 */
export const getCustomerIntelligence = async () => {
  const callable = httpsCallable(functions, "getCustomerIntelligence");
  const { data } = await callable();
  return data;
};
