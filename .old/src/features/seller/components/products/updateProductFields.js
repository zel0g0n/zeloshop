import { db } from "@/firebase/config.js";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";


const updateProductFields = async (productId, fields) => {
  if (!productId) throw new Error("productId majburiy");

  const productRef = doc(db, "products", productId);
  await updateDoc(productRef, {
    ...fields,
    updatedAt: serverTimestamp(),
  });
};

export default updateProductFields;
