import { db } from "@/firebase/config";
import { doc, updateDoc } from "firebase/firestore";

/**
 * Sotuvchi holatini o'zgartiradi (masalan "active" <-> "suspended").
 * Faqat admin chaqira oladi — firestore.rules'da `isAdmin()` orqali
 * ta'minlangan (sotuvchining o'zi ham o'z holatini shu funksiya bilan
 * o'zgartira olardi, lekin admin panel buni faqat admin ekranidan
 * chaqiradi).
 */
const updateSellerStatus = async (sellerId, newStatus) => {
  if (!sellerId) throw new Error("Sotuvchi ID topilmadi.");
  try {
    await updateDoc(doc(db, "sellers", sellerId), {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    throw new Error(error.message || "Sotuvchi holatini o'zgartirishda xatolik", { cause: error });
  }
};

export default updateSellerStatus;
