/**
 * Kuryer boshqaruv sahifasi (`CourierManagementPage.jsx`) uchun — har
 * bir kuryerning ish faoliyati statistikasi. Sof funksiya — sotuvchining
 * TO'LIQ buyurtmalar ro'yxatidan (`getOrderData`, allaqachon boshqa
 * sahifalarda ishlatiladigan bir xil manba) REAL VAQTDA qayta
 * hisoblanadi. Alohida Firestore hisoblagich (counter) — masalan
 * `couriers/{id}.deliveriesCompleted` — ATAYLAB QO'SHILMADI: bunday
 * hisoblagichni har bir status o'zgarishida (`functions/couriers.js`)
 * alohida oshirib borish kerak bo'lardi va vaqt o'tishi bilan haqiqiy
 * `orders` ma'lumotidan chetlashib qolish xavfi bor edi.
 *
 * MUHIM CHEKLOV (2026-09 punkt-royxati, 11-band auditi natijasi):
 * - Kuryer buyurtmani RAD ETGANDA (`declined`), `courierId` VA
 *   `courierDeliveryStatus` order hujjatidan BUTUNLAY o'chirib
 *   tashlanadi (`functions/couriers.js`dagi `applyCourierOrderAction`),
 *   shuning uchun "rad etilgan buyurtmalar soni" bu yerdan HISOBLAB
 *   BO'LMAYDI - bunday buyurtmalar hozirgi kuryer bilan UMUMAN
 *   bog'lanmagan holda qoladi.
 * - "O'rtacha yetkazish vaqti" ham hisoblab bo'lmaydi - har bir bosqich
 *   o'tishida (biriktirilgan → olib ketilgan → yetkazilgan) bitta
 *   umumiy `updatedAt` maydoni QAYTA YOZILADI, alohida
 *   `pickedUpAt`/`deliveredAt` vaqt belgilari saqlanmaydi.
 */
export function computeCourierPerformance(orders, courierId) {
  const assigned = (orders || []).filter((o) => o.courierId === courierId);
  return {
    deliveredCount: assigned.filter((o) => o.courierDeliveryStatus === "delivered").length,
    activeCount: assigned.filter((o) => o.courierDeliveryStatus === "picked_up").length,
    pendingCount: assigned.filter((o) => o.courierDeliveryStatus === "assigned").length,
    failedCount: assigned.filter((o) => o.courierDeliveryStatus === "failed").length,
  };
}
