/**
 * ADVANCED TEAM & RBAC (Z-Biznes, 2026-09 punkt-royxati, 2-band).
 *
 * OLDIN: xodimning ruxsatlari FAQAT 3 ta mustaqil belgi
 * (`manageProducts`/`manageOrders`/`manageCouriers`) edi, va ular
 * ATAYLAB oddiy/tor doirada qolishi kerak edi (sotuvchi "Xodimlar"
 * sahifasida qo'lda belgilardi). Endi Z-Biznes sotuvchisi haqiqiy
 * KORPORATIV rollarni ("Admin", "Menejer", "Sotuv menejeri",
 * "Ombor", "Buxgalter", "Kuryer menejeri", "Marketing menejeri",
 * "Operator") tayinlashi mumkin — har biri ma'noli, bir-biridan
 * FARQLI ruxsat to'plamiga ega (masalan Marketing menejeri CRM'ni
 * ko'radi, lekin moliyani ko'rmaydi; Buxgalter moliyani ko'radi,
 * lekin mahsulot/buyurtmalarga tegmaydi).
 *
 * MUHIM ARXITEKTURAVIY QAROR: rol — FAQAT qulaylik uchun (UI'da
 * tanlanganda ruxsatlarni OLDINDAN to'ldirish + xodim kartochkasida
 * belgi sifatida ko'rsatish) YORDAMCHI YORLIQ. HAQIQIY kirish
 * nazorati (backend + `firestore.rules`) doim ANIQ, konkret
 * `permissions.*` mantiqiy (true/false) maydonlariga tayanadi —
 * sotuvchi rolni tanlagandan KEYIN ham har bir ruxsatni alohida
 * o'zgartirishi (moslashtirishi) mumkin, va bu o'zgarish HECH QACHON
 * yo'qolmaydi (rol qayta "sinxronlanmaydi"). Bu, `firestore.rules`da
 * rol->ruxsat moslashtirish jadvalini takrorlash zaruriyatini
 * yo'q qiladi (bitta manba - saqlangan `permissions` obyekti) va
 * "sotuvchi ataylab kengaytirgan ruxsatni rol keyin qisqartirib
 * qo'yishi" kabi chalkash holatlarning oldini oladi.
 *
 * ATAYLAB HALI QO'SHILMAGAN: "Owner" rol sifatida SAQLANMAYDI — u
 * sotuvchining O'ZI (`staff/{id}` hujjati UMUMAN yo'q, to'g'ridan-
 * to'g'ri `sellers/{sellerId}`), shuning uchun cheklovsiz, ALOHIDA
 * tushuncha.
 */

// Ruxsat kalitlari — birinchi 3tasi (manageProducts/manageOrders/
// manageCouriers) OLDIN HAM mavjud edi, TORTIB OLINMAGAN (mavjud
// xodimlar/testlar buzilmaydi). Keyingi 3tasi YANGI:
//   - manageCustomers: CRM (mijozlar ro'yxati/segmentlar + broadcast
//     xabar yuborish) — Xodim Mini App'ida "Mijozlar" bo'limi.
//   - viewFinance: FAQAT O'QISH — daromad/tannarx/sof foyda/xarajatlar
//     xulosasi (P&L emas, uning YENGIL, tahrirlab bo'lmaydigan
//     ko'rinishi) — Xodim Mini App'ida "Moliya" bo'limi.
//   - manageStaff: boshqa xodimlarni taklif qilish/ruxsatlarini
//     o'zgartirish/faolsizlantirish/o'chirish — QAT'IY xavfsizlik
//     chegaralari bilan (pastga qarang: `sanitizeIncomingPermissionsForActor`/
//     `canActorManageTargetStaff`).
const PERMISSION_KEYS = [
  "manageProducts",
  "manageOrders",
  "manageCouriers",
  "manageCustomers",
  "viewFinance",
  "manageStaff",
];

// 8 ta tayinlanadigan rol (Owner bundan mustasno — sotuvchining o'zi).
const STAFF_ROLE_KEYS = [
  "admin",
  "manager",
  "sales_manager",
  "warehouse",
  "accountant",
  "courier_manager",
  "marketing_manager",
  "operator",
];

