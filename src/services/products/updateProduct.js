import { db } from "@/firebase/config";
import { doc, updateDoc } from "firebase/firestore";

// Sotuvchi panelidagi "Tezkor tahrirlash" (Quick Edit) oynasi uchun.
// Eslatma: sahifada mahsulotlar allaqachon onSnapshot orqali real-time
// kuzatilgani uchun (useGetSellerProducts) bu yerda alohida Redux thunk
// yoki qo'shimcha o'qish so'rovi shart emas — write qilinishi bilan
// mavjud listener o'zi UI'ni yangilaydi (qo'shimcha Firebase o'qish yo'q).
const updateProduct = async (productId, fields) => {
  if (!productId) throw new Error("Mahsulot ID topilmadi.");
  try {
    const productRef = doc(db, "products", productId);
    await updateDoc(productRef, {
      ...fields,
      updatedAt: new Date().toISOString(),
    });
    return { id: productId, ...fields };
  } catch (error) {
    throw new Error(error.message || "Mahsulotni yangilashda xatolik yuz berdi", { cause: error });
  }
};

export default updateProduct;
