const crypto = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin, db } = require("./lib/admin");
const { checkRateLimit } = require("./lib/rateLimit");
const { buildSellerAppLink } = require("./lib/helpers");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");
const { formatDeliverySlotAbsolute } = require("./lib/deliverySlots");
const { getTariffLimits } = require("./lib/tariffs");
const { resolveActingSellerContext } = require("./lib/staffAccess");
const {
  normalizeStaffPermissions, normalizeStaffRole,
  sanitizeIncomingPermissionsForActor, canActorManageTargetStaff,
} = require("./lib/staffRoles");

/**
 * XODIMLAR (STAFF) tizimi.
 *
 * Sotuvchi cheklangan huquqli xodim hisoblari qo'sha oladi (soni
 * Z-Tariflarga qarab: Z-Start 0, Z-Pro 2, Z-Biznes 5 — batafsil izoh:
 * `lib/tariffs.js`), har biriga qaysi amallarni ruxsat berishni O'ZI
 * belgilaydi:
 *   - `permissions.manageProducts` — mahsulot qo'shish/tahrirlash/
 *     faolsizlantirish (`firestore.rules`dagi `products` yozish
 *     qoidasiga qo'shilgan `staffPermission(...)` sharti orqali).
 *   - `permissions.manageOrders` — buyurtmalarni ko'rish va holatini
 *     o'zgartirish (qabul qilish/tasdiqlash) — xuddi shu naqsh,
 *     `orders` o'qish/yozish qoidalariga qo'shilgan.
 *   - `permissions.manageCouriers` — kuryerlar ro'yxatini ko'rish VA
 *     buyurtmani kuryerga topshirish/kuzatuv havolasini qayta yuborish
 *     (2026-09 punkt-royxati, 3/10-bandlar: avval xodim uchun BUTUNLAY
 *     ishlamaydigan/mavjud bo'lmagan amal edi — endi
 *     `functions/lib/staffAccess.js` orqali `couriers.js`dagi
 *     `assignOrderToCourier`/`resendTrackingLink` funksiyalariga ham,
 *     `firestore.rules`dagi `couriers/{courierId}` o'qish qoidasiga
 *     ham qo'shilgan).
 *
 *   - `permissions.manageCustomers` — CRM: mijozlar ro'yxati/segmentlar
 *     ko'rish + broadcast xabar yuborish (2026-09 punkt-royxati,
 *     2-band "Advanced Team & RBAC": Marketing menejeri/Sotuv
 *     menejeri kabi rollar buni ishlatadi).
 *   - `permissions.viewFinance` — FAQAT O'QISH: daromad/tannarx/sof
 *     foyda/xarajatlar xulosasi (Buxgalter/Menejer/Admin rollari).
 *   - `permissions.manageStaff` — BOSHQA xodimlarni taklif qilish/
 *     ruxsatlarini o'zgartirish/faolsizlantirish/o'chirish — FAQAT
 *     Admin roli. QAT'IY IKKI XAVFSIZLIK QATLAMI bilan (batafsil
 *     izoh: `lib/staffRoles.js`): (1) xodim-administrator HECH KIMGA
 *     `manageStaff`ni BERA OLMAYDI (faqat haqiqiy do'kon egasi
 *     beradi), (2) xodim-administrator ALLAQACHON `manageStaff`ga
 *     ega BOSHQA xodimni tahrirlay/o'chira OLMAYDI ("teng
 *     darajadagilar bir-birini boshqara olmaydi"). Bularsiz, bitta
 *     buzilgan/nofidokor "Admin" hisob butun jamoani (hatto boshqa
 *     administratorlarni) repressiya qilishi mumkin bo'lardi.
 *
 * `role` maydoni — 8 ta nomlangan korporativ rol (Admin/Menejer/Sotuv
 * menejeri/Ombor/Buxgalter/Kuryer menejeri/Marketing menejeri/
 * Operator, batafsil izoh: `lib/staffRoles.js`) — FAQAT ko'rsatish/UI
 * qulayligi uchun YORLIQ (ruxsatlarni OLDINDAN to'ldirish), HAQIQIY
 * kirish nazorati doim aniq `permissions.*` maydonlariga tayanadi.
 *
 * ATAYLAB YO'Q: AI CEO uchun HECH QANDAY ruxsat maydoni — xodim AI
 * CEO'ning HECH BIR qismiga (kolleksiya ham, funksiya ham) kira
 * olmaydi, chunki `firestore.rules`dagi AI CEO'ga tegishli barcha
 * to'plamlar (`aiCeoPendingActions`, `aiCeoOutcomes`, `aiCeoLearning`,
 * `productDrafts`) va Cloud Function'lar (`functions/aiCeo.js`,
 * `aiCeoAgent.js`) FAQAT `sellerId == request.auth.uid` bo'yicha
 * ishlaydi — xodimning O'Z uid'i sotuvchining uid'i bilan HECH QACHON
 * teng bo'lmagani uchun, bu yerga HECH QANDAY qo'shimcha "ruxsat
 * berish" yo'li QASDDAN QO'SHILMAGAN (yo'qlik — o'zi kafolat).
 *
 * ARXITEKTURA: `functions/couriers.js`/`courierAuth.js`/`courierBot.js`
 * bilan AYNAN BIR XIL, allaqachon ishlab turgan naqsh — xodim
 * o'zining ALOHIDA Firebase Auth identifikatoriga (o'z Telegram
 * ID'siga) ega, hech qachon sotuvchining uid'idan foydalanmaydi.
 * Hujjat — TOP-LEVEL `staff/{staffTelegramId}` (kuryerlarga o'xshab,
 * SUBKOLLEKSIYA EMAS) — sabab: xodim boti `/start`da "bu Telegram
 * ID QAYSI sotuvchiga tegishli?" degan savolga, sellerId'ni OLDINDAN
 * bilmasdan turib javob topishi kerak (aynan couriers/{courierId}
 * bilan bir xil sabab).
 */

