/**
 * Buyurtmalarni status va qidiruv so'rovi bo'yicha filtrlaydi. Sof
 * funksiya — React'ga bog'liq emas, to'g'ridan-to'g'ri sinov (test)
 * faylida tekshiriladi.
 */
export function filterOrders(orders, { activeTab, searchQuery = "" }) {
  const query = searchQuery.trim().toLowerCase();
  return orders.filter((order) => {
    // `hiddenAt` — foydalanuvchi "Yetkazildi"/"Bekor qilindi" tarixidan
    // "O'chirish" tugmasi bilan yashirgan buyurtmalarni belgilaydi. Bu
    // faqat ro'yxatdan yashirish — pastdagi `computeDeliveredRevenue`/
    // `computeActiveOrdersCount` bu maydonni tekshirmaydi, shuning
    // uchun hisob-kitoblar buyurtma yashirilgandan keyin ham o'zgarmaydi.
    if (order.hiddenAt) return false;
    const matchesTab = order.status === activeTab;
    if (!query) return matchesTab;
    const idMatch = String(order.id || "").toLowerCase().includes(query);
    const nameMatch = (order.customer?.fullName || "").toLowerCase().includes(query);
    const phoneMatch = (order.customer?.phone || "").toLowerCase().includes(query);
    return matchesTab && (idMatch || nameMatch || phoneMatch);
  });
}

/**
 * Har bir buyurtmaga tushunarli tartib raqamini beradi (#1, #2, ...)
 * — Firestore hujjat ID'si o'rniga.
 *
 * `orders.js`dagi doimiy hisoblagichdan kelgan `order.orderNumber`
 * ustunlik qiladi (mavjud bo'lsa); bu maydonga ega bo'lmagan eski
 * buyurtmalar uchun massiv ichidagi o'ringa asoslangan usul zaxira
 * sifatida ishlatiladi. Faqat yuklangan `orders` massivi ichidagi
 * o'ringa tayanish, yuklash chegarasidan (`useFilterOrders.jsx`)
 * oshgan do'konlarda haqiqiy tartib raqamini bermaydi (masalan, 200-
 * buyurtma "#50" bo'lib ko'rinishi mumkin, chunki faqat so'nggi 150
 * tasi yuklangan) — shuning uchun `orderNumber` maydoni ustuvor.
 */
export function computeOrderNumbers(orders) {
  const sorted = [...orders].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const map = new Map();
  sorted.forEach((o, index) => map.set(o.id, o.orderNumber ?? (index + 1)));
  return map;
}

/** Yetkazilgan buyurtmalarning umumiy summasini hisoblaydi. */
export function computeDeliveredRevenue(orders) {
  return orders
    .filter((o) => o.status === "delivered")
    .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
}

/** Hali yakunlanmagan (yetkazilmagan va bekor qilinmagan) buyurtmalar sonini hisoblaydi. */
export function computeActiveOrdersCount(orders) {
  return orders.filter((o) => !["delivered", "cancel"].includes(o.status)).length;
}

/**
 * Mijoz kabinetidagi "faol buyurtma" banneri (`ActiveOrder.jsx`) uchun
 * — hali yakunlanmagan buyurtmalar orasidan ENG SO'NGGISINI qaytaradi.
 *
 * `getClientOrderData` (`services/orders/getClientOrder.js`) natijasi
 * ALLAQACHON `createdAt desc` bo'yicha saralangan holda keladi, shuning
 * uchun bu yerda qayta saralash SHART EMAS — shunchaki ro'yxatdagi
 * BIRINCHI mos kelgan elementni topish yetarli (u eng yangisi bo'ladi).
 * `hiddenAt` bilan yashirilgan buyurtmalar (`CAN_HIDE_STATUSES`)
 * hisobga olinmaydi — foydalanuvchi ularni allaqachon "tarixdan
 * o'chirgan".
 */
export function findLatestActiveOrder(orders) {
  return orders.find((o) => !o.hiddenAt && !["delivered", "cancel"].includes(o.status)) || null;
}
