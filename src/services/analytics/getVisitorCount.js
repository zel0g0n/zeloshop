import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import { createCache } from "@/lib/cache/memoryCache";

// XAVFSIZLIK/SAMARADORLIK AUDITI (2026-09, caching audit): OLDIN
// Dashboard'da "Hafta"/"Oy" tablarini har safar almashtirilganda
// (hatto bir necha soniya oldin so'ralgan bo'lsa ham) shu Cloud
// Function QAYTA chaqirilardi. Endi qisqa TTL (60s) bilan keshlanadi
// — tashriflar soni soniyama-soniya o'zgarmaydigan agregatsiya
// natijasi, shuning uchun bir daqiqagacha eskirishi UX'ga sezilarli
// ta'sir qilmaydi, lekin tab almashtirish orqali takroriy chaqiruvlar
// (Firebase Cloud Function xarajati) sezilarli kamayadi.
//
// Kalit `${sellerId}:${daysBack}` tenant-aware (har bir sotuvchi
// o'zining keshiga ega, boshqa sotuvchining ma'lumoti aralashmaydi).
const visitorCountCache = createCache({
  namespace: "visitorCount",
  version: "v1",
  defaultTtlMs: 60000,
  maxEntries: 100,
});

/**
 * "Hafta"/"Oy" davrlari uchun noyob tashriflar sonini serverdan
 * so'raydi (mijoz SDK'i `visits` kolleksiyasini to'g'ridan-to'g'ri
 * o'qiy olmaydi — Firestore qoidalari buni taqiqlaydi).
 */
export const getVisitorCount = async (sellerId, daysBack) => {
  const cacheKey = `${sellerId}:${daysBack}`;
  return visitorCountCache.getOrFetch(cacheKey, async () => {
    const callable = httpsCallable(functions, "getVisitorCount");
    const { data } = await callable({ sellerId, daysBack });
    return data.visitorCount;
  });
};