// `src/config/staffTelegram.js`dagi BOT_USERNAME bilan bir xil bo'lib
// qolishi SHART (loyihada allaqachon o'rnatilgan "frontend+backend
// duplikatsiyasi" naqshi — courierBot.js bilan bir xil).
//
// MUHIM: standart qiymat — VAQTINCHALIK PLACEHOLDER. Foydalanuvchi
// BotFather orqali haqiqiy "xodim boti"ni yaratgach, uning HAQIQIY
// username'ini QAYTA DEPLOY QILMASDAN sozlash mumkin bo'lishi uchun,
// `STAFF_BOT_USERNAME` muhit o'zgaruvchisi (Cloud Functions 2-avlod
// `.env.<loyiha-id>` fayli orqali) BOR bo'lsa, o'SHA ustun turadi —
// aks holda quyidagi standart (hali placeholder) qiymat ishlatiladi.
// Bu, 4-BOT EKOTIZIM AUDITI (P2-band)ning "placeholder kod deploy
// qilinmasdan yangilanadigan bo'lishi kerak" tuzatishi: endi ops-jamoa
// faqat `.env.<loyiha-id>` fayliga `STAFF_BOT_USERNAME=haqiqiy_bot_username`
// qatorini qo'shib, funksiyalarni qayta deploy qilishi kifoya — kodni
// (va shu faylni) qayta o'zgartirish SHART emas.
const STAFF_BOT_USERNAME = process.env.STAFF_BOT_USERNAME || "zeloshop_xodim_bot";

// Xodim soni endi QATTIQ BELGILANGAN son EMAS - Z-Tariflar (Z-Start/
// Z-Pro/Z-Biznes) tarifiga qarab farqlanadi (`lib/tariffs.js`dagi
// `maxStaff`: Start 0, Pro 2, Biznes 5). Bu, "sotuvchi qaysi tarifda
// nechta xodim qo'sha olishi kerak" degan 2026-09 tarif-tanlash
// bo'limidagi QAROR.

/**
 * Sof funksiya — taklif tokenidan xodim botiga ulanadigan havolani
 * yasaydi. `couriers.js`dagi `buildCourierInviteLink` bilan bir xil
 * naqsh — oddiy bot buyrug'i (`/start <token>`), Mini App emas.
 */
function buildStaffInviteLink(token) {
  return `https://t.me/${STAFF_BOT_USERNAME}?start=${token}`;
}

