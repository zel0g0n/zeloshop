import {db} from "@/firebase/config.js";
import {collection, getDocs, query, where} from "firebase/firestore";

// OLDIN: BUTUN "products" kolleksiyasi (barcha sotuvchilarning barcha
// mahsulotlari) yuklanardi, hech qanday sotuvchi bo'yicha filtrsiz.
// Bu — ilovaning ENG MUHIM izolyatsiya talabini buzardi: mijoz A
// sotuvchisining havolasi orqali kirsa ham, boshqa sotuvchilarning
// mahsulotlarini ham ko'rardi. Endi FAQAT shu sotuvchining mahsulotlari
// Firestore darajasida (`where`) filtrlanadi.
const getProducts = async (sellerId) => {
  if (!sellerId) return [];
  try {
    const productsCollection = collection(db, "products");
    const scopedQuery = query(productsCollection, where("sellerId", "==", sellerId));
    const productsSnapshot = await getDocs(scopedQuery);
    const products = productsSnapshot.docs.map(doc => ({ ...doc.data() , id: doc.id }));
    return products;
  } catch (error) {
    throw new Error(error.message || "Mahsulotlarni yuklashda xatolik yuz berdi", { cause: error });
  }
}

export default getProducts;
