import { db } from "@/firebase/config";
import { doc, getDoc } from "firebase/firestore";

/**
 * Berilgan uid uchun sotuvchi (do'kon) hujjati mavjudmi tekshiradi.
 * SessionContext shu orqali "bu odam sotuvchimi, hali ro'yxatdan
 * o'tmaganmi" ekanini aniqlaydi.
 */
const getSeller = async (uid) => {
  if (!uid) return null;
  try {
    const sellerSnap = await getDoc(doc(db, "sellers", uid));
    if (!sellerSnap.exists()) return null;
    return { id: sellerSnap.id, ...sellerSnap.data() };
  } catch (error) {
    throw new Error(error.message || "Sotuvchi ma'lumotini olishda xatolik", { cause: error });
  }
};

export default getSeller;
