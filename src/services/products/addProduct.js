import { db } from "@/firebase/config";
import { addDoc, collection } from "firebase/firestore";

const addProduct = async (productData, sellerId) => {
  if (!sellerId) {
    throw new Error("Mahsulot qo'shish uchun sotuvchi ID topilmadi.");
  }
  try {
    const productCollection = collection(db, "products");

    // `images` — ko'p rasm (4 tagacha), birinchi eleman doim thumbnail
    // (asosiy rasm) hisoblanadi. `image` maydoni ESKI kod bilan
    // moslik (backward compatibility) uchun saqlanadi — ProductCard,
    // CartItem va boshqa ko'plab joylar hali ham shu maydonni o'qiydi.
    const images = Array.isArray(productData.images) ? productData.images.filter(Boolean).slice(0, 4) : [];

    const productDataForFirebase = {
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
      image: images[0] || productData.image || null,

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