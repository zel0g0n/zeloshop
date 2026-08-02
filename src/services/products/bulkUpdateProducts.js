import { db } from "@/firebase/config";
import { doc, writeBatch } from "firebase/firestore";

// Bir nechta mahsulotni bir vaqtda o'chirish yoki faol/nofaol qilish —
// har biri uchun alohida so'rov yuborish o'rniga, Firestore'ning
// `writeBatch` mexanizmi orqali BITTA tarmoq so'rovida amalga oshiriladi
// (tezroq, va agar biror muammo bo'lsa hech biri qisman qo'llanmaydi).
const bulkUpdateProducts = async (productIds, action) => {
  if (!productIds || productIds.length === 0) return;
  const batch = writeBatch(db);

  productIds.forEach((id) => {
    const ref = doc(db, "products", id);
    if (action === "delete") {
      batch.delete(ref);
    } else if (action === "activate") {
      batch.update(ref, { isActive: true, updatedAt: new Date().toISOString() });
    } else if (action === "deactivate") {
      batch.update(ref, { isActive: false, updatedAt: new Date().toISOString() });
    }
  });

  try {
    await batch.commit();
  } catch (error) {
    throw new Error(error.message || "Ommaviy amalni bajarishda xatolik yuz berdi", { cause: error });
  }
};

export default bulkUpdateProducts;
