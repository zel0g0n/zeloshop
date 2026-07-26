import { db } from '@/firebase/config';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';

const getSellerProducts = (sellerId, onSuccess, onError) => {
  if (!sellerId) throw new Error("Mahsulotlar topilmadi!");

  const q = query(
    
    collection(db, 'products'),
    where("sellerId", "==", sellerId),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    q,
    (snapshot) => {

      const products = snapshot.docs.map(doc => {

        const data = doc.data();

        return {
          id: doc.id,
          ...data,
        };

      });

      onSuccess(products);

    },
    (error) => {

      console.error("Firestore Error:", error);

      if (onError) {
        onError(error);
      }

    }
  );
};

export default getSellerProducts;