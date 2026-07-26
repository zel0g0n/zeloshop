import {db} from "@/firebase/config.js";
import {doc, getDoc} from "firebase/firestore";
const getClientData = async(id) => {
  try {
    const clientDoc = doc(db, `clients/${id}`);
    const clientSnapshot = await getDoc(clientDoc);
    const clientData = { ...clientSnapshot.data(), id: clientSnapshot.id };

    return clientData;
  } catch(error) {
    throw new Error(error.message || "Xatolik yuz berdi", { cause: error });
  }
}

export default getClientData;