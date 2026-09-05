import { httpsCallable } from "firebase/functions";
import { functions, db } from "@/firebase/config";
import { collection, doc, getDoc, query, orderBy, limit, onSnapshot } from "firebase/firestore";

// 2026-09 audit: OLDIN bu yerda HECH QANDAY chegara yo'q edi — juda
// mashhur (masalan minglab sharhga ega) mahsulot uchun HAR BIR
// mijozning qurilmasi BUTUN sharhlar tarixini (jonli tinglovchi
// sifatida) yuklab olardi. Bu — ham Firestore o'qish xarajati, ham
// ekranga chizish (render) xarajati sifatida cheksiz o'sadigan
// muammo edi. `PRODUCT_REVIEWS_LIMIT` — odatiy mahsulot uchun YETARLI
// darajada katta (aksariyat mahsulotlar hali bunchalik sharhga ega
// emas), lekin haqiqiy yuqori chegara.
const PRODUCT_REVIEWS_LIMIT = 150;

export const submitProductReview = async (productId, rating, text, photoUrls = []) => {
  const callable = httpsCallable(functions, "submitProductReview");
  const { data } = await callable({ productId, rating, text, photoUrls });
  return data;
};

export const moderateProductReview = async (productId, reviewId, action) => {
  const callable = httpsCallable(functions, "moderateProductReview");
  const { data } = await callable({ productId, reviewId, action });
  return data;
};

/**
 * Mahsulot sharhlarini JONLI (real-vaqtli) kuzatadi — pin qilingan
 * sharh birinchi, qolganlari eng yangisidan boshlab.
 */
export const subscribeToProductReviews = (productId, onSuccess, onError) => {
  if (!productId) {
    onSuccess([]);
    return () => {};
  }
  const reviewsQuery = query(
    collection(db, "products", productId, "reviews"),
    orderBy("pinned", "desc"),
    orderBy("createdAt", "desc"),
    limit(PRODUCT_REVIEWS_LIMIT)
  );
  return onSnapshot(
    reviewsQuery,
    (snap) => onSuccess(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
};

/**
 * Joriy mijozning O'ZINING shu mahsulotga qoldirgan sharhini alohida
 * (yuqoridagi chegaralangan ro'yxatdan MUSTAQIL) o'qiydi.
 *
 * NEGA ALOHIDA: `functions/reviews.js`da har bir sharh hujjatining
 * ID'si ATAYLAB mijozning `clientId`siga teng qilib yaratiladi (bir
 * mijoz — bitta mahsulotga bitta sharh, qayta yuborsa YANGILANADI).
 * Bu degani, mijozning "men allaqachon sharh qoldirganman"ligini
 * ANIQ bilish uchun BUTUN ro'yxatni yuklash SHART EMAS — to'g'ridan-
 * to'g'ri o'sha bitta hujjatni ID bo'yicha o'qish yetarli. Bu ayniqsa
 * MUHIM, chunki yuqoridagi ro'yxat endi `PRODUCT_REVIEWS_LIMIT` bilan
 * CHEGARALANGAN — agar mijozning eski sharhi shu chegaradan tashqarida
 * qolib ketsa ham (juda mashhur mahsulotda), bu funksiya baribir uni
 * TO'G'RI topadi.
 */
export const getMyProductReview = async (productId, clientId) => {
  if (!productId || !clientId) return null;
  const snap = await getDoc(doc(db, "products", productId, "reviews", clientId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};