/**
 * Sof funksiya — yangi buyurtma haqida xodimga (bot orqali)
 * yuboriladigan xabar matni. `notifications.js`dagi
 * `onNewOrderNotifySeller` shu funksiyani sotuvchiga ketadigan
 * xabardan KEYIN, qo'shimcha ravishda ishlatadi.
 *
 * TALAB (2026-09 punkt-royxati, 4/6-band): xabar imkon qadar aniq va
 * faktli bo'lishi, tushunarsiz xom ID'lar KO'RSATILMASLIGI kerak —
 * shuning uchun `orderNumber` (masalan "№128"), mahsulotlar ro'yxati,
 * manzil va telefon ko'rsatiladi, ichki Firestore hujjat ID'si emas.
 */
function buildStaffNewOrderMessage(order) {
  const items = Array.isArray(order.orders) ? order.orders : [];
  const itemLines = items
    .slice(0, 8)
    .map((it) => `• ${it.name || "Mahsulot"} × ${it.quantity || 1}`)
    .join("\n");
  const moreCount = items.length > 8 ? items.length - 8 : 0;

  return [
    "🆕 *Yangi buyurtma!*",
    `🧾 Buyurtma №${order.orderNumber || "-"}`,
    "",
    `👤 Mijoz: ${order.customer?.fullName || "Noma'lum"}`,
    `📞 Tel: ${order.customer?.phone || "—"}`,
    order.customer?.address ? `📍 Manzil: ${order.customer.address}` : null,
    "",
    "🛒 Mahsulotlar:",
    itemLines || "—",
    moreCount > 0 ? `… va yana ${moreCount} ta mahsulot` : null,
    "",
    order.deliveryTimeSlot ? `⏰ Kelishilgan vaqt: ${formatDeliverySlotAbsolute({ startMs: order.deliveryTimeSlot.start, endMs: order.deliveryTimeSlot.end })}` : null,
    `💰 Jami: *${Number(order.totalAmount || 0).toLocaleString()} so'm*`,
    "",
    "👇 Buyurtmani ko'rish va qabul qilish uchun pastdagi tugmani bosing.",
  ].filter(Boolean).join("\n");
}

/**
 * Sof funksiya — yangi buyurtma xabari ostidagi tugma.
 *
 * OLDIN: "✅ Qabul qilish" (`callback_data: "stf:confirm:<orderId>"`)
 * bitta bosishli tez tasdiqlash tugmasi edi. Punkt-royxat (8-band)
 * bo'yicha bu, xodim ilovasini to'g'ridan-to'g'ri ochadigan
 * "🗂 Buyurtmalarni ochish" (`web_app`) tugmasiga ALMASHTIRILDI — xodim
 * botning o'zida emas, ilovaning "Buyurtmalar" bo'limida to'liq
 * ma'lumotni ko'rib, keyin qabul qiladi. `?tab=orders` — StaffHomePage
 * shu parametrni o'qib, to'g'ridan-to'g'ri Buyurtmalar bo'limini ochadi
 * (`src/features/staff/StaffHomePage.jsx`).
 */
function buildStaffOrderNotifyKeyboard() {
  return [[{ text: "🗂 Buyurtmalarni ochish", web_app: { url: buildSellerAppLink("/staff?tab=orders") } }]];
}

/**
 * Xodim (yoki xodim boti tugmasi) buyurtmani QABUL QILGANDA
 * (`status: "new" → "processing"`) bajariladigan asosiy mantiq — Mini
 * App'ning `confirmOrderAsStaff` onCall'i VA botning inline tugmasi
 * (`staffBot.js`) IKKALASI HAM shu funksiyani chaqiradi (kod
 * duplikatsiyasiga yo'l qo'ymaslik uchun, `applyCourierOrderAction`
 * bilan bir xil naqsh).
 *
 * MUHIM: bu FAQAT "new" → "processing" o'tishini qamrab oladi (bitta
 * bosishli tezkor tasdiqlash). Buyurtmaning keyingi bosqichlari
 * (yo'lga chiqarish/yetkazilgan deb belgilash/bekor qilish) xodim
 * tomonidan Mini App'ning O'ZIDA, ODDIY Firestore yozuvi orqali
 * amalga oshiriladi (`firestore.rules`dagi `staffPermission(...,
 * "manageOrders")` sharti — sotuvchining o'zi ishlatadigan
 * `changeOrderStatus` xizmati bilan AYNAN BIR XIL) — bu amallar UCHUN
 * alohida Cloud Function shart emas, chunki ular allaqachon
 * to'g'ridan-to'g'ri (Cloud Function'siz) client SDK orqali ishlaydi.
 */
