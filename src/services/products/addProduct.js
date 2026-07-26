import { db } from "@/firebase/config";
import { addDoc, collection } from "firebase/firestore";

const addProduct = async (productData, sellerId) => {
  if (!sellerId) {
    throw new Error("Mahsulot qo'shish uchun sotuvchi ID topilmadi.");
  }
  try {
    const productCollection = collection(db, "products");

    const productDataForFirebase = {
      name: productData.title || "",
      category: productData.category || "Skincare",
      price: Number(productData.price) || 0,
      costPrice: Number(productData.costPrice) || 0,
      stock: Number(productData.stock) || 0,
      description: productData.description || "",
      variants: productData.variants || [],
      image: productData.image || null, // Yuklab bo'lingan tayyor URL manzil keladi ✅

      // Tizim parametrlari
      rating: 0,
      sold: 0,
      isNew: true,
      promotion: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sellerId
    };

    // undefined qiymatlar Firestore'da 400 xatolik bermasligi uchun tozalash
    Object.keys(productDataForFirebase).forEach((key) => {
      if (productDataForFirebase[key] === undefined) {
        delete productDataForFirebase[key];
      }
    });

    const docRef = await addDoc(productCollection, productDataForFirebase);

    return {
      id: docRef.id,
      ...productDataForFirebase,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  } catch (error) {
    console.error("Add Product Service Error:", error);
    throw error;
  }
};

export default addProduct;