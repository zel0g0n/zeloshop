import { db } from "@/firebase/config.js";
import { collection, getDocs } from "firebase/firestore";

const getProducts = async () => {
  try {
    const productsCollection = collection(db, "products");
    const productsSnapshot = await getDocs(productsCollection);

    const products = productsSnapshot.docs.map((doc) => {
      const data = doc.data();

      // Firebase Timestamp bo'lsa toISOString() qilamiz, aks holda o'zini qoldiramiz
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt;
      const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt;

      return {
        ...data,
        id: doc.id,
        ...(createdAt && { createdAt }),
        ...(updatedAt && { updatedAt }),
      };
    });

    return products;
  } catch (error) {
    console.error("Products fetching error:", error);
    // Thunk error block'iga tushishi uchun xatolikni throw qilamiz
    throw error;
  }
};

export default getProducts;