async function applyStaffOrderAction({ staffId, orderId }) {
  if (!orderId) {
    throw new HttpsError("invalid-argument", "Buyurtma ID'si berilmagan.");
  }

  const staffSnap = await db.collection("staff").doc(String(staffId)).get();
  if (!staffSnap.exists) {
    throw new HttpsError("permission-denied", "Xodim hisobingiz topilmadi.");
  }
  const staff = staffSnap.data();
  if (staff.status !== "active") {
    throw new HttpsError("permission-denied", "Xodim hisobingiz hozir faol emas.");
  }
  if (staff.permissions?.manageOrders !== true) {
    throw new HttpsError("permission-denied", "Sizga buyurtmalarni boshqarish huquqi berilmagan.");
  }

  const orderRef = db.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    throw new HttpsError("not-found", "Buyurtma topilmadi.");
  }
  const order = orderSnap.data();
  if (String(order.sellerId) !== String(staff.sellerId)) {
    throw new HttpsError("permission-denied", "Bu buyurtma sizning do'koningizga tegishli emas.");
  }
  if (order.status !== "new") {
    throw new HttpsError("failed-precondition", "Bu buyurtma allaqachon qabul qilingan yoki boshqa bosqichda.");
  }

  // `lastActionByStaffId`/`lastActionByStaffName` — 2026-09 punkt-
  // ro'yxati, 11-band ("xodim/kuryer boshqaruv sahifalarida faoliyat
  // statistikasi kerak"). ILGARI order hujjatida xodimning bu
  // buyurtmaga tegishli AMALI HAQIDA HECH QANDAY IZ qolmasdi — sotuvchi
  // "bu xodim qancha buyurtma qayta ishladi?" degan savolga umuman
  // javob topa olmasdi. Bu ikki maydon `StaffManagementPage.jsx`da
  // (`computeStaffPerformance`, `src/utils/staffPerformanceStats.js`)
  // har bir xodim uchun ishlangan buyurtmalar sonini hisoblash uchun
  // ishlatiladi. `firestore.rules`dagi `orders/{orderId}` yangilash
  // qoidasiga ham shu ikki kalit qo'shildi (`hasOnly(...)`).
  await orderRef.update({
    status: "processing",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastActionByStaffId: String(staffId),
    lastActionByStaffName: staff.name || null,
  });

  // `orderNumber` — chaqiruvchiga (`staffBot.js`dagi inline tugma
  // callback'i) qaytariladi, u buni tasdiqlash xabarida (2026-09
  // punkt-royxati, 6-band) xom Firestore ID o'rniga ko'rsatadi.
  return { success: true, status: "processing", orderNumber: order.orderNumber || null };
}

/**
 * Sotuvchi — "Xodimlar" sahifasida "+ Xodim qo'shish" bosganda —
 * taklif hujjati yaratiladi va HAVOLA qaytariladi (`couriers.js`dagi
 * `handleCreateCourierInvite` bilan bir xil naqsh: bot O'ZI xabar
 * YUBORMAYDI, chunki xodimning Telegram ID'si hali NOMA'LUM).
 *
 * Sotuvchi ruxsatlarni (yoki tayyor rolni) SHU YERDA, taklif
 * yaratishning O'ZIDA belgilaydi — taklif qabul qilinganda
 * (`staffBot.js`) ular to'g'ridan-to'g'ri yangi `staff` hujjatiga
 * ko'chiriladi. Kerak bo'lsa, keyinroq `setStaffPermissions` orqali
 * o'zgartirilishi mumkin.
 *
 * 2026-09 punkt-royxati, 2-band ("Advanced Team & RBAC"): endi bu
 * funksiyani HAQIQIY do'kon egasi EMAS, balki `manageStaff`
 * ruxsatiga ega FAOL xodim ("Admin" roli) ham chaqira oladi —
 * `resolveActingSellerContext` orqali. Bu holatda
 * `sanitizeIncomingPermissionsForActor` yangi xodimga HECH QACHON
 * `manageStaff` berilishiga yo'l qo'ymaydi (faqat haqiqiy do'kon
 * egasi yangi administrator tayinlay oladi).
 */
