import { updateDoc, doc } from "firebase/firestore";
import { db } from '@/firebase/config';


const changeOrderStatus = async (orderId, newStatus, extraFields = {}) => {
  if (!orderId) {
        throw new Error("Order ID topilmadi.");
    }
  try {
    const updateDocRef = doc(db,"orders",orderId)
    await updateDoc(updateDocRef, {status: newStatus, ...extraFields})
    return newStatus
  } catch(error) {
    throw new Error("Status o'zgartirishda xatolik bo'ldi", { cause: error })
  }
}
export default changeOrderStatus