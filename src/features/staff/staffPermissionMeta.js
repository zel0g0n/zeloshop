import { Package, ClipboardList, Truck, Users, Wallet, ShieldCheck } from "lucide-react";

/**
 * RUXSAT/ROL UI META — ikkala "Xodimlar" boshqaruv sahifasi tomonidan
 * ISHLATILADI: sotuvchi tomoni (`StaffManagementPage.jsx`) VA xodim
 * tomoni (`StaffTeamSection.jsx`, `manageStaff` ruxsatiga ega "Admin"
 * xodim uchun) — ikkalasi ham bir xil 6 ta ruxsat/8 ta rolni bir xil
 * ikonka/nom bilan ko'rsatishi kerak, shuning uchun BIR JOYGA
 * chiqarilgan (2026-09 punkt-royxati, 2-band "Advanced Team & RBAC").
 *
 * Haqiqiy qiymatlar (`PERMISSION_KEYS`/`STAFF_ROLE_KEYS`/
 * `ROLE_PERMISSION_PRESETS`) — `src/utils/staffRoles.js`da (bu fayl
 * FAQAT ularning UI ko'rinishi: ikonka + i18n kalit nomi).
 */
export const PERMISSION_META = {
  manageProducts: { Icon: Package, titleKey: "permManageProductsTitle", descKey: "permManageProductsDesc", shortKey: "permManageProductsShort" },
  manageOrders: { Icon: ClipboardList, titleKey: "permManageOrdersTitle", descKey: "permManageOrdersDesc", shortKey: "permManageOrdersShort" },
  manageCouriers: { Icon: Truck, titleKey: "permManageCouriersTitle", descKey: "permManageCouriersDesc", shortKey: "permManageCouriersShort" },
  manageCustomers: { Icon: Users, titleKey: "permManageCustomersTitle", descKey: "permManageCustomersDesc", shortKey: "permManageCustomersShort" },
  viewFinance: { Icon: Wallet, titleKey: "permViewFinanceTitle", descKey: "permViewFinanceDesc", shortKey: "permViewFinanceShort" },
  manageStaff: { Icon: ShieldCheck, titleKey: "permManageStaffTitle", descKey: "permManageStaffDesc", shortKey: "permManageStaffShort" },
};

export const ROLE_META = {
  admin: { nameKey: "roleAdminName", descKey: "roleAdminDesc" },
  manager: { nameKey: "roleManagerName", descKey: "roleManagerDesc" },
  sales_manager: { nameKey: "roleSalesManagerName", descKey: "roleSalesManagerDesc" },
  warehouse: { nameKey: "roleWarehouseName", descKey: "roleWarehouseDesc" },
  accountant: { nameKey: "roleAccountantName", descKey: "roleAccountantDesc" },
  courier_manager: { nameKey: "roleCourierManagerName", descKey: "roleCourierManagerDesc" },
  marketing_manager: { nameKey: "roleMarketingManagerName", descKey: "roleMarketingManagerDesc" },
  operator: { nameKey: "roleOperatorName", descKey: "roleOperatorDesc" },
};
