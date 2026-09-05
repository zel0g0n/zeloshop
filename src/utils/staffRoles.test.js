import { describe, test, expect } from "vitest";
import {
  PERMISSION_KEYS, STAFF_ROLE_KEYS, ROLE_PERMISSION_PRESETS,
  normalizeStaffPermissions, normalizeStaffRole, getRolePermissionPreset,
  matchRoleFromPermissions,
} from "./staffRoles";

/**
 * ADVANCED TEAM & RBAC (Z-Biznes, 2026-09 punkt-royxati, 2-band) —
 * frontend `staffRoles.js`ning `functions/lib/staffRoles.js` bilan
 * BIR XIL natija berishini tekshiradi (ikkalasi mustaqil fayllar,
 * qo'lda sinxronlashtiriladi).
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
});

describe("normalizeStaffRole / getRolePermissionPreset", () => {
  test("8 ta tanilgan rolning barchasi qabul qilinadi", () => {
    expect(STAFF_ROLE_KEYS).toHaveLength(8);
    STAFF_ROLE_KEYS.forEach((role) => expect(normalizeStaffRole(role)).toBe(role));
  });

  test("noto'g'ri/bo'sh rol - null (Owner alohida, rol sifatida saqlanmaydi)", () => {
    expect(normalizeStaffRole("owner")).toBeNull();
    expect(normalizeStaffRole("ceo")).toBeNull();
    expect(normalizeStaffRole(null)).toBeNull();
  });

  test("har bir rol preseti barcha 6 ta ruxsat kalitini o'z ichiga oladi", () => {
    STAFF_ROLE_KEYS.forEach((role) => {
      expect(Object.keys(ROLE_PERMISSION_PRESETS[role]).sort()).toEqual([...PERMISSION_KEYS].sort());
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
  // ko'radi/boshqaradi + CRM ko'radi, lekin moliya/xodim boshqaruvi
  // YO'Q.
  test("marketing_manager - mahsulot+CRM bor, moliya/xodim boshqaruvi YO'Q", () => {
    expect(ROLE_PERMISSION_PRESETS.marketing_manager).toEqual({
      manageProducts: true, manageOrders: false, manageCouriers: false,
      manageCustomers: true, viewFinance: false, manageStaff: false,
    });
  });
});

describe("matchRoleFromPermissions — kartochkada rol belgisini ko'rsatish uchun", () => {
  test("aniq rol presetiga mos ruxsatlar — o'sha rol nomini qaytaradi", () => {
    expect(matchRoleFromPermissions(ROLE_PERMISSION_PRESETS.accountant)).toBe("accountant");
    expect(matchRoleFromPermissions(ROLE_PERMISSION_PRESETS.marketing_manager)).toBe("marketing_manager");
  });

  test("hech qanday presetga mos kelmasa (qo'lda moslashtirilgan) - null", () => {
    expect(matchRoleFromPermissions({ manageProducts: true, manageStaff: true })).toBeNull();
  });

  test("bo'sh/hech qanday ruxsat yo'q - null (hech qaysi preset bo'sh emas)", () => {
    expect(matchRoleFromPermissions({})).toBeNull();
  });
});