async function handleCreateStaffInvite(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  await checkRateLimit(`createStaffInvite:${request.auth.uid}`, 20, 3600);
  const { sellerId, isStaff } = await resolveActingSellerContext(db, request.auth.uid, "manageStaff");

  const { name, phone, permissions, role } = request.data || {};
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    throw new HttpsError("invalid-argument", "Xodim ismini kiriting.");
  }

  const normalizedPermissions = sanitizeIncomingPermissionsForActor(permissions, { isStaffActor: isStaff });
  if (!Object.values(normalizedPermissions).some(Boolean)) {
    throw new HttpsError("invalid-argument", "Kamida bitta ruxsat tanlang.");
  }
  const normalizedRole = normalizeStaffRole(role);

  // MUHIM: limit TAKLIF yaratishda TEKSHIRILADI (tezkor UX xabari
  // uchun), va yana bir bor, ISHONCHLI ravishda, taklif QABUL
  // QILINGANDA (`staffBot.js`dagi `handleStaffStartCommand`) — chunki
  // bitta sotuvchi bir nechta taklif havolasini PARALEL yaratib,
  // hammasini birdan ishlatishi mumkin (poyga holati).
  const [existingSnap, sellerSnap] = await Promise.all([
    db.collection("staff").where("sellerId", "==", sellerId).get(),
    db.collection("sellers").doc(sellerId).get(),
  ]);
  const maxStaff = getTariffLimits(sellerSnap.exists ? sellerSnap.data() : {}).maxStaff;
  if (maxStaff === 0) {
    throw new HttpsError(
      "failed-precondition",
      "Xodim qo'shish Z-Pro va undan yuqori tarifda mavjud. \"Tariflar\" sahifasidan sinab ko'rishingiz mumkin."
    );
  }
  if (existingSnap.size >= maxStaff) {
    throw new HttpsError(
      "failed-precondition",
      `Siz maksimal ${maxStaff} tagacha xodim qo'sha olasiz. Yangi xodim qo'shish uchun avval birortasini o'chiring yoki yuqoriroq tarifga o'ting.`
    );
  }

  // Token boshiga `sellerId_` prefiksi qo'shiladi - `couriers.js`dagi
  // bilan bir xil g'oya: xodim botiga "/start <token>" bilan
  // kirilganda, qaysi sotuvchining `staffInvites` quyi kolleksiyasini
  // tekshirish kerakligini (qimmat `collectionGroup` so'rovisiz)
  // bilib olish mumkin.
  const token = `${sellerId}_${crypto.randomBytes(9).toString("hex")}`;
  await db.collection("sellers").doc(sellerId).collection("staffInvites").doc(token).set({
    name: trimmedName,
    phone: (phone || "").trim() || null,
    permissions: normalizedPermissions,
    role: normalizedRole,
    used: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { inviteLink: buildStaffInviteLink(token), token };
}

/**
 * Sotuvchi (yoki `manageStaff` ruxsatiga ega "Admin" xodim) xodimning
 * ruxsatlarini/rolini keyinroq o'zgartirishi uchun. Ikki xavfsizlik
 * qatlami (`lib/staffRoles.js`): xodim-administrator na o'ziga, na
 * boshqasiga `manageStaff` bera oladi, na ALLAQACHON `manageStaff`ga
 * ega BOSHQA xodimni tahrirlay oladi.
 */
async function handleSetStaffPermissions(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  // XAVFSIZLIK (2026-09 audit, P1): `couriers.js`dagi opa-uka
  // funksiyalar (`setCourierActive`/`removeCourier`) bilan bir xil
  // sabab — oldin bu yerda rate-limit yo'q edi.
  await checkRateLimit(`setStaffPermissions:${request.auth.uid}`, 30, 3600);
  const { staffId, permissions, role } = request.data || {};
  if (!staffId) {
    throw new HttpsError("invalid-argument", "Noto'g'ri so'rov.");
  }
  const staffRef = db.collection("staff").doc(String(staffId));
  const staffSnap = await staffRef.get();
  if (!staffSnap.exists) {
    throw new HttpsError("not-found", "Xodim topilmadi.");
  }
  const targetStaff = staffSnap.data();

  const { sellerId, isStaff } = await resolveActingSellerContext(db, request.auth.uid, "manageStaff");
  if (targetStaff.sellerId !== sellerId) {
    throw new HttpsError("permission-denied", "Bu xodim sizga tegishli emas.");
  }
  if (!canActorManageTargetStaff({ isStaffActor: isStaff, targetPermissions: targetStaff.permissions })) {
    throw new HttpsError("permission-denied", "Faqat do'kon egasi boshqa administratorning ruxsatlarini o'zgartira oladi.");
  }

  const normalizedPermissions = sanitizeIncomingPermissionsForActor(permissions, { isStaffActor: isStaff });
  const update = { permissions: normalizedPermissions };
  if (role !== undefined) {
    update.role = normalizeStaffRole(role);
  }
  await staffRef.update(update);
  return { success: true, permissions: normalizedPermissions, role: update.role ?? (targetStaff.role || null) };
}

/**
 * Sotuvchi (yoki `manageStaff` ruxsatiga ega "Admin" xodim) xodimni
 * faollashtiradi/vaqtincha to'xtatadi ("Hide without deleting" naqshi
 * — `handleSetCourierActive` bilan bir xil, lekin xodimning O'ZI
 * o'zini "band" qila olmaydi — bu ish vaqti/ruxsat masalasi, faqat
 * do'kon egasi yoki Admin xodim belgilashi kerak).
 */
async function handleSetStaffActive(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  await checkRateLimit(`setStaffActive:${request.auth.uid}`, 30, 3600);
  const { staffId, active } = request.data || {};
  if (!staffId || typeof active !== "boolean") {
    throw new HttpsError("invalid-argument", "Noto'g'ri so'rov.");
  }
  const staffRef = db.collection("staff").doc(String(staffId));
  const staffSnap = await staffRef.get();
  if (!staffSnap.exists) {
    throw new HttpsError("not-found", "Xodim topilmadi.");
  }
  const targetStaff = staffSnap.data();

  const { sellerId, isStaff } = await resolveActingSellerContext(db, request.auth.uid, "manageStaff");
  if (targetStaff.sellerId !== sellerId) {
    throw new HttpsError("permission-denied", "Bu xodim sizga tegishli emas.");
  }
  if (!canActorManageTargetStaff({ isStaffActor: isStaff, targetPermissions: targetStaff.permissions })) {
    throw new HttpsError("permission-denied", "Faqat do'kon egasi boshqa administratorning holatini o'zgartira oladi.");
  }
  await staffRef.update({ status: active ? "active" : "inactive" });
  return { success: true };
}

/**
 * Xodimni ro'yxatdan butunlay olib tashlaydi — do'kon egasi yoki
 * `manageStaff` ruxsatiga ega Admin xodim tomonidan (masalan ishdan
 * bo'shagan xodim), YOKI xodimning o'zi tomonidan ("xodimlikni
 * to'xtatish" — bu yo'l HAR DOIM, hech qanday cheklovsiz ochiq,
 * chunki har kim istalgan payt o'zi ketishi mumkin bo'lishi kerak).
 * O'chirilgan xodim darhol tarifga mos limitga qaytadan hisoblanadigan
 * bo'shliqni ozod qiladi.
 */
async function handleRemoveStaff(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  await checkRateLimit(`removeStaff:${request.auth.uid}`, 20, 3600);
  const { staffId } = request.data || {};
  if (!staffId) {
    throw new HttpsError("invalid-argument", "Noto'g'ri so'rov.");
  }
  const staffRef = db.collection("staff").doc(String(staffId));
  const staffSnap = await staffRef.get();
  if (!staffSnap.exists) {
    throw new HttpsError("not-found", "Xodim topilmadi.");
  }
  const targetStaff = staffSnap.data();
  const isSelf = String(staffId) === String(request.auth.uid);
  if (isSelf) {
    await staffRef.delete();
    return { success: true };
  }

  const { sellerId, isStaff } = await resolveActingSellerContext(db, request.auth.uid, "manageStaff");
  if (targetStaff.sellerId !== sellerId) {
    throw new HttpsError("permission-denied", "Bu xodim sizga tegishli emas.");
  }
  if (!canActorManageTargetStaff({ isStaffActor: isStaff, targetPermissions: targetStaff.permissions })) {
    throw new HttpsError("permission-denied", "Faqat do'kon egasi boshqa administratorni o'chira oladi.");
  }
  await staffRef.delete();
  return { success: true };
}

/**
 * Xodimning O'ZI, o'z ismi/telefonini tahrirlashi uchun (17-band,
 * 2026-09 punkt-royxati: xodim ilovasiga kuryernikiga o'xshash kichik
 * sozlamalar bo'limi kerak — `updateCourierProfile`
 * (`functions/couriers.js`) bilan AYNAN BIR XIL naqsh, faqat
 * `staff/{staffId}` hujjati ustida).
 */
async function handleUpdateStaffProfile(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  // XAVFSIZLIK (2026-09 audit, P1): `couriers.js`dagi bevosita o'xshash
  // `updateCourierProfile`da rate-limit BOR edi, bu yerda YO'Q edi —
  // izchillik uchun bir xil chegara qo'yildi.
  await checkRateLimit(`updateStaffProfile:${request.auth.uid}`, 20, 3600);
  const { name, phone } = request.data || {};
  if (!name?.trim()) {
    throw new HttpsError("invalid-argument", "Ism kiritilishi shart.");
  }
  const staffRef = db.collection("staff").doc(String(request.auth.uid));
  const staffSnap = await staffRef.get();
  if (!staffSnap.exists) {
    throw new HttpsError("not-found", "Xodim hisobingiz topilmadi.");
  }
  await staffRef.update({
    name: name.trim(),
    phone: phone?.trim() || null,
  });
  return { success: true };
}

/**
 * Mini App'dan (xodim "Qabul qilish" tugmasini bossa) yoki bot
 * inline tugmasidan chaqiriladi.
 */
async function handleConfirmOrderAsStaff(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  await checkRateLimit(`confirmOrderAsStaff:${request.auth.uid}`, 60, 3600);
  const { orderId } = request.data || {};
  return applyStaffOrderAction({ staffId: request.auth.uid, orderId });
}

exports.createStaffInvite = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleCreateStaffInvite));
exports.setStaffPermissions = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleSetStaffPermissions));
exports.setStaffActive = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleSetStaffActive));
exports.removeStaff = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleRemoveStaff));
exports.confirmOrderAsStaff = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleConfirmOrderAsStaff));
exports.updateStaffProfile = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleUpdateStaffProfile));

// `staffBot.js` (bot inline tugmasi) va `notifications.js` (yangi
// buyurtma xabari) ushbu sof funksiyalarni to'g'ridan-to'g'ri
// ishlatadi - kod duplikatsiyasiga yo'l qo'ymaslik uchun.
exports.applyStaffOrderAction = applyStaffOrderAction;
exports.buildStaffInviteLink = buildStaffInviteLink;
exports.buildStaffNewOrderMessage = buildStaffNewOrderMessage;
exports.buildStaffOrderNotifyKeyboard = buildStaffOrderNotifyKeyboard;
exports.normalizeStaffPermissions = normalizeStaffPermissions;
exports.STAFF_BOT_USERNAME = STAFF_BOT_USERNAME;

exports._testables = {
  normalizeStaffPermissions, buildStaffInviteLink, buildStaffNewOrderMessage, buildStaffOrderNotifyKeyboard,
  applyStaffOrderAction, handleCreateStaffInvite, handleSetStaffPermissions, handleSetStaffActive,
  handleRemoveStaff, handleConfirmOrderAsStaff, handleUpdateStaffProfile, STAFF_BOT_USERNAME,
};
