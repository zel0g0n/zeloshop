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

// OLDIN: to'g'ridan-to'g'ri `onSnapshot()` — bu birinchi natija
// kelishidan oldin real-vaqtli kanal ulanishini talab qilardi (o'lchov
// bo'yicha ~2.5s). ENDI: `subscribeWithFastInitial` orqali — avval
// tez, bir martalik o'qish, keyin fon rejimida jonli ulanish. Tashqi
// interfeys (parametrlar, qaytariladigan unsubscribe) O'ZGARMADI —
// shuning uchun buni chaqiradigan hook hech narsani bilishi shart emas.
const getOrderData = (sellerId, onSuccess, onError) => {
  if (!sellerId) throw new Error("Seller ID ko'rsatilmadi!");

  const q = query(
    collection(db, 'orders'),
    where("sellerId", "==", sellerId),
    orderBy("createdAt", "desc")
  );

  return subscribeWithFastInitial(q, mapOrderDoc, onSuccess, onError);
};

export default getOrderData;
