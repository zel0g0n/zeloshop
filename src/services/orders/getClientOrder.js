import { db } from '@/firebase/config';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { subscribeWithFastInitial } from '@/services/shared/subscribeWithFastInitial';

const mapOrderDoc = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt ? data.createdAt.toMillis() : null,
  };
};

// Mijoz tomonidagi buyurtmalar tarixi — xuddi sotuvchi buyurtmalari
// kabi, endi tez (bir martalik) o'qish + fon rejimida jonli ulanish
// gibrid strategiyasini ishlatadi.
const getClientOrderData = (clientId, sellerId, onSuccess, onError) => {
  if (!clientId) throw new Error("Client ID ko'rsatilmadi!");
  if (!sellerId) throw new Error("Seller ID ko'rsatilmadi!");

  const q = query(
    collection(db, 'orders'),
    where("clientId", "==", clientId),
    where("sellerId", "==", sellerId),
    orderBy("createdAt", "desc")
  );

  return subscribeWithFastInitial(q, mapOrderDoc, onSuccess, onError);
};

export default getClientOrderData;
