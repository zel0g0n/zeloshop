import { db } from "@/firebase/config.js";
import { doc, updateDoc } from "firebase/firestore";

const updateClientData = async (userID, updatedFields) => {
  const userPath = `clients/${userID}`;
  try {
    const userDocRef = doc(db, userPath);
    await updateDoc(userDocRef, updatedFields);
    
    return updatedFields; 
  } catch (error) {
    console.error("Profilni yangilashda xatolik:", error.message);
    throw new Error(error.message || "Xatolik yuz berdi", { cause: error });
  }
};

export default updateClientData;