// Har bir rol uchun OLDINDAN belgilangan, ma'noli ruxsat to'plami.
// Foydalanuvchi (2026-09 so'rovi) misolidagi "Marketing Manager"
// ta'rifiga ANIQ mos: mahsulot ko'radi/boshqaradi, kampaniya
// yaratadi (manageCustomers -> broadcast), CRM ko'radi, lekin
// moliya/xodimlarni BOSHQARA OLMAYDI.
const ROLE_PERMISSION_PRESETS = {
  admin: {
    manageProducts: true, manageOrders: true, manageCouriers: true,
    manageCustomers: true, viewFinance: true, manageStaff: true,
  },
  manager: {
    manageProducts: true, manageOrders: true, manageCouriers: true,
    manageCustomers: true, viewFinance: true, manageStaff: false,
  },
  sales_manager: {
    manageProducts: false, manageOrders: true, manageCouriers: false,
    manageCustomers: true, viewFinance: false, manageStaff: false,
  },
  // "Ombor" — hali qurilmagan to'liq ko'p-ombor tizimi (10 bandlik
  // ro'yxat, 6-band) o'rniga, HALOL ravishda mavjud imkoniyatga
  // (mahsulot/zaxira miqdorini boshqarish) moslangan.
  warehouse: {
    manageProducts: true, manageOrders: false, manageCouriers: false,
    manageCustomers: false, viewFinance: false, manageStaff: false,
  },
  accountant: {
    manageProducts: false, manageOrders: false, manageCouriers: false,
    manageCustomers: false, viewFinance: true, manageStaff: false,
  },
  courier_manager: {
    manageProducts: false, manageOrders: true, manageCouriers: true,
    manageCustomers: false, viewFinance: false, manageStaff: false,
  },
  marketing_manager: {
    manageProducts: true, manageOrders: false, manageCouriers: false,
    manageCustomers: true, viewFinance: false, manageStaff: false,
  },
  operator: {
    manageProducts: false, manageOrders: true, manageCouriers: false,
    manageCustomers: false, viewFinance: false, manageStaff: false,
  },
};

/**
 * Sof funksiya — ruxsatlar obyektini ishonchli (faqat `true`/`false`)
 * shaklga keltiradi, endi 6 ta kalitning barchasi uchun.
 */
function normalizeStaffPermissions(permissions) {
  const p = permissions || {};
  const result = {};
  for (const key of PERMISSION_KEYS) {
    result[key] = p[key] === true;
  }
  return result;
}

/**
 * Noto'g'ri/bo'sh qiymatni `null`ga ("rol tanlanmagan/moslashtirilgan")
 * keltiradi — faqat 8 ta tanilgan rol qabul qilinadi.
 */
function normalizeStaffRole(role) {
  return STAFF_ROLE_KEYS.includes(role) ? role : null;
}

function getRolePermissionPreset(role) {
  const normalized = normalizeStaffRole(role);
  return normalized ? { ...ROLE_PERMISSION_PRESETS[normalized] } : null;
}

/**
 * XAVFSIZLIK QATLAMI 1/2 — "imtiyozni ko'tarish" (privilege escalation)
 * hujumining oldini oladi: `manageStaff` ruxsatiga ega XODIM (owner
 * EMAS) hech qachon, hech kimga (hatto o'ziga ham) `manageStaff`ni
 * BERA OLMAYDI — buni FAQAT haqiqiy do'kon egasi (`isStaffActor:
 * false`) qila oladi. Shu YAGONA qoidaning o'zi butun eskalatsiya
 * zanjirini yopadi: xodim-administrator hech qachon YANGI
 * administrator "yarata" olmaydi.
 */
function sanitizeIncomingPermissionsForActor(permissions, { isStaffActor }) {
  const normalized = normalizeStaffPermissions(permissions);
  if (isStaffActor) {
    normalized.manageStaff = false;
  }
  return normalized;
}

/**
 * XAVFSIZLIK QATLAMI 2/2 — "teng darajadagilar bir-birini boshqara
 * olmaydi": `manageStaff`ga ega xodim, ALLAQACHON `manageStaff`ga
 * ega BOSHQA xodimni (ruxsatlarini o'zgartirish/faolsizlantirish/
 * o'chirish) tahrirlay OLMAYDI — buni FAQAT haqiqiy do'kon egasi
 * qila oladi. (O'zini-o'zi ro'yxatdan chiqarish — "xodimlikni
 * to'xtatish" — bu tekshiruvdan MUSTASNO, alohida yo'l bilan
 * boshqariladi, chunki har bir xodim istalgan payt o'zi ketishi
 * mumkin bo'lishi kerak.)
 */
function canActorManageTargetStaff({ isStaffActor, targetPermissions }) {
  if (!isStaffActor) return true; // haqiqiy do'kon egasi — cheklovsiz
  return targetPermissions?.manageStaff !== true;
}

module.exports = {
  PERMISSION_KEYS,
  STAFF_ROLE_KEYS,
  ROLE_PERMISSION_PRESETS,
  normalizeStaffPermissions,
  normalizeStaffRole,
  getRolePermissionPreset,
  sanitizeIncomingPermissionsForActor,
  canActorManageTargetStaff,
};
