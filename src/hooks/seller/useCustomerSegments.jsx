import { useMemo } from "react";
import { useSession } from "@/context/SessionContext";
import useCrmOrders from "@/hooks/seller/useCrmOrders";
import { computeCustomerSegments } from "@/utils/customerSegments";

/**
 * Mijozlar segmentatsiyasi — server tomonida OLDINDAN yig'ilgan
 * mijoz yozuvlaridan (`useCrmOrders`, ICHKI mazmuni endi
 * `sellers/{id}/customers` yig'ma kolleksiyasini o'qiydi - batafsil
 * izoh: `functions/orderRollups.js`) hisoblanadi - BUTUN tarix
 * bo'yicha (365 kunlik chegara ENDI YO'Q), Dashboard'dan mustaqil,
 * uni sekinlashtirmaydi. Hisob-kitobning o'zi sof funksiyaga
 * (`utils/customerSegments.js`) ajratilgan — sinov (test) qilish va
 * React'dan mustaqil ishlatish uchun.
 *
 * 2026-09 audit: 5000tadan ortiq mijozli sotuvchida (`useCrmOrders`
 * ichidagi xavfsizlik chegarasi) bu segmentatsiya ENG QIYMATLI 5000
 * mijoz asosida (TAXMINIY) hisoblanadi — bunday holatda `isApproximate:
 * true` qaytadi, UI buni ko'rsatishi kerak (`CrmHub.jsx`ga qarang).
 */
export const useCustomerSegments = () => {
  const { sellerId } = useSession();
  const { customers: rawCustomers = [], loading, error, isApproximate } = useCrmOrders(sellerId);

  const { customers, counts, averageLtv, retentionRate } = useMemo(
    () => computeCustomerSegments(rawCustomers),
    [rawCustomers]
  );

  return { customers, counts, averageLtv, retentionRate, loading, error, isApproximate };
};
