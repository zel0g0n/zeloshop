import { db } from "@/firebase/config";
import { doc, writeBatch } from "firebase/firestore";

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

export default bulkUpdateOrders;
