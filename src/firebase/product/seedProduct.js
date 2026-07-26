import {addDoc, collection} from "firebase/firestore";
import {db} from "../config";
import { flowerProducts } from "../../constants/manualdata";
const seedProducts = async () => {
  try {
    for (const product of flowerProducts) {
      await addDoc(
        collection(db, "products"),
        product
      );
    }

    console.log("Products added successfully");
  } catch (error) {
    console.log(error);
  }
};

export default seedProducts;