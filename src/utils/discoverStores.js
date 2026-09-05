// Ommaviy "Do'konlarni kashf eting" sahifasi uchun sof (pure)
// yordamchi funksiyalar.

/**
 * Firestore'dan `showcaseOptIn===true` bo'yicha o'qilgan do'konlar
 * ro'yxatini, ko'rsatishga yaroqli bo'lganlar bilan cheklaydi.
 *
 * MUHIM: `showcaseOptIn===true` filtri Firestore SO'ROVINING o'zida
 * (bitta tenglik sharti - qo'shimcha kompozit indeks talab qilmaydi)
 * amalga oshiriladi; bu yerdagi filtr esa QO'SHIMCHA, faqat mijoz
 * tomonida - masalan sotuvchi vaqtincha to'xtatilgan (`status ===
 * "suspended"`) bo'lsa, u YOQILGAN bo'lsa ham ro'yxatda ko'rinmasligi
 * kerak (bu holat kamdan-kam, alohida Firestore so'rov sharti sifatida
 * qo'shish shart emas).
 */
export function filterVisibleStores(stores) {
  if (!Array.isArray(stores)) return [];
  return stores.filter((store) => store && store.status !== "suspended" && Boolean(store.storeName));
}

/**
 * Do'kon kartochkasida ko'rsatiladigan qisqa manzil yorlig'ini
 * quradi - masalan "Kosmetika · Toshkent". Ikkala qism ham ixtiyoriy
 * (ba'zi eski do'konlarda hali to'ldirilmagan bo'lishi mumkin).
 */
export function buildStoreSubtitle(store) {
  const parts = [store?.category, store?.region].filter(Boolean);
  return parts.join(" · ");
}
