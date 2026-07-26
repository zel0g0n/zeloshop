import { db } from '@/firebase/config';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';

const getOrderData = (sellerId, onSuccess, onError) => {
  if (!sellerId) throw new Error("Seller ID ko'rsatilmadi!");

  const q = query(
    
    collection(db, 'orders'),
    where("sellerId", "==", sellerId),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    q,
    (snapshot) => {

      const orders = snapshot.docs.map(doc => {

        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt
            ? data.createdAt.toMillis()
            : null
        };

      });

      onSuccess(orders);

    },
    (error) => {

      console.error("Firestore Error:", error);

      if (onError) {
        onError(error);
      }

    }
  );
};

export default getOrderData;