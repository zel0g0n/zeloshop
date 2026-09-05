import { db } from '@/firebase/config';
import { collection, query, where, orderBy, limit as fbLimit } from 'firebase/firestore';
import { subscribeWithFastInitial } from '@/services/shared/subscribeWithFastInitial';

const mapProductDoc = (doc) => ({ id: doc.id, ...doc.data() });

// OLDIN: to'g'ridan-to'g'ri `onSnapshot()` — bu birinchi natija
// kelishidan oldin real-vaqtli kanal ulanishini talab qilardi (o'lchov
// bo'yicha ~2.5s). ENDI: `subscribeWithFastInitial` orqali — avval
// tez, bir martalik o'qish, keyin fon rejimida jonli ulanish. Tashqi
// interfeys (parametrlar, qaytariladigan unsubscribe) O'ZGARMADI —
// shuning uchun buni chaqiradigan hook hech narsani bilishi shart emas.
//
// KEYINGI TUZATISH: OLDIN bu so'rov HECH QANDAY chegarasiz edi —
// sotuvchida minglab mahsulot bo'lsa, ularning HAMMASI, har safar
// sahifa ochilganda, to'liq yuklanardi. Endi standart holatda
// FAQAT so'nggi `pageSize` ta mahsulot yuklanadi ("Yana yuklash"
// tugmasi orqali kengaytiriladi) — bu, katalog qanchalik katta
// bo'lishidan qat'i nazar, sahifaning DASTLABKI ochilishini tez
// ushlab turadi.
const getSellerProducts = (sellerId, onSuccess, onError, pageSize = 100) => {
  if (!sellerId) throw new Error("Mahsulotlar topilmadi!");

  const q = query(
    collection(db, 'products'),
    where("sellerId", "==", sellerId),
    orderBy("createdAt", "desc"),
    fbLimit(pageSize)
  );

  return subscribeWithFastInitial(q, mapProductDoc, onSuccess, onError);
};

export default getSellerProducts;
