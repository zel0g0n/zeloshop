import { db } from '@/firebase/config';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';

const getClientOrderData = (clientId, onSuccess, onError) => {
  if (!clientId) throw new Error("Client ID ko'rsatilmadi!");

  const q = query(
    
    collection(db, 'orders'),
    where("clientId", "==", clientId),
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

export default getClientOrderData;