import { db } from "@/firebase/config";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";

// Admin paneli SOLO/shaxsiy foydalanish uchun (loyihaning boshqa
// joylaridagi kabi) — kutilayotgan tarif so'rovlari sonи amalda hech
// qachon ko'p bo'lmaydi, shuning uchun sahifalab o'qish (pagination)
// shart emas, oddiy chegara (limit) yetarli.
const TARIFF_REQUESTS_LIMIT = 100;

/**
 * Admin panelidagi "Tarif so'rovlari" bo'limi uchun — hozircha
 * KO'RIB CHIQILMAGAN (`status === "pending"`) so'rovlarni, eng
 * yangisidan boshlab qaytaradi. Hal qilingan (`approved`/`dismissed`)
 * so'rovlar bu ro'yxatda ATAYLAB ko'rsatilmaydi — admin faqat
 * HARAKAT talab qiladigan narsalarni ko'rishi kerak.
 */
export const getPendingTariffRequests = async () => {
  try {
    const q = query(
      collection(db, "tariffRequests"),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc"),
      limit(TARIFF_REQUESTS_LIMIT)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    throw new Error(error.message || "Tarif so'rovlarini yuklashda xatolik", { cause: error });
  }
};
