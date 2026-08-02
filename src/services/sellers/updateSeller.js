import { db } from "@/firebase/config";
import { doc, updateDoc } from "firebase/firestore";

const updateSeller = async (sellerId, fields) => {
  if (!sellerId) throw new Error("Sotuvchi ID topilmadi.");
  try {
    await updateDoc(doc(db, "sellers", sellerId), fields);
  } catch (error) {
    throw new Error(error.message || "Do'kon ma'lumotlarini yangilashda xatolik", { cause: error });
  }
};

export default updateSeller;
