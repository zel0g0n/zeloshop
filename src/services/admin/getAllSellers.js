import { db } from "@/firebase/config";
import { collection, query, orderBy } from "firebase/firestore";
import { subscribeWithFastInitial } from "@/services/shared/subscribeWithFastInitial";

const mapSellerDoc = (doc) => ({ id: doc.id, ...doc.data() });

/**
 * Barcha sotuvchilarni real-time kuzatadi (faqat admin o'qiy oladi —
 * firestore.rules'da `isAdmin()` orqali ta'minlangan). Endi tez
 * (bir martalik) o'qish + fon rejimida jonli ulanish strategiyasini
 * ishlatadi.
 */
export const subscribeAllSellers = (onSuccess, onError) => {
  const q = query(collection(db, "sellers"), orderBy("createdAt", "desc"));

  return subscribeWithFastInitial(
    q,
    mapSellerDoc,
    onSuccess,
    (error) => onError(new Error(error.message || "Sotuvchilar ro'yxatini yuklashda xatolik"))
  );
};
