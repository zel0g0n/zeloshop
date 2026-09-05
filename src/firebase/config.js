// src/firebase/config.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyDuGD8MgG4E0EqB3yougEcb0a91ESdlMwE",
  authDomain: "commerce-zelo.firebaseapp.com",
  projectId: "commerce-zelo",
  storageBucket: "commerce-zelo.firebasestorage.app",
  messagingSenderId: "840920701063",
  appId: "1:840920701063:web:f08481e8b010b8b5348022",
  measurementId: "G-W0653YTZXZ"
};

// Firebaseni ishga tushirish (Analytics-ni olib tashladik)
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// OLDIN: `getFirestore(app)` standart sozlamalar bilan chaqirilgan edi —
// bu holatda Firestore SDK AVVAL WebSocket ulanishini sinab ko'radi,
// va faqat u ishlamasa (yoki sekin javob bersa) "uzoq-so'rov"
// (long-polling) rejimiga o'tadi. Diagnostika shuni ko'rsatdiki,
// autentifikatsiyadan keyingi ENG BIRINCHI Firestore so'rovi (admin+
// do'kon hujjatlarini o'qish) yolg'iz o'zi ~4.8 soniya olayotgan edi —
// bu aynan shu "aniqlash" jarayonining Telegram WebView'da sekin
// ishlashiga o'xshaydi. `experimentalAutoDetectLongPolling` — Google'ning
// o'zi shu holat uchun tavsiya qilgan, tezroq aniqlash usuli.
// 2026-09 audit: IndexedDB keshini (persistent local cache) yoqish.
//
// OLDIN: keshsiz (standart, faqat xotiradagi) rejim — sahifa
// yangilanganda yoki komponent tez orada QAYTA MONTAJ qilinganda
// (masalan marshrutlash/StrictMode tufayli bir xil `onSnapshot`
// ikkinchi marta obuna bo'lganda), Firestore SDK'ning eslab qolishga
// joyi yo'q edi — har bir yangi obuna serverdan QAYTA o'qishga
// majbur bo'lardi (bir xil hujjatlar uchun ikki baravar to'lovli
// o'qish). Bundan tashqari, sahifa yangilanganda foydalanuvchi HAR
// SAFAR bo'sh holatdan (skeleton/spinner) boshlab, faqat internet
// javob berganda haqiqiy ma'lumotni ko'rardi.
//
// ENDI: `persistentLocalCache` yoqilgan — SDK endi o'qigan
// hujjatlarni qurilmaning IndexedDB'siga saqlaydi. Natijada: (1)
// keyingi obunalar/qayta montajlar avval keshdan DARHOL (bepul)
// javob oladi, keyin fon rejimida serverdan yangilanadi — bu xuddi
// shu hujjat uchun qayta-qayta to'lovli o'qishni kamaytiradi; (2)
// sahifa yangilanganda foydalanuvchi oxirgi ko'rgan ma'lumotini
// DARHOL (offline holatda ham) ko'radi, bo'sh skeleton'ni emas.
// `persistentMultipleTabManager()` — agar foydalanuvchi Mini App'ni
// bir nechta oyna/tab'da parallel ochsa (masalan brauzerda test
// qilishda), IndexedDB'ga faqat bitta tab yozishi mumkinligi
// muammosini avtomatik hal qiladi (tablar orasida muvofiqlashtiradi),
// aks holda faqat BIRINCHI ochilgan tab kesh ola olardi.
//
// XAVFSIZLIK ZAXIRASI: ba'zi muhitlarda (masalan IndexedDB butunlay
// bloklangan xususiy/incognito rejim, yoki ba'zi eski WebView'lar)
// bu chaqiruv istisno (`failed-precondition`/`unimplemented`) tashlab
// yuborishi mumkin. Bunday holatda ilova BUTUNLAY ishlamay qolmasligi
// kerak — shuning uchun xato ushlanadi va standart (keshsiz, lekin
// TO'LIQ ISHLAYDIGAN) rejimga qaytiladi.
function createFirestoreInstance() {
  try {
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (err) {
    console.error(
      "Firestore IndexedDB keshini yoqib bo'lmadi (muhit qo'llab-quvvatlamasligi mumkin) — xotiradagi standart rejimga qaytildi:",
      err
    );
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
  }
}

export const db = createFirestoreInstance();

export const storage = getStorage(app);
// OLDIN: `getFunctions(app)` hech qanday mintaqasiz chaqirilgan edi —
// bu standart holatda `us-central1`ga murojaat qiladi. Barcha Cloud
// Function'lar `asia-south1`ga ko'chirilgandan keyin, frontend hali
// ham ESKI (endi o'chirilgan) manzilga so'rov yuborishda davom
// etardi — bu CORS xatosi va "internal" xato ko'rinishida namoyon
// bo'lardi (kirish, mahsulot qo'shish, buyurtma berish — barchasi).
export const functions = getFunctions(app, "asia-south1");