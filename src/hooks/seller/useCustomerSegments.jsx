import { useMemo } from "react";
import { useSession } from "@/context/SessionContext";
import useGetOrdersData from "@/hooks/seller/useFilterOrders";

const VIP_THRESHOLD = 3_000_000; // so'm
const CHURN_DAYS = 30;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

/**
 * Mijozlar segmentatsiyasi — FAQAT haqiqiy buyurtma ma'lumotidan
 * (Firestore'dagi `orders`) hisoblanadi. Ism/telefon ham buyurtmaning
 * o'zidagi `customer` maydonidan olinadi — bu qo'shimcha so'rovlarni
 * (masalan `clients` kolleksiyasidan) talab qilmaydi.
 */
export const useCustomerSegments = () => {
  const { sellerId } = useSession();
  const { orders = [], loading, error } = useGetOrdersData(sellerId);

  const customers = useMemo(() => {
    const map = new Map();

    orders.forEach((order) => {
      const clientId = order.clientId;
      if (!clientId) return;

      const createdAtMs = Number(order.createdAt) || 0;
      const isDelivered = order.status === "delivered";
      const amount = isDelivered ? Number(order.totalAmount) || 0 : 0;

      const existing = map.get(clientId);
      if (existing) {
        existing.ltv += amount;
        existing.orderCount += 1;
        if (createdAtMs > existing.lastOrderAtMs) {
          existing.lastOrderAtMs = createdAtMs;
          // Eng so'nggi buyurtmadagi ism/telefonni ishlatamiz —
          // mijoz vaqt o'tishi bilan ma'lumotini yangilagan bo'lishi mumkin.
          existing.fullName = order.customer?.fullName || existing.fullName;
          existing.phone = order.customer?.phone || existing.phone;
        }
      } else {
        map.set(clientId, {
          clientId,
          fullName: order.customer?.fullName || "Noma'lum",
          phone: order.customer?.phone || "",
          ltv: amount,
          orderCount: 1,
          lastOrderAtMs: createdAtMs,
        });
      }
    });

    const now = Date.now();
    return Array.from(map.values()).map((c) => {
      const daysSinceLastOrder = Math.floor((now - c.lastOrderAtMs) / MS_IN_DAY);
      let segment = "regular";
      if (c.ltv >= VIP_THRESHOLD) segment = "vip";
      else if (daysSinceLastOrder > CHURN_DAYS) segment = "churn";
      return { ...c, daysSinceLastOrder, segment };
    }).sort((a, b) => b.ltv - a.ltv);
  }, [orders]);

  const counts = useMemo(() => ({
    all: customers.length,
    vip: customers.filter((c) => c.segment === "vip").length,
    churn: customers.filter((c) => c.segment === "churn").length,
    regular: customers.filter((c) => c.segment === "regular").length,
  }), [customers]);

  return { customers, counts, loading, error };
};
