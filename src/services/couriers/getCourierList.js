import { db } from "@/firebase/config";
import { collection, query, where, orderBy, doc, onSnapshot } from "firebase/firestore";
import { subscribeWithFastInitial } from "@/services/shared/subscribeWithFastInitial";

const mapCourierDoc = (doc) => ({ id: doc.id, ...doc.data() });

/**
 * Sotuvchining "Kuryerlar" sahifasi uchun — o'ziga tegishli barcha
 * kuryerlar ro'yxati.
 *
 * MUHIM: bu — Cloud Function EMAS, to'g'ridan-to'g'ri Firestore
 * so'rovi (`firestore.rules`dagi `couriers/{courierId}`ning
 * `allow read: if isOwner(courierId) || request.auth.uid ==
 * resource.data.sellerId || isAdmin()` qoidasiga tayanadi — so'rov
 * `sellerId == o'z uid'i` bilan CHEGARALANGANI uchun, Firestore
 * qaytariladigan HAR BIR hujjat uchun qoidani ISHONCHLI tekshira
 * oladi). Boshqa sotuvchi ma'lumotlari (masalan `sellers/{id}/
 * customers`) BILAN BIR XIL naqsh.
 */
export const getCourierList = (sellerId, onSuccess, onError) => {
  if (!sellerId) throw new Error("Sotuvchi ID'si ko'rsatilmadi!");

  const q = query(
    collection(db, "couriers"),
    where("sellerId", "==", sellerId),
    orderBy("linkedAt", "desc")
  );

  return subscribeWithFastInitial(q, mapCourierDoc, onSuccess, onError);
};

/**
 * Kuryer Mini App'ining O'ZI uchun — o'z hujjatiga (`couriers/{id}`)
 * JONLI obuna. YANGI (o'zini "band" qilish xususiyati): kuryer
 * o'zining faol/band holatini boshqa joyda (masalan sotuvchi
 * "Kuryerlar" sahifasidan) o'zgartirilganda ham, Mini App'ning O'ZI
 * `setCourierActive`ni chaqirganda ham — HAR IKKALA holatda ham
 * almashtirgich UI real vaqtda yangilanib turishi uchun oddiy
 * `getDoc` o'rniga to'g'ridan-to'g'ri `onSnapshot` ishlatiladi
 * (`firestore.rules`dagi `isOwner(courierId)` o'qish shartiga
 * tayanadi).
 */
export const subscribeToCourierStatus = (courierId, onSuccess, onError) => {
  if (!courierId) throw new Error("Kuryer ID'si ko'rsatilmadi!");
  return onSnapshot(
    doc(db, "couriers", String(courierId)),
    (snap) => onSuccess(snap.exists() ? snap.data() : null),
    onError
  );
};
