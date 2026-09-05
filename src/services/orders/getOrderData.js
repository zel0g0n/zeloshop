import { db } from '@/firebase/config';
import { collection, doc, onSnapshot, query, where, orderBy, limit as fbLimit, Timestamp } from 'firebase/firestore';
import { subscribeWithFastInitial } from '@/services/shared/subscribeWithFastInitial';

// Faqat "So'nggi buyurtmalar" ro'yxati (`RecentOrdersList.jsx`, u
// o'zi `slice(0, 5)` qiladi) uchun ishlatiladi — 50 ta yetarlicha
// katta zaxira, kelajakda ko'rsatiladigan son ozgina oshsa ham.
const RECENT_ORDERS_DISPLAY_LIMIT = 50;

const mapOrderDoc = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt ? data.createdAt.toMillis() : null,
  };
};

// `subscribeWithFastInitial` orqali avval tez, bir martalik o'qish
// bajariladi, so'ngra fon rejimida jonli (real-time) ulanish
// o'rnatiladi — bu, sof `onSnapshot()`ga nisbatan boshlang'ich
// ma'lumot kelishini tezlashtiradi. Tashqi interfeys (parametrlar,
// qaytariladigan unsubscribe funksiyasi) odatdagidek qoladi.
//
// Bu funksiya Buyurtmalar boshqaruv sahifasi uchun mo'ljallangan
// (qidiruv, filtr, ko'plab tanlash — to'liq ro'yxatga muhtoj).
// Standart holatda faqat so'nggi `pageSize` ta buyurtma yuklanadi
// ("Yana yuklash" tugmasi orqali kengaytiriladi) — sotuvchining
// tarixi qancha katta bo'lishidan qat'i nazar, sahifa tez ochiladi.
const getOrderData = (sellerId, onSuccess, onError, pageSize = 150) => {
  if (!sellerId) throw new Error("Seller ID ko'rsatilmadi!");

  const q = query(
    collection(db, 'orders'),
    where("sellerId", "==", sellerId),
    orderBy("createdAt", "desc"),
    fbLimit(pageSize)
  );

  return subscribeWithFastInitial(q, mapOrderDoc, onSuccess, onError);
};

/**
 * Dashboard uchun — faqat so'nggi N kunlik buyurtmalarni yuklaydi.
 *
 * 2026-09 audit: MUHIM TUZATISH — yuqoridagi eski izoh "bu so'rov har
 * doim CHEGARALANGAN, bir xil hajmda qoladi" deb da'vo qilardi, lekin
 * bu NOTO'G'RI edi: so'rov faqat SANA bo'yicha chegaralangan edi,
 * HUJJATLAR SONI bo'yicha emas — juda katta savdo hajmiga ega
 * sotuvchida (masalan kunига yuzlab buyurtma) `daysBack=90` kabi
 * kengroq oyna baribir minglab hujjatni qaytarishi mumkin edi. AMMO
 * bu ma'lumotning YAGONA iste'molchisi — `Dashboard.jsx`dagi "So'nggi
 * buyurtmalar" ro'yxati (`RecentOrdersList.jsx`) — undan faqat
 * `orders.slice(0, 5)` (ENG SO'NGGI 5 tasi) ko'rsatadi. KPI/savdo
 * summalari BU YERDAN EMAS, alohida server-tomonidagi kunlik
 * yig'malardan (`dashboardSummary`) olinadi — shuning uchun bu yerga
 * `limit()` qo'shish HECH QANDAY sonni (hisob-kitobni) BUZMAYDI, faqat
 * ortiqcha yuklab olishning oldini oladi.
 */
