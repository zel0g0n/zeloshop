import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * Sotuvchi tomonidan xodimlarni boshqarish — "Xodimlar" sahifasi
 * (`StaffManagementPage.jsx`) shu wrapper funksiyalarni ishlatadi.
 * `courierManagement.js` bilan bir xil naqsh.
 */

// `role` — 2026-09 punkt-royxati, 2-band ("Advanced Team & RBAC"):
// ixtiyoriy, 8 ta korporativ roldan biri (yoki `null` — "Moslashtirilgan").
// FAQAT UI qulayligi uchun yorliq — backend HAQIQIY kirish nazoratini
// doim `permissions`ning O'ZIGA tayanib amalga oshiradi.
export const createStaffInvite = async (name, phone, permissions, role = null) => {
  const fn = httpsCallable(functions, "createStaffInvite");
  const { data } = await fn({ name, phone, permissions, role });
  return data; // { inviteLink, token }
};

export const setStaffPermissions = async (staffId, permissions, role) => {
  const fn = httpsCallable(functions, "setStaffPermissions");
  const payload = { staffId, permissions };
  if (role !== undefined) payload.role = role;
  const { data } = await fn(payload);
  return data;
};

export const setStaffActive = async (staffId, active) => {
  const fn = httpsCallable(functions, "setStaffActive");
  const { data } = await fn({ staffId, active });
  return data;
};

export const removeStaff = async (staffId) => {
  const fn = httpsCallable(functions, "removeStaff");
  const { data } = await fn({ staffId });
  return data;
};

/**
 * Xodimning O'ZI, o'z ismi/telefonini tahrirlashi uchun
 * (`StaffProfileModal.jsx`) - `updateCourierProfile.js` bilan bir xil
 * naqsh.
 */
export const updateStaffProfile = async (name, phone) => {
  const fn = httpsCallable(functions, "updateStaffProfile");
  const { data } = await fn({ name, phone });
  return data;
};
