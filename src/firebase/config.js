// src/firebase/config.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
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
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

export const storage = getStorage(app);
// OLDIN: `getFunctions(app)` hech qanday mintaqasiz chaqirilgan edi —
// bu standart holatda `us-central1`ga murojaat qiladi. Barcha Cloud
// Function'lar `asia-south1`ga ko'chirilgandan keyin, frontend hali
// ham ESKI (endi o'chirilgan) manzilga so'rov yuborishda davom
// etardi — bu CORS xatosi va "internal" xato ko'rinishida namoyon
// bo'lardi (kirish, mahsulot qo'shish, buyurtma berish — barchasi).
export const functions = getFunctions(app, "asia-south1");