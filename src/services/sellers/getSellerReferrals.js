import { db } from "@/firebase/config";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

/**
 * Sotuvchining "taklif qilgan boshqa sotuvchilar" ro'yxatini bir
 * martalik o'qiydi (`functions/sellerReferrals.js`dagi
 * `sellerReferrals` subkolleksiyasi). Jonli (`onSnapshot`) tinglovchi
 * ATAYLAB ishlatilmaydi — bu sahifa faqat sotuvchi o'zi kirganda
 * ko'riladi, real-vaqtli yangilanish shart emas.
 */
const getSellerReferrals = async (sellerId) => {
  if (!sellerId) return [];
  const q = query(collection(db, "sellers", sellerId, "sellerReferrals"), orderBy("signedUpAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export default getSellerReferrals;
