const {
  PERMISSION_KEYS, STAFF_ROLE_KEYS, ROLE_PERMISSION_PRESETS,
  normalizeStaffPermissions, normalizeStaffRole, getRolePermissionPreset,
  sanitizeIncomingPermissionsForActor, canActorManageTargetStaff,
} = require("../lib/staffRoles");

/**
 * ADVANCED TEAM & RBAC (Z-Biznes, 2026-09 punkt-royxati, 2-band) —
 * sof rol/ruxsat mantig'i uchun testlar. Cloud Function darajasidagi
 * integratsiya (kim kimni tahrirlay oladi) `staff.test.js`da.
 */

describe("normalizeStaffPermissions", () => {
  test("barcha 6 ta kalitni qaytaradi, noto'g'ri/bo'sh qiymatlar false'ga tushadi", () => {
    expect(normalizeStaffPermissions({ manageProducts: true, manageOrders: "true", viewFinance: 1 })).toEqual({
      manageProducts: true, manageOrders: false, manageCouriers: false,
      manageCustomers: false, viewFinance: false, manageStaff: false,
    });
  });

  test("null/undefined — barchasi false", () => {
    const allFalse = {
      manageProducts: false, manageOrders: false, manageCouriers: false,
      manageCustomers: false, viewFinance: false, manageStaff: false,
    };
    expect(normalizeStaffPermissions(null)).toEqual(allFalse);
    expect(normalizeStaffPermissions(undefined)).toEqual(allFalse);
  });

  test("YANGI kalitlar (manageCustomers/viewFinance/manageStaff) to'g'ri normallashadi", () => {
    expect(normalizeStaffPermissions({ manageCustomers: true, viewFinance: true, manageStaff: true })).toEqual({
      manageProducts: false, manageOrders: false, manageCouriers: false,
      manageCustomers: true, viewFinance: true, manageStaff: true,
    });
  });
});

describe("normalizeStaffRole / getRolePermissionPreset", () => {
  test("8 ta tanilgan rolning barchasi qabul qilinadi", () => {
    expect(STAFF_ROLE_KEYS).toHaveLength(8);
    STAFF_ROLE_KEYS.forEach((role) => expect(normalizeStaffRole(role)).toBe(role));
  });

  test("noto'g'ri/bo'sh rol - null", () => {
    expect(normalizeStaffRole("owner")).toBeNull(); // Owner alohida tushuncha, rol sifatida saqlanmaydi
    expect(normalizeStaffRole("ceo")).toBeNull();
    expect(normalizeStaffRole(null)).toBeNull();
    expect(normalizeStaffRole(undefined)).toBeNull();
  });

  test("har bir rol preseti barcha 6 ta ruxsat kalitini o'z ichiga oladi", () => {
    STAFF_ROLE_KEYS.forEach((role) => {
      const preset = ROLE_PERMISSION_PRESETS[role];
      expect(Object.keys(normalizeStaffPermissions(preset)).sort()).toEqual([...PERMISSION_KEYS].sort());
    });
  });

  test("getRolePermissionPreset - noto'g'ri rol uchun null qaytaradi", () => {
    expect(getRolePermissionPreset("unknown")).toBeNull();
  });

  test("getRolePermissionPreset - nusxa qaytaradi (asl presetni o'zgartirmaydi)", () => {
    const preset = getRolePermissionPreset("operator");
    preset.manageOrders = false;
    expect(ROLE_PERMISSION_PRESETS.operator.manageOrders).toBe(true);
  });

  // Foydalanuvchining ANIQ so'ragan misoli: Marketing Manager mahsulot
  // ko'radi/boshqaradi + CRM ko'radi (manageCustomers), lekin moliya
  // (viewFinance) va xodim boshqaruvini (manageStaff) KO'RA OLMAYDI.
  test("marketing_manager - mahsulot+CRM bor, moliya/xodim boshqaruvi YO'Q", () => {
    expect(ROLE_PERMISSION_PRESETS.marketing_manager).toEqual({
      manageProducts: true, manageOrders: false, manageCouriers: false,
      manageCustomers: true, viewFinance: false, manageStaff: false,
    });
  });

  test("accountant - FAQAT moliyani ko'radi", () => {
    expect(ROLE_PERMISSION_PRESETS.accountant).toEqual({
      manageProducts: false, manageOrders: false, manageCouriers: false,
      manageCustomers: false, viewFinance: true, manageStaff: false,
    });
  });

  test("admin - hammasiga ega (manageStaff ham)", () => {
    Object.values(ROLE_PERMISSION_PRESETS.admin).forEach((v) => expect(v).toBe(true));
  });
});

describe("sanitizeIncomingPermissionsForActor - eskalatsiyaning oldini olish, 1-qatlam", () => {
  test("haqiqiy do'kon egasi (isStaffActor:false) - manageStaff'ni bera oladi", () => {
    expect(sanitizeIncomingPermissionsForActor({ manageStaff: true }, { isStaffActor: false }).manageStaff).toBe(true);
  });

  test("xodim-administrator (isStaffActor:true) - manageStaff so'ralsa ham, HAR DOIM false'ga tushadi", () => {
    const result = sanitizeIncomingPermissionsForActor({ manageStaff: true, manageOrders: true }, { isStaffActor: true });
    expect(result.manageStaff).toBe(false);
    expect(result.manageOrders).toBe(true); // boshqa ruxsatlar ta'sirlanmaydi
  });
});

describe("canActorManageTargetStaff - eskalatsiyaning oldini olish, 2-qatlam", () => {
  test("haqiqiy do'kon egasi - istalgan xodimni (manageStaff'ga ega bo'lsa ham) boshqara oladi", () => {
    expect(canActorManageTargetStaff({ isStaffActor: false, targetPermissions: { manageStaff: true } })).toBe(true);
  });

  test("xodim-administrator - manageStaff'ga EGA boshqa xodimni boshqara OLMAYDI (teng darajadagilar)", () => {
    expect(canActorManageTargetStaff({ isStaffActor: true, targetPermissions: { manageStaff: true } })).toBe(false);
  });

  test("xodim-administrator - manageStaff'siz oddiy xodimni ERKIN boshqara oladi", () => {
    expect(canActorManageTargetStaff({ isStaffActor: true, targetPermissions: { manageStaff: false } })).toBe(true);
    expect(canActorManageTargetStaff({ isStaffActor: true, targetPermissions: {} })).toBe(true);
    expect(canActorManageTargetStaff({ isStaffActor: true, targetPermissions: undefined })).toBe(true);
  });
});
