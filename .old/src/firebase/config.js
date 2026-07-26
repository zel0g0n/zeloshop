// src/firebase/config.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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
export const db = getFirestore(app);     
export const storage = getStorage(app);