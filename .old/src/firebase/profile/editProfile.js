import { db } from '@/firebase/config';
import { doc, updateDoc } from 'firebase/firestore';

const updateProfileData = async ( updatedFields) => {
  const userPath = 'sellers/yGsq7Cmn2C3IF103gtGm/clients/QdPK91xipZh6c6JHaupV' 
  try {
    const userDocRef = doc(db, "clients", userPath);
    
    await updateDoc(userDocRef, updatedFields);
    return { success: true };
  } catch (error) {
    console.error("Profilni yangilashda xatolik:", error);
    throw error;
  }
};

export default updateProfileData;