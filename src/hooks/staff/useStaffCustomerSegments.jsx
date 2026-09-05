import { useMemo } from "react";
import useCrmOrders from "@/hooks/seller/useCrmOrders";
import { computeCustomerSegments } from "@/utils/customerSegments";

/**
 * `src/hooks/seller/useCustomerSegments.jsx`ning Xodim Mini App
 * versiyasi (2026-09 punkt-royxati, 2-band "Advanced Team & RBAC") —
 * FARQI: `sellerId`ni `useSession()` (sotuvchi konteksti)dan emas,
 * to'g'ridan-to'g'ri parametr sifatida oladi, chunki Xodim Mini
 * App'i BUTUNLAY ALOHIDA, MUSTAQIL sessiya daraxtida ishlaydi
 * (`StaffSessionContext.jsx`) — `useSession()` u yerda UMUMAN
 * mavjud emas. Ma'lumot manbasi (`sellers/{id}/customers` yig'ma
 * kolleksiyasi) va hisoblash mantig'i (`computeCustomerSegments`)
 * sotuvchi versiyasi bilan AYNAN BIR XIL — `firestore.rules`dagi
 * `staffPermission(sellerId, "manageCustomers")` o'qish qoidasi
 * shu so'rovni ruxsat beradi.
 */
export const useStaffCustomerSegments = (sellerId) => {
  const { customers: rawCustomers = [], loading, error, isApproximate } = useCrmOrders(sellerId);

  const { customers, counts, averageLtv, retentionRate } = useMemo(
    () => computeCustomerSegments(rawCustomers),
    [rawCustomers]
  );

  return { customers, counts, averageLtv, retentionRate, loading, error, isApproximate };
};

export default useStaffCustomerSegments;
