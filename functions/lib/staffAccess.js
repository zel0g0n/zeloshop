const { HttpsError } = require("firebase-functions/v2/https");

/**
 * "Sotuvchi YOKI ruxsatli xodim" - UMUMIY yordamchi.
 *
 * Ko'p Cloud Function'lar (`assignOrderToCourier`, `resendTrackingLink`
 * va h.k.) ilgari FAQAT sotuvchining o'zi (`request.auth.uid ===
 * sellerId`) chaqira oladi deb yozilgan edi. Endi (2026-09 punkt-royxati,
 * 3/9/10-bandlar: xodim ruxsatlarini kengaytirish + xodim ilovasida
 * ISHLAYDIGAN kuryer dispetcherligi) xodim ham, agar unga tegishli
 * ruxsat berilgan bo'lsa, XUDDI SOTUVCHI kabi shu amallarni bajara
 * olishi kerak.
 *
 * `actorUid` — chaqiruvchi ("request.auth.uid") — sotuvchining O'ZI
 * yoki xodim bo'lishi mumkin (ikkalasi ham bir xil `staff/{staffId}`
 * ID naqshiga amal qilmaydi - sotuvchi hech qachon `staff/{sellerId}`
 * hujjatiga ega bo'lmaydi, xuddi kuryer/xodim arxitekturasi bilan bir
 * xil izolyatsiya kafolati).
 *
 * Qaytaradi: `{ sellerId, isStaff }` — `sellerId` har doim HAQIQIY
 * do'kon egasining uid'i (xodim bo'lsa ham) - chaqiruvchi funksiya
 * shu `sellerId` bo'yicha barcha keyingi egalik tekshiruvlarini
 * (`order.sellerId === sellerId`, `courier.sellerId === sellerId`)
 * o'zgarishsiz davom ettira oladi.
 */
async function resolveActingSellerContext(db, actorUid, requiredPermission) {
  const staffSnap = await db.collection("staff").doc(String(actorUid)).get();
  if (staffSnap.exists) {
    const staff = staffSnap.data();
    if (staff.status === "active" && staff.permissions?.[requiredPermission] === true) {
      return { sellerId: staff.sellerId, isStaff: true };
    }
    throw new HttpsError("permission-denied", "Bu amal uchun ruxsatingiz yo'q.");
  }
  // `staff/{actorUid}` hujjati yo'q - demak chaqiruvchi sotuvchining
  // O'ZI (xodim va sotuvchi identifikatorlari HECH QACHON kesishmaydi).
  return { sellerId: actorUid, isStaff: false };
}

module.exports = { resolveActingSellerContext };
