import {db} from "@/firebase/config.js";
import {collection, getDocs} from "firebase/firestore";
const getProducts = async () => {
  try {
    const productsCollection = collection(db, "products");
    const productsSnapshot = await getDocs(productsCollection);
    const products = productsSnapshot.docs.map(doc => ({ ...doc.data() , id: doc.id }));
    return products;
  } catch (error) {
    console.log(error);
    return [];
  }
}

export default getProducts;