export const getRecentOrderData = (sellerId, daysBack, onSuccess, onError) => {
  if (!sellerId) throw new Error("Seller ID ko'rsatilmadi!");

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  cutoff.setHours(0, 0, 0, 0);

  const q = query(
    collection(db, 'orders'),
    where("sellerId", "==", sellerId),
    where("createdAt", ">=", Timestamp.fromDate(cutoff)),
    orderBy("createdAt", "desc"),
    fbLimit(RECENT_ORDERS_DISPLAY_LIMIT)
  );

  return subscribeWithFastInitial(q, mapOrderDoc, onSuccess, onError);
};

/**
 * Bitta mijozning to'liq xarid tarixini yuklaydi — CRM Hub'dagi mijoz
 * tafsilotlari oynasi uchun.
 *
 * Mijozlar ro'yxati (segmentatsiya/LTV) server tomonida oldindan
 * hisoblangan yig'ma yozuvlardan (`useCrmCustomers`/`customers`
 * kolleksiyasi) o'qiladi — u yerda har bir buyurtmaning o'zi emas,
 * faqat jamlangan sonlar (LTV, buyurtmalar soni) saqlanadi. Shuning
 * uchun mijoz kartochkasi bosilganda, uning to'liq xarid tarixini
 * ko'rsatish uchun bu yerda alohida, faqat o'sha bitta mijoz uchun
 * so'rov yuboriladi — bu, ro'yxat ochilganda barcha mijozlarning
 * barcha buyurtmalarini oldindan yuklab olishdan ancha arzon.
 */
export const getCustomerOrderHistory = (sellerId, clientId, onSuccess, onError) => {
  if (!sellerId || !clientId) throw new Error("Sotuvchi yoki mijoz ID'si ko'rsatilmadi!");

  const q = query(
    collection(db, 'orders'),
    where("sellerId", "==", sellerId),
    where("clientId", "==", clientId),
    orderBy("createdAt", "desc"),
    fbLimit(200)
  );

  return subscribeWithFastInitial(q, mapOrderDoc, onSuccess, onError);
};

/**
 * Kuryer Mini App'i uchun — shu kuryerga biriktirilgan buyurtmalar
 * ro'yxati. `firestore.rules`dagi qo'shimcha `courierId ==
 * request.auth.uid` o'qish shartiga tayanadi — kuryer sessiyasi
 * `couriers/{courierId}` uid'i bilan kirgan bo'lgani uchun bu so'rov
 * to'g'ridan-to'g'ri ishlaydi, alohida Cloud Function shart emas.
 */
export const getCourierOrderData = (courierId, onSuccess, onError) => {
  if (!courierId) throw new Error("Kuryer ID'si ko'rsatilmadi!");

  const q = query(
    collection(db, 'orders'),
    where("courierId", "==", courierId),
    orderBy("createdAt", "desc"),
    fbLimit(200)
  );

  return subscribeWithFastInitial(q, mapOrderDoc, onSuccess, onError);
};

/**
 * Mijozning kuzatuv sahifasi (`CourierTrackingPage.jsx`) uchun — bitta
 * buyurtmaning o'ziga to'g'ridan-to'g'ri (`onSnapshot(doc(...))`)
 * obuna bo'ladi. Yangi Firestore qoidasi talab qilinmaydi —
 * `firestore.rules`dagi `orders/{orderId}` o'qish qoidasi allaqachon
 * `request.auth.uid == resource.data.clientId` shartini o'z ichiga
 * oladi, shuning uchun mijoz faqat o'zining buyurtmasini o'qiy oladi —
 * boshqa birovning buyurtmasini ochishga urinish "permission-denied"
 * bilan rad etiladi.
 */
export const subscribeToOrderTracking = (orderId, onSuccess, onError) => {
  if (!orderId) throw new Error("Buyurtma ID'si ko'rsatilmadi!");

  return onSnapshot(
    doc(db, "orders", orderId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onSuccess(null);
        return;
      }
      onSuccess(mapOrderDoc(snapshot));
    },
    (error) => {
      console.error("Buyurtma kuzatuvini o'qishda xatolik:", error);
      onError?.(error);
    }
  );
};

export default getOrderData;
