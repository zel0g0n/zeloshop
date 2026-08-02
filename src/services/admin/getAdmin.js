import { db } from "@/firebase/config";
import { doc, getDoc } from "firebase/firestore";

/**
 * Berilgan uid `admins` kolleksiyasida bormi tekshiradi.
 * Yangi admin qo'shish FAQAT Firebase Console orqali qo'lda qilinadi —
 * frontend'dan bu kolleksiyaga yozib bo'lmaydi (firestore.rules'ga qarang).
 */
const getAdmin = async (uid) => {
  if (!uid) return false;
  try {
    const snap = await getDoc(doc(db, "admins", uid));
    return snap.exists();
  } catch (error) {
    // Ruxsat yo'qligi ham "admin emas" degani — xato tashlamaymiz,
    // shunchaki false qaytaramiz (oddiy foydalanuvchilar uchun bu doim
    // shunday bo'ladi, chunki ular admins/{ularning-uid} o'qiy olmaydi).
    console.warn("Admin tekshiruvida xatolik (ehtimol oddiy foydalanuvchi):", error.message);
    return false;
  }
};

export default getAdmin;
