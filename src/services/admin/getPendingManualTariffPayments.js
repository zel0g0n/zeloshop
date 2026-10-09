import { db } from "@/firebase/config";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";

// Admin paneli SOLO/shaxsiy foydalanish uchun (`getTariffRequests.js`dagi
// bilan bir xil qaror) — kutilayotgan qo'lda to'lovlar soni amalda
// hech qachon ko'p bo'lmaydi, shuning uchun sahifalab o'qish shart
// emas, oddiy chegara (limit) yetarli.
const MANUAL_PAYMENTS_LIMIT = 100;

/**
 * Admin panelidagi "To'lov tekshiruvi" bo'limi uchun — hozircha
 * ko'rib chiqilmagan (`method: "manual"`, `status: "pending_review"`)
 * qo'lda to'lovlarni, eng yangisidan boshlab qaytaradi. Batafsil izoh:
 * `functions/manualTariffPayments.js`.
 */
export const getPendingManualTariffPayments = async () => {
  try {
    const q = query(
      collection(db, "atmosPayments"),
      where("method", "==", "manual"),
      where("status", "==", "pending_review"),
      orderBy("createdAt", "desc"),
      limit(MANUAL_PAYMENTS_LIMIT)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    throw new Error(error.message || "To'lovlarni yuklashda xatolik", { cause: error });
  }
};

export default getPendingManualTariffPayments;
