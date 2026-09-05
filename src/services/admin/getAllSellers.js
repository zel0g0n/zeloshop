import { db } from "@/firebase/config";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getCountFromServer,
} from "firebase/firestore";

const mapSellerDoc = (doc) => ({ id: doc.id, ...doc.data() });

// Sahifa hajmi — `getDiscoverStores.js`dagi bilan bir xil mantiq:
// birinchi ko'rinish tez yuklanishi uchun kichik ushlanadi, "Yana
// yuklash" tugmasi orqali kengaytiriladi.
export const ADMIN_SELLERS_PAGE_SIZE = 30;

// Qidiruv uchun — pastdagi izohga qarang.
export const ADMIN_SELLER_SEARCH_SCAN_CAP = 3000;

/**
 * 2026-09 audit: OLDIN bu servis `subscribeAllSellers` orqali BUTUN
 * `sellers` kolleksiyasiga CHEKSIZ (limit'siz), DOIMIY OCHIQ real-vaqtli
 * (`onSnapshot`) tinglovchi ochardi — admin bu sahifani ochib turgan
 * HAR DAQIQA, platformadagi HAR BIR sotuvchi hujjati (100ta bo'lsa ham,
 * 100 000ta bo'lsa ham) yuklab olinar va kuzatilardi. Bu ikki muammoga
 * olib kelardi: (1) narx/tarmoq — sotuvchilar soni o'sgan sari bu
 * sahifaning har ochilishi tobora qimmatlashadi; (2) doimiy ochiq
 * tinglovchi — admin panelda haqiqiy vaqt rejimi shart EMAS (admin
 * "Yangilash" tugmasini bosishi yoki sahifani qayta ochishi kifoya).
 *
 * ENDI: haqiqiy (mock emas) sahifalab o'qish — `limit()` + `startAfter()`
 * kursori bilan, faqat kerakli sahifa BIR MARTALIK o'qiladi. Standart
 * ko'rinish ("Barchasi"/"Faol") uchun oddiy `orderBy(createdAt)`
 * so'rovi; "To'xtatilgan" filtri esa ALOHIDA, `status == "suspended"`
 * shartli, INDEKSLANGAN so'rov (pastdagi `firestore.indexes.json`ga
 * qo'shilgan kompozit indeksga qarang) — shunda bu yorliq HAM to'liq,
 * server tomonida aniq natija beradi, sahifadagi tasodifiy 30 tadan
 * emas.
 *
 * "Faol" yorlig'i uchun ATAYLAB alohida indekslangan so'rov QILINMADI:
 * Firestore'da "status maydoni yo'q YOKI 'suspended' emas" shartini
 * bitta so'rovda ifodalab bo'lmaydi (`!=` operatori maydon UMUMAN
 * yo'q hujjatlarni chiqarib tashlaydi — bu xuddi shu xatoning
 * `referralLeaderboardBonus` cron'dagi versiyasi, boshqa vazifada
 * alohida hujjatlangan). Sotuvchilarning katta ko'pchiligi "faol"
 * bo'lgani uchun, oddiy sahifalab o'qish + har bir sahifada mijoz
 * tomonida `status !== "suspended"` filtri amaliyotda YETARLI — faqat
 * NOTO'G'RI/YETISHMOVCHI natija emas, balki "shu sahifada ozroq
 * element ko'rinishi mumkin" darajasidagi, zararsiz cheklov.
 */
export const getSellersPage = async ({ statusFilter = "all", cursor = null } = {}) => {
  try {
    const constraints = [];
    if (statusFilter === "suspended") {
      constraints.push(where("status", "==", "suspended"));
    }
    constraints.push(orderBy("createdAt", "desc"));
    constraints.push(limit(ADMIN_SELLERS_PAGE_SIZE));

    const baseQuery = query(collection(db, "sellers"), ...constraints);
    const finalQuery = cursor ? query(baseQuery, startAfter(cursor)) : baseQuery;

    const snap = await getDocs(finalQuery);
    const sellers = snap.docs.map(mapSellerDoc);
    const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

    return { sellers, lastDoc, hasMore: snap.docs.length === ADMIN_SELLERS_PAGE_SIZE };
  } catch (error) {
    throw new Error(error.message || "Sotuvchilar ro'yxatini yuklashda xatolik", { cause: error });
  }
};

/**
 * Tab yorliqlaridagi ("Barchasi (N)") sonlarni HAQIQIY (butun
 * kolleksiyani yuklamasdan) ko'rsatish uchun — arzon aggregatsiya
 * so'rovlari (`getPlatformStats.js`dagi bilan bir xil naqsh).
 */
export const getSellerCounts = async () => {
  try {
    const [totalSnap, suspendedSnap] = await Promise.all([
      getCountFromServer(collection(db, "sellers")),
      getCountFromServer(query(collection(db, "sellers"), where("status", "==", "suspended"))),
    ]);
    const total = totalSnap.data().count;
    const suspended = suspendedSnap.data().count;
    return { total, suspended, active: total - suspended };
  } catch (error) {
    throw new Error(error.message || "Sotuvchilar sonini hisoblashda xatolik", { cause: error });
  }
};

/**
 * Do'kon nomi/telefon bo'yicha qidiruv.
 *
 * MUHIM, HALOL CHEKLOV: Firestore'da matn ichidan (substring) qidiruvni
 * to'g'ridan-to'g'ri so'rov bilan qilib bo'lmaydi (bunga alohida,
 * har bir sotuvchi yaratilganda/nomi o'zgartirilganda yangilanadigan
 * indekslangan maydon + BARCHA eski sotuvchilar uchun bir martalik
 * ma'lumot ko'chirish (backfill) kerak bo'lardi — bu ATAYLAB QILINMADI,
 * chunki bu HOZIRGI muammoni (cheksiz o'qish) hal qilish uchun shart
 * emas, faqat qo'shimcha, alohida xavfli ko'chirish qatlamini qo'shgan
 * bo'lardi). Shuning uchun bu yerda — `execGetCustomerSegments`da
 * (aiCeoAgent.js) ALLAQACHON qo'llangan xuddi shu naqsh: eng so'nggi
 * `ADMIN_SELLER_SEARCH_SCAN_CAP` tagacha sotuvchini BIR MARTALIK
 * o'qib, ular ICHIDA mijoz tomonida qidiramiz. Agar sotuvchilar soni
 * shu chegaradan oshsa, natija `isApproximate: true` bilan qaytadi —
 * bu HOLDA UI buni ko'rsatishi SHART (soxta "topilmadi" emas, balki
 * "eng so'nggi N ta orasida qidirilmoqda" degan halol ogohlantirish).
 */
export const searchSellers = async (searchText) => {
  const normalized = searchText.trim().toLowerCase();
  if (!normalized) return { results: [], isApproximate: false };

  try {
    const scanQuery = query(
      collection(db, "sellers"),
      orderBy("createdAt", "desc"),
      limit(ADMIN_SELLER_SEARCH_SCAN_CAP)
    );
    const snap = await getDocs(scanQuery);
    const allScanned = snap.docs.map(mapSellerDoc);

    const results = allScanned.filter((seller) => {
      return (
        seller.storeName?.toLowerCase().includes(normalized) ||
        seller.phone?.includes(normalized)
      );
    });

    return { results, isApproximate: allScanned.length === ADMIN_SELLER_SEARCH_SCAN_CAP };
  } catch (error) {
    throw new Error(error.message || "Sotuvchilarni qidirishda xatolik", { cause: error });
  }
};
