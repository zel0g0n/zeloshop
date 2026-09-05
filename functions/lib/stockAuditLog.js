/**
 * ZAXIRA HARAKATI AUDIT JURNALI (Stock Movement Audit Log) — 2026-09,
 * "ombor nazorati" bo'limi ("haqiqiy muammoni yechishga qaratilgan"
 * qismi, foydalanuvchi bilan tasdiqlangan: to'liq ko'p-omborli
 * (multi-warehouse) tizim O'RNIGA, kichikroq va real muammoni yechadi).
 *
 * HAQIQIY MUAMMO: bir nechta xodim (masalan "ombor" roli,
 * `staffRoles.js`) bitta mahsulotning `stock` maydoniga tegishi
 * mumkin — na to'liq tahrirlash sahifasi (`EditProductPage.jsx`/
 * `StaffProductForm.jsx`), na ro'yxatdagi tezkor (inline) tahrirlash
 * (`ProductItem.jsx`) hech qachon "kim, qachon, nima uchun
 * o'zgartirdi" tarixini saqlamagan — faqat oxirgi qiymat qolardi.
 * Bu modul shu bo'shliqni yopadi: har bir HAQIQIY stock o'zgarishi
 * (qo'lda tahrirlash HAM, buyurtma orqali avtomatik kamayish HAM)
 * `sellers/{sellerId}/stockAuditLog`ga o'zgarmas yozuv sifatida
 * tushadi.
 *
 * ARXITEKTURA QARORI: mahsulotlar HALI HAM to'g'ridan-to'g'ri mijoz
 * (client) SDK'i orqali Firestore'ga yoziladi (Cloud Function orqali
 * emas — `services/products/addProduct.js`/`updateProductFull.js`/
 * `updateProduct.js`ga qarang), shuning uchun bu yerda YANGI callable
 * funksiya yaratib, BUTUN mahsulot tahrirlash oqimini qayta qurish
 * o'rniga (haddan tashqari murakkablik, "ortiqcha muhandislik"
 * bo'lardi) — mavjud `onProductWriteUpdateDiscountCounter` naqshiga
 * o'xshab, YANGI, mustaqil Firestore trigger
 * (`onProductWriteUpdateStockAudit`, `functions/products.js`)
 * qo'shildi. Trigger HAR DOIM `stock` maydonining HAQIQIY (server
 * tomonidagi, oldingi/keyingi hujjatdan hisoblangan) o'zgarishini
 * ko'radi — bu SONLAR (eski/yangi qoldiq, farq) HECH QACHON mijoz
 * tomonidan soxtalashtirilishi mumkin emas.
 *
 * "KIM"/"NIMA UCHUN" (`lastStockChangeReason`/`lastStockChangeByStaffId`/
 * `lastStockChangeByStaffName`/`lastStockChangeNote`) esa mijoz
 * tomonidan, mahsulot hujjatiga YOZISH paytida qo'shiladigan sof
 * MA'LUMOT maydonlari — xuddi buyurtmalardagi
 * `lastActionByStaffId`/`lastActionByStaffName` bilan BIR XIL,
 * loyihada allaqachon qabul qilingan naqsh (`functions/staff.js`,
 * `StaffOrderCard.jsx`, `firestore.rules`dagi izoh): bular hech qanday
 * QO'SHIMCHA huquq bermaydi — kim UMUMAN yozishi mumkinligini
 * `firestore.rules`dagi `staffPermission(sellerId, "manageProducts")`
 * ALLAQACHON nazorat qiladi, bu maydonlar faqat "shu (allaqachon
 * ruxsat berilgan) o'zgarishni KIM AMALGA OSHIRGANINI AYTDI" degan
 * ma'lumot. `firestore.rules` FAQAT `lastStockChangeReason`ning
 * ro'yxatdagi qiymatlardan biri ekanini talab qiladi (stock
 * o'zgarganda) — bu, jurnalning "sababsiz" yozuv bilan
 * to'lib-toshmasligini kafolatlaydi.
 */

const STOCK_AUDIT_COLLECTION = "stockAuditLog";

// Mijoz (sotuvchi/xodim) TANLASHI mumkin bo'lgan sabablar —
// `firestore.rules`dagi `stockChangeReasonOk()` bilan ATAYLAB QAYTA
// YOZILGAN (rules alohida tilda yozilgani uchun boshqa fayldan import
// qila olmaydi) — `TARIFF_LIMITS`/`STAFF_BOT_USERNAME` bilan bir xil,
// loyihada allaqachon o'rnatilgan "frontend+backend duplikatsiyasi"
// naqshi. Ikkalasi o'zgarsa, IKKALASINI HAM birga yangilash SHART.
//
// `order_sale` BU YERDA ATAYLAB YO'Q — buni FAQAT server
// (`functions/orders.js`, Admin SDK, `firestore.rules`dan mustasno)
// yoza oladi, mijoz hech qachon o'zi "bu avtomatik buyurtma edi" deb
// da'vo qila olmasligi kerak.
const CLIENT_STOCK_CHANGE_REASONS = [
  "restock",
  "manual_correction",
  "damaged_lost",
  "inventory_count",
  "other",
];

