import { getDocs, onSnapshot } from "firebase/firestore";

/**
 * "Tez ko'rsatish + jonli yangilanish" gibrid strategiyasi.
 *
 * OLDIN: to'g'ridan-to'g'ri `onSnapshot()` ishlatilardi — bu esa
 * BIRINCHI natija kelishidan oldin, Firestore'ning real-vaqtli
 * ulanishini (WebChannel) to'liq o'rnatilishini talab qiladi. Bu
 * ulanishni o'rnatish — Telegram WebView kabi muhitlarda — bir necha
 * soniya olishi mumkin (buni aniq o'lchov orqali tasdiqladik).
 *
 * ENDI: avval BIR MARTALIK (`getDocs`) o'qish orqali ma'lumot TEZKOR
 * qaytariladi — bu oddiy so'rov, real-vaqtli kanal ulanishini talab
 * qilmaydi. Foydalanuvchi DARHOL ma'lumotni ko'radi. Shu bilan bir
 * vaqtda, FON REJIMIDA haqiqiy `onSnapshot` tinglovchisi ulanadi —
 * shu ulangandan keyingi har qanday o'zgarish (yangi buyurtma,
 * mahsulot tahriri va h.k.) hali ham TO'LIQ jonli, avtomatik
 * yangilanadi. Foydalanuvchi funksional farqni sezmaydi — faqat
 * DASTLABKI ko'rinish sezilarli tezroq bo'ladi.
 *
 * @param {import("firebase/firestore").Query} firestoreQuery
 * @param {(doc: import("firebase/firestore").QueryDocumentSnapshot) => any} mapDoc
 * @param {(items: any[]) => void} onData
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} unsubscribe
 */
export const subscribeWithFastInitial = (firestoreQuery, mapDoc, onData, onError) => {
  let cancelled = false;
  let unsubscribeLive = null;

  getDocs(firestoreQuery)
    .then((snapshot) => {
      if (cancelled) return;
      onData(snapshot.docs.map(mapDoc));
    })
    .catch((error) => {
      // Boshlang'ich o'qish muvaffaqiyatsiz bo'lsa ham, pastda hali
      // real-vaqtli ulanishni sinab ko'ramiz — balki vaqtinchalik
      // muammo edi (masalan tarmoq uzilishi).
      console.error("Boshlang'ich (bir martalik) o'qishda xatolik:", error);
    })
    .finally(() => {
      if (cancelled) return;
      unsubscribeLive = onSnapshot(
        firestoreQuery,
        (snapshot) => {
          if (cancelled) return;
          onData(snapshot.docs.map(mapDoc));
        },
        (error) => {
          if (cancelled) return;
          console.error("Firestore Error:", error);
          onError?.(error);
        }
      );
    });

  return () => {
    cancelled = true;
    if (unsubscribeLive) unsubscribeLive();
  };
};
