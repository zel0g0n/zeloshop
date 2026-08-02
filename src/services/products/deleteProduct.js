import { db } from "@/firebase/config";
import { doc, deleteDoc } from "firebase/firestore";

const deleteProduct = async (productId) => {
  if (!productId) throw new Error("Mahsulot ID topilmadi.");
  try {
    await deleteDoc(doc(db, "products", productId));
    return { id: productId };
  } catch (error) {
    throw new Error(error.message || "Mahsulotni o'chirishda xatolik yuz berdi", { cause: error });
  }
};

export default deleteProduct;
