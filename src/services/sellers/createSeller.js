import { db } from "@/firebase/config";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

/**
 * Yangi sotuvchi (do'kon) hujjatini yaratadi.
 * Mavjud `sellers` kolleksiyasi tuzilishiga mos (storeName, phone, logo,
 * status, tgID, createdAt) + yangi `category` maydoni.
 *
 * @param {string} uid - sotuvchining Telegram ID'si (Firestore hujjat ID'si sifatida ham ishlatiladi)
 * @param {{storeName: string, phone: string, category: string, logo: string}} storeData
 */
const createSeller = async (uid, storeData) => {
  if (!uid) throw new Error("Sotuvchi ID topilmadi.");

  const { storeName, phone, category, logo, region, description } = storeData;
  if (!storeName?.trim() || !phone?.trim() || !category || !region) {
    throw new Error("Do'kon nomi, telefon, soha va joylashuv to'ldirilishi shart.");
  }

  try {
    const sellerRef = doc(db, "sellers", uid);
    await setDoc(sellerRef, {
      tgID: uid,
      storeName: storeName.trim(),
      phone: phone.trim(),
      category,
      region,
      description: description?.trim() || null,
      logo: logo || null,
      status: "active",
      createdAt: serverTimestamp(),
    });
    return { id: uid };
  } catch (error) {
    throw new Error(error.message || "Do'kon yaratishda xatolik yuz berdi", { cause: error });
  }
};

export default createSeller;
