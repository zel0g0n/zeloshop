import { db } from "@/firebase/config";
import { doc, updateDoc } from "firebase/firestore";

/**
 * AI CEO — PREMIUM funksiyaga kirishni yoqadi/o'chiradi. Faqat admin
 * chaqiradi (firestore.rules'dagi `isAdmin()` orqali ta'minlangan,
 * xuddi `updateSellerStatus.js` bilan bir xil naqsh).
 *
 * MUHIM: bu — to'lov TASHQARIDA (masalan bank o'tkazmasi orqali)
 * kelishilgandan KEYIN, admin tomonidan QO'LDA bosiladigan tugma -
 * platformada hali markazlashtirilgan to'lov tizimi yo'q.
 */
const setSellerAiCeoAccess = async (sellerId, enabled) => {
  if (!sellerId) throw new Error("Sotuvchi ID topilmadi.");
  try {
    await updateDoc(doc(db, "sellers", sellerId), {
      aiCeoEnabled: enabled,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    throw new Error(error.message || "AI CEO kirishini o'zgartirishda xatolik", { cause: error });
  }
};

export default setSellerAiCeoAccess;
