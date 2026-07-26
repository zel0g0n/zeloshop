import { db } from '@/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const sendOrder = async (customerData, cartData, sellerId, userID) => {
  try {
    const orderCollection = collection(db, 'orders'); 
    
    const orderDataForFirebase = {
      sellerId,
      clientId: userID,
      customer: customerData,
      orders: cartData,
      status: "new",
      totalAmount: cartData.reduce((sum, item) => sum + item.price * item.quantity, 0),
      createdAt: serverTimestamp() // Firebase bazasi buni o'zi vaqtga aylantiradi
    };
    
    const docRef = await addDoc(orderCollection, orderDataForFirebase);
    
    const orderDataForRedux = {
      ...orderDataForFirebase,
      createdAt: new Date().toISOString() 
    };
    
    return { id: docRef.id, ...orderDataForRedux }; 
  } catch (error) {
    console.error("Order sending error in service:", error);
    throw error;
  }
};

export default sendOrder;
