import { db } from "@/firebase/config";
import { doc, updateDoc } from "firebase/firestore";

const VALID_PLANS = ["start", "pro", "biznes"];

/**
 * Admin tomonidan sotuvchining DOIMIY tarifini (Z-Start/Z-Pro/Z-Biznes)
 * to'g'ridan-to'g'ri o'rnatadi. `firestore.rules`dagi `isAdmin()`
 * bypass orqali himoyalangan (`sellers/{sellerId}` update qoidasi —
 * `updateSellerStatus.js` bilan bir xil naqsh).
 *
 * MUHIM: bu — to'lov TASHQARIDA (masalan bank o'tkazmasi orqali)
 * kelishilgandan KEYIN, admin tomonidan QO'LDA bosiladigan tugma -
 * platformada hali markazlashtirilgan to'lov tizimi yo'q. Odatda
 * "Tarif so'rovlari" ro'yxatida (`AdminTariffRequestsPage.jsx`) kelib
 * tushgan so'rovni tasdiqlashda ishlatiladi, lekin admin bu yerdan
 * (`AdminSellerCard.jsx`) HAR QANDAY sotuvchining tarifini so'rovsiz
 * ham to'g'ridan-to'g'ri o'zgartira oladi.
 *
 * 2026-09 TUZATISH: ILGARI bu — `setSellerAiCeoAccess.js` deb atalgan,
 * FAQAT ikkilik (AI CEO yoqilgan="pro" / o'chirilgan="start") tugma
 * edi — Z-Biznes darajasini berish uchun hech qanday admin boshqaruvi
 * yo'q edi (faqat Firebase Console orqali qo'lda). Endi bu funksiya
 * UCHALA tarifni ham qo'llab-quvvatlaydi.
 *
 * `aiCeoEnabled` avtomatik sinxronlanadi: "start" — o'chiriladi,
 * "pro"/"biznes" — yoqiladi (ikkalasi ham AI CEO'ga ega — tarif
 * jadvaliga qarang: `functions/lib/tariffs.js`ning `TARIFF_LIMITS`,
 * `src/utils/tariffLimits.js` — frontend ko'zgusi).
 */
const setSellerTariffPlan = async (sellerId, plan) => {
  if (!sellerId) throw new Error("Sotuvchi ID topilmadi.");
  if (!VALID_PLANS.includes(plan)) {
    throw new Error(`Noto'g'ri tarif: "${plan}". Faqat "start"/"pro"/"biznes" bo'lishi mumkin.`);
  }
  try {
    await updateDoc(doc(db, "sellers", sellerId), {
      tariffPlan: plan,
      aiCeoEnabled: plan !== "start",
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    throw new Error(error.message || "Tarifni o'zgartirishda xatolik", { cause: error });
  }
};

export default setSellerTariffPlan;
