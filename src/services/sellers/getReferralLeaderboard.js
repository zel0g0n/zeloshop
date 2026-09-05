import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * Mijozlarning "do'st taklif qilish" reytingi (`functions/clientReferrals.js`).
 * ATAYLAB avtomatik chaqirilmaydi - faqat `ReferralPage.jsx`da
 * xaridor aniq tugma bosganda (Firebase o'qish xarajatini nazorat
 * qilish uchun, sahifaning boshidagi izohga qarang).
 */
const getReferralLeaderboard = async (sellerId) => {
  if (!sellerId) throw new Error("Sotuvchi ID topilmadi.");
  const callable = httpsCallable(functions, "getReferralLeaderboard");
  const { data } = await callable({ sellerId });
  return data; // { leaderboard: [{rank, count, isYou}], myRank, myCount }
};

export default getReferralLeaderboard;
