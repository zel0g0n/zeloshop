import { db } from "@/firebase/config";
import { collection, getDocs, limit, query, startAfter, where } from "firebase/firestore";

// Sahifa hajmi kichik ushlanadi - sekin internetli foydalanuvchida
// ham birinchi ko'rinish tez yuklanishi uchun ("Yana yuklash" tugmasi
// orqali kengaytiriladi).
export const DISCOVER_PAGE_SIZE = 12;

/**
 * Ommaviy "Do'konlarni kashf eting" sahifasi uchun, `showcaseOptIn`
 * orqali ro'yxatdan o'tishga rozi bo'lgan do'konlarni sahifalab
 * o'qiydi.
 *
 * MUHIM: bu — FAQAT BITTA tenglik sharti (`showcaseOptIn == true`),
 * `orderBy` YO'Q - shuning uchun Firestore'da qo'shimcha kompozit
 * indeks yaratish shart emas (loyihada hozircha yagona `firestore.
 * indexes.json` sozlanmagan, shuning uchun bu ataylab qilingan
 * arxitektura qarori).
 *
 * @param {import("firebase/firestore").DocumentSnapshot|null} cursor -
 *   oldingi sahifaning oxirgi hujjati (`startAfter` uchun); birinchi
 *   sahifa uchun `null`.
 * @returns {Promise<{ stores: object[], lastDoc: import("firebase/firestore").DocumentSnapshot|null, hasMore: boolean }>}
 */
export async function getDiscoverStores(cursor = null) {
  const baseQuery = query(
    collection(db, "sellers"),
    where("showcaseOptIn", "==", true),
    limit(DISCOVER_PAGE_SIZE)
  );
  const finalQuery = cursor ? query(baseQuery, startAfter(cursor)) : baseQuery;

  const snap = await getDocs(finalQuery);
  const stores = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

  return { stores, lastDoc, hasMore: snap.docs.length === DISCOVER_PAGE_SIZE };
}
