import { db } from "@/firebase/config";
import { collection, query, where, orderBy, doc, onSnapshot } from "firebase/firestore";
import { subscribeWithFastInitial } from "@/services/shared/subscribeWithFastInitial";

const mapStaffDoc = (docSnap) => ({ id: docSnap.id, ...docSnap.data() });

/**
 * Sotuvchining "Xodimlar" sahifasi uchun — o'ziga tegishli barcha
 * xodimlar ro'yxati. `getCourierList.js` bilan AYNAN BIR XIL naqsh:
 * bu — Cloud Function EMAS, to'g'ridan-to'g'ri Firestore so'rovi
 * (`firestore.rules`dagi `staff/{staffId}`ning `allow read: if
 * isOwner(staffId) || request.auth.uid == resource.data.sellerId ||
 * isAdmin()` qoidasiga tayanadi).
 */
export const getStaffList = (sellerId, onSuccess, onError) => {
  if (!sellerId) throw new Error("Sotuvchi ID'si ko'rsatilmadi!");

  const q = query(
    collection(db, "staff"),
    where("sellerId", "==", sellerId),
    orderBy("linkedAt", "desc")
  );

  return subscribeWithFastInitial(q, mapStaffDoc, onSuccess, onError);
};

/**
 * Xodim Mini App'ining O'ZI uchun — o'z hujjatiga (`staff/{id}`) JONLI
 * obuna (masalan sotuvchi ruxsatlarini o'zgartirsa, Mini App darhol
 * ko'radi — sahifani yangilash shart emas). `getCourierList.js`dagi
 * `subscribeToCourierStatus` bilan bir xil naqsh.
 */
export const subscribeToStaffDoc = (staffId, onSuccess, onError) => {
  if (!staffId) throw new Error("Xodim ID'si ko'rsatilmadi!");
  return onSnapshot(
    doc(db, "staff", String(staffId)),
    (snap) => onSuccess(snap.exists() ? snap.data() : null),
    onError
  );
};
