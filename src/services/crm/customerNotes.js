import { db } from "@/firebase/config";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

/**
 * Sotuvchining mijoz haqidagi shaxsiy izohi (Notes). Bu — moliyaviy
 * yoki maxfiy ma'lumot emas (masalan "chegirma so'ragan edi, ehtiyot
 * bo'lish kerak" kabi eslatmalar), shuning uchun to'g'ridan-to'g'ri
 * Firestore orqali (Cloud Function'siz) saqlanadi — faqat sotuvchining
 * O'ZI (`isOwner`) o'qiy/yoza oladi (`firestore.rules`).
 */
const noteRef = (sellerId, clientId) => doc(db, "sellers", sellerId, "customerNotes", clientId);

export const getCustomerNote = async (sellerId, clientId) => {
  const snap = await getDoc(noteRef(sellerId, clientId));
  return snap.exists() ? snap.data().note || "" : "";
};

export const saveCustomerNote = async (sellerId, clientId, note) => {
  await setDoc(noteRef(sellerId, clientId), { note, updatedAt: serverTimestamp() });
};
