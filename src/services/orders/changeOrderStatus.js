import { updateDoc, doc } from "firebase/firestore";
import { db } from '@/firebase/config';


const changeOrderStatus = async (orderId, newStatus) => {
  if (!orderId) {
        throw new Error("Order ID topilmadi.");
    }
  try {
    const updateDocRef = doc(db,"orders",orderId)
    await updateDoc(updateDocRef, {status: newStatus})
    return newStatus
  } catch(error) {
    throw new Error('Status o\'gartirishda xatolik bo\'ldi', error, {cause: error})
  }
}
export default changeOrderStatus