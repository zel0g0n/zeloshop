import { db } from "@/firebase/config";
import { doc, updateDoc } from "firebase/firestore";

/**
 * Mahsulotning BARCHA maydonlarini yangilaydi (avvalgi `updateProduct.js`
 * faqat narx/stok uchun edi — bu esa to'liq tahrirlash sahifasi uchun).
 */
const updateProductFull = async (productId, productData) => {
  if (!productId) throw new Error("Mahsulot ID topilmadi.");

  const images = Array.isArray(productData.images) ? productData.images.filter(Boolean).slice(0, 4) : [];

  const updateData = {
    name: productData.title || "",
    category: productData.category || "Boshqa",
    price: Number(productData.price) || 0,
    costPrice: Number(productData.costPrice) || 0,
    discountPrice: productData.discountPrice != null ? Number(productData.discountPrice) : null,
    paymentTypes: Array.isArray(productData.paymentTypes) && productData.paymentTypes.length > 0
      ? productData.paymentTypes
      : ["prepay"],
    stock: Number(productData.stock) || 0,
    description: productData.description || "",
    variants: productData.variants || [],
    images,
    image: images[0] || null,
    updatedAt: new Date().toISOString(),
  };

  try {
    await updateDoc(doc(db, "products", productId), updateData);
    return { id: productId, ...updateData };
  } catch (error) {
    throw new Error(error.message || "Mahsulotni yangilashda xatolik yuz berdi", { cause: error });
  }
};

export default updateProductFull;
