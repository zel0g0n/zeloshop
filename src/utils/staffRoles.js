/**
 * ADVANCED TEAM & RBAC (Z-Biznes, 2026-09 punkt-royxati, 2-band) —
 * FRONTEND nusxasi.
 *
 * MUHIM: `functions/lib/staffRoles.js` bilan ATAYLAB QAYTA YOZILGAN
 * (backend CommonJS, frontend ESM — ikkalasi bir xil modulni bevosita
 * bo'lisha olmaydi) — loyihada allaqachon o'rnatilgan "frontend+
 * backend duplikatsiyasi" naqshi (masalan `tariffLimits.js`,
 * `STAFF_BOT_USERNAME`). Ikkalasi o'zgarsa, IKKALASINI HAM birga
 * yangilash SHART. Bu fayl HAQIQIY xavfsizlik tekshiruvi EMAS
 * (haqiqiy tekshiruv — Cloud Functions + `firestore.rules`da) —
 * faqat UI'da rol tanlash/ruxsat belgilarini ko'rsatish uchun.
 *
 * Rol — FAQAT qulaylik uchun YORLIQ (tanlanganda ruxsatlarni
 * OLDINDAN to'ldirish + xodim kartochkasida belgi sifatida
 * ko'rsatish); HAQIQIY kirish nazorati doim aniq `permissions.*`
 * maydonlariga tayanadi (batafsil izoh: backend fayldagi bilan bir
 * xil — u yerda to'liq izoh berilgan).
 */

export const PERMISSION_KEYS = [
  "manageProducts",
  "manageOrders",
  "manageCouriers",
  "manageCustomers",
  "viewFinance",
  "manageStaff",
];

// 8 ta tayinlanadigan rol (Owner bundan mustasno — sotuvchining o'zi,
// `staff/{id}` hujjati umuman yo'q).
export const STAFF_ROLE_KEYS = [
  "admin",
  "manager",
  "sales_manager",
  "warehouse",
  "accountant",
  "courier_manager",
  "marketing_manager",
  "operator",
];

// `functions/lib/staffRoles.js`dagi `ROLE_PERMISSION_PRESETS` bilan
// AYNAN BIR XIL bo'lishi SHART.
export const ROLE_PERMISSION_PRESETS = {
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

export function normalizeStaffPermissions(permissions) {
  const p = permissions || {};
  const result = {};
  for (const key of PERMISSION_KEYS) {
    result[key] = p[key] === true;
  }
  return result;
}

export function normalizeStaffRole(role) {
  return STAFF_ROLE_KEYS.includes(role) ? role : null;
}

export function getRolePermissionPreset(role) {
  const normalized = normalizeStaffRole(role);
  return normalized ? { ...ROLE_PERMISSION_PRESETS[normalized] } : null;
}

/**
 * Berilgan ruxsatlar to'plami, aynan bitta rol presetiga mos
 * kelsa — o'sha rol nomini qaytaradi (kartochkada "moslashtirilgan"
 * emas, aniq rol belgisini ko'rsatish uchun). Mos kelmasa (sotuvchi
 * rolni tanlagandan keyin ruxsatlarni qo'lda o'zgartirgan bo'lsa) —
 * `null` (UI buni "Moslashtirilgan" deb ko'rsatadi).
 */
export function matchRoleFromPermissions(permissions) {
  const normalized = normalizeStaffPermissions(permissions);
  const match = STAFF_ROLE_KEYS.find((role) => {
    const preset = ROLE_PERMISSION_PRESETS[role];
    return PERMISSION_KEYS.every((key) => preset[key] === normalized[key]);
  });
  return match || null;
}
