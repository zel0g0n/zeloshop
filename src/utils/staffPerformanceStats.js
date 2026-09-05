/**
 * Xodim boshqaruv sahifasi (`StaffManagementPage.jsx`) uchun — har bir
 * xodimning ish faoliyati statistikasi. Sof funksiya — sotuvchining
 * TO'LIQ buyurtmalar ro'yxatidan (`getOrderData`) `lastActionByStaffId`
 * maydoni bo'yicha hisoblanadi.
 *
 * MUHIM (2026-09 punkt-royxati, 11-band auditi natijasi): `orders`
 * hujjatlarida ILGARI xodimning amali haqida HECH QANDAY IZ
 * qolmasdi — `applyStaffOrderAction` (Cloud Function, "bitta bosish
 * bilan qabul qilish") va xodim Mini App'ining o'zi (`StaffOrderCard.
 * jsx`, keyingi bosqichlar) ENDI `lastActionByStaffId`/
 * `lastActionByStaffName` maydonlarini yozadi — lekin bu FAQAT
 * ENDIGI (yozilgan) o'zgarishlar uchun ishlaydi: bu o'zgarishdan
 * OLDIN yaratilgan buyurtmalar hech qachon bu maydonga ega
 * bo'LMAYDI, shuning uchun statistika vaqt o'tishi bilan to'liqroq
 * bo'lib boradi, lekin ORTGA qarab (tarixiy) TO'LIQ EMAS.
 *
 * Kuryerdan farqli o'laroq (`courierPerformanceStats.js`), bu yerda
 * FAQAT "nechta buyurtma ustida ishladi" ma'nosidagi son beriladi -
 * xodimning ANIQ QAYSI bosqichni bajarganini (masalan faqat
 * "qabul qilish"mi yoki "yo'lga chiqarish"gacha ham) alohida
 * ajratib bo'lmaydi, chunki `lastActionByStaffId` ustiga har safar
 * QAYTA YOZILADI (faqat buyurtmaning ENG SO'NGGI holatidagi amalni
 * bildiradi).
 *
 * `revenue` (BIZNES BUYRUQ MARKAZI, 2026-09, 3-band "eng yaxshi
 * xodimlar" ko'rsatkichi uchun qo'shildi): FAQAT xodim OXIRGI marta
 * amal bajargan VA "delivered" holatidagi buyurtmalarning
 * `totalAmount` yig'indisi - bekor qilingan/kutilayotgan
 * buyurtmalar daromadga QO'SHILMAYDI (haqiqiy tushum emas).
 */
export function computeStaffPerformance(orders, staffId) {
  const handled = (orders || []).filter((o) => o.lastActionByStaffId === staffId);
  const delivered = handled.filter((o) => o.status === "delivered");
  return {
    handledCount: handled.length,
    deliveredCount: delivered.length,
    cancelledCount: handled.filter((o) => o.status === "cancel").length,
    revenue: delivered.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0),
  };
}
