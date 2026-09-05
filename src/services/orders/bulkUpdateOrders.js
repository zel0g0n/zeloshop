import { db } from "@/firebase/config";
import { doc, writeBatch, serverTimestamp } from "firebase/firestore";

// Bir nechta buyurtmani bir vaqtda tasdiqlash/kuryerga topshirish/
// bekor qilish uchun — bitta Firestore so'rovida (writeBatch).
const bulkUpdateOrders = async (orderIds, newStatus) => {
  if (!orderIds || orderIds.length === 0) return;
  const batch = writeBatch(db);

  orderIds.forEach((id) => {
    batch.update(doc(db, "orders", id), { status: newStatus });
  });

  try {
    await batch.commit();
  } catch (error) {
    throw new Error(error.message || "Ommaviy amalni bajarishda xatolik yuz berdi", { cause: error });
  }
};

// FOYDALANUVCHI SO'ROVI BILAN QO'SHILDI: "Yetkazildi"/"Bekor qilindi"
// buyurtmalar tarixidan bir nechtasini bir vaqtda "o'chirish" (aslida
// RO'YXATDAN yashirish, `hiddenAt` maydoni orqali - haqiqiy Firestore
// o'chirish EMAS). MUHIM: bu ATAYLAB status-ni O'ZGARTIRMAYDI - faqat
// yangi `hiddenAt` maydonini yozadi, shuning uchun daromad/analitika
// hisob-kitoblari (`computeDeliveredRevenue` va h.k., bular `orders`
// massivining TO'LIQ holatidan hisoblanadi, `hiddenAt`ni tekshirmaydi)
// o'zgarishsiz qoladi - faqat KO'RINISH (ro'yxat) darajasida yashiriladi.
export const bulkHideOrders = async (orderIds) => {
  if (!orderIds || orderIds.length === 0) return;
  const batch = writeBatch(db);

  orderIds.forEach((id) => {
    batch.update(doc(db, "orders", id), { hiddenAt: serverTimestamp() });
  });

  try {
    await batch.commit();
  } catch (error) {
    throw new Error(error.message || "Buyurtmalarni tarixdan o'chirishda xatolik yuz berdi", { cause: error });
  }
};

export default bulkUpdateOrders;