// Trigger tan oladigan/yozadigan BARCHA sabablar (yuqoridagilar +
// faqat serverga tegishli `order_sale`) — audit-yozuv validatsiyasi
// va frontend ko'rsatuvi (`i18n`) shu ro'yxatga tayanadi.
const ALL_STOCK_CHANGE_REASONS = [...CLIENT_STOCK_CHANGE_REASONS, "order_sale"];

function safeServerTimestamp(admin) {
  try {
    return admin.firestore.FieldValue.serverTimestamp();
  } catch {
    return null;
  }
}

/**
 * Sof funksiya — mahsulot hujjatining OLDINGI/KEYINGI holatidan
 * haqiqiy audit-yozuv ma'lumotini quradi. Trigger'dan ALOHIDA
 * (to'g'ridan-to'g'ri, Firestore'siz sinov qilinishi uchun).
 *
 * @param {object} params
 * @param {string} params.productId
 * @param {object|null} params.before - oldingi hujjat ma'lumoti (yo'q/
 *   o'chirilgan bo'lsa `null`)
 * @param {object|null} params.after - keyingi hujjat ma'lumoti (o'chirilgan
 *   bo'lsa `null`)
 * @returns {object|null} - `stock` HAQIQATAN o'zgarmagan bo'lsa (yoki
 *   mahsulot yangi yaratilgan/o'chirilgan bo'lsa — bular bu jurnalga
 *   ATAYLAB kirmaydi, izoh fayl boshida) `null`.
 */
function buildStockAuditEntryFromChange({ productId, before, after }) {
  // Yaratish (`before` yo'q) va o'chirish (`after` yo'q) — bu jurnal
  // FAQAT mavjud mahsulotning stock O'ZGARISHINI kuzatadi, boshlang'ich
  // qiymatni EMAS (izoh: fayl boshi, "haqiqiy muammo" — ko'p xodimli
  // TAHRIRLASH hisobdorligi, yaratish emas).
  if (!before || !after) return null;

  const oldStock = Number(before.stock) || 0;
  const newStock = Number(after.stock) || 0;
  if (oldStock === newStock) return null;

  const reasonRaw = after.lastStockChangeReason;
  const reason = ALL_STOCK_CHANGE_REASONS.includes(reasonRaw) ? reasonRaw : "unspecified";

  const staffId = after.lastStockChangeByStaffId || null;
  const staffName = after.lastStockChangeByStaffName || null;

  return {
    productId,
    productName: after.name || before.name || "Mahsulot",
    oldStock,
    newStock,
    deltaQty: newStock - oldStock,
    reason,
    note: typeof after.lastStockChangeNote === "string"
      ? (after.lastStockChangeNote.trim().slice(0, 500) || null)
      : null,
    // "KIM": xodim bo'lsa - uning ID/ismi; aks holda (va sabab
    // `order_sale` bo'lmasa) - do'kon egasining o'zi (mahsulot
    // hujjatidagi `sellerId`) hisoblanadi. `order_sale` uchun ikkalasi
    // ham `null` qoladi ("Tizim (buyurtma)" - frontendda shunday
    // ko'rsatiladi, `reason` maydoniga qarab).
    actorUid: staffId || (reason === "order_sale" ? null : (after.sellerId || null)),
    actorName: staffId ? staffName : null,
    orderRef: after.lastStockChangeOrderRef || null,
    orderNumber: after.lastStockChangeOrderNumber != null ? Number(after.lastStockChangeOrderNumber) : null,
  };
}

/**
 * `sellers/{sellerId}/stockAuditLog`ga bitta yozuv qo'shadi.
 * BEST-EFFORT: xato TASHLAMAYDI (`lib/aiAuditLog.js`dagi
 * `writeAuditLog` bilan BIR XIL tamoyil) — trigger allaqachon
 * MUVAFFAQIYATLI yozilgan mahsulot o'zgarishiga JAVOBAN ishga
 * tushadi, shuning uchun bu yerdagi xato asosiy (allaqachon sodir
 * bo'lgan) o'zgarishga HECH QANDAY ta'sir qilmasligi kerak — faqat
 * kuzatuv (audit) yozuvi.
 *
 * @param {object} db - Firestore instance (yoki mos mock)
 * @param {object} admin - `lib/admin.js`dan `admin` (FieldValue uchun)
 * @param {object} params - `{sellerId, ...buildStockAuditEntryFromChange natijasi}`
 */
async function writeStockAuditEntry(db, admin, { sellerId, ...entryData }) {
  try {
    await db.collection("sellers").doc(sellerId).collection(STOCK_AUDIT_COLLECTION).add({
      ...entryData,
      createdAt: safeServerTimestamp(admin),
      createdAtMs: Date.now(),
    });
  } catch (err) {
    // Ataylab jim - yuqoridagi izohga qarang.
    console.error("Zaxira audit jurnaliga yozib bo'lmadi (asosiy oqim davom etmoqda):", err);
  }
}

module.exports = {
  STOCK_AUDIT_COLLECTION,
  CLIENT_STOCK_CHANGE_REASONS,
  ALL_STOCK_CHANGE_REASONS,
  buildStockAuditEntryFromChange,
  writeStockAuditEntry,
};
