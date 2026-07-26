import {db} from "@/firebase/config.js";
import {doc, getDoc} from "firebase/firestore";
const getSingleProduct = async(productId) => {
  try {
    const docRef = doc(db, "products", productId);
    const docSnap = await getDoc(docRef)
    if(docSnap.exists()) {
      return {id: docSnap.id, ...docSnap.data()};
    }else {
      console.log("Bunday mahsulot topilmadi");
      return null;
    }
  }catch(error) {
    throw new Error("Mahsulotni olishda xatolik yuz berdi: " + error.message, { cause: error });
  }

}
export default getSingleProduct;