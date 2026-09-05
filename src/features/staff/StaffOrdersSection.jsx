import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useStaffSession } from "@/context/StaffSessionContext";
import getOrderData from "@/services/orders/getOrderData";
import { getCourierList } from "@/services/couriers/getCourierList";
import { ORDER_STATUS_TABS, getOrderStatusInfo } from "@/constants/orderStatus";
import StaffOrderCard from "./StaffOrderCard";

/**
 * Xodim Mini App'i — "Buyurtmalar" bo'limi. Faqat `permissions.
 * manageOrders` ruxsatiga ega xodimga ko'rsatiladi (qarang:
 * `StaffHomePage.jsx`). Ro'yxat `getOrderData(sellerId, ...)` orqali —
 * sotuvchining O'ZI ko'radigan buyurtmalar bilan BIR XIL manbadan
 * o'qiladi (`firestore.rules`dagi `staffPermission(sellerId,
 * "manageOrders")` o'qish/yozish qoidasi bilan himoyalangan).
 *
 * KURYERLAR RO'YXATI (2026-09, 3/10-bandlar): faqat `permissions.
 * manageCouriers`ga ega xodim uchun obuna bo'ladi (`firestore.rules`dagi
 * `couriers/{courierId}`ning yangi `staffPermission(sellerId,
 * "manageCouriers")` o'qish shartiga tayanadi) - "Kuryerga topshirish"
 * oynasi (`StaffOrderCard.jsx`) uchun kerak.
 */
const StaffOrdersSection = () => {
  const { t } = useLanguage();
  const { sellerId, staffId, staffName, permissions } = useStaffSession();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("new");
  const [couriers, setCouriers] = useState([]);
  const canManageCouriers = permissions?.manageCouriers === true;

  useEffect(() => {
    if (!sellerId) return undefined;
    const unsubscribe = getOrderData(
      sellerId,
      (data) => { setOrders(data); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsubscribe?.();
  }, [sellerId]);

  useEffect(() => {
    // `manageCouriers` ruxsati yo'q bo'lsa - obuna bo'lmaymiz (eski
    // ro'yxat state'da qolsa ham, `canManageCouriers === false` bo'lgani
    // uchun kuryer tanlash oynasi UMUMAN ochilmaydi - ko'rinadigan
    // ta'siri yo'q, shuning uchun bu yerda qo'shimcha "tozalash"
    // shart emas, `StaffProductsSection.jsx`dagi bilan bir xil oddiy
    // qo'riqlovchi naqsh).
    if (!sellerId || !canManageCouriers) return undefined;
    const unsubscribe = getCourierList(sellerId, setCouriers, () => setCouriers([]));
    return () => unsubscribe?.();
  }, [sellerId, canManageCouriers]);

  const tabCounts = useMemo(() => {
    const counts = {};
    ORDER_STATUS_TABS.forEach((status) => {
      counts[status] = orders.filter((o) => o.status === status).length;
    });
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(
    () => orders.filter((o) => (o.status || "new") === activeTab),
    [orders, activeTab]
  );

  return (
    <div>
      <div className="sticky top-[68px] z-20 bg-gray-50 dark:bg-slate-950 px-4 pt-2 pb-1">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {ORDER_STATUS_TABS.map((status) => {
            const info = getOrderStatusInfo(status);
            return (
              <button
                key={status}
                type="button"
                onClick={() => setActiveTab(status)}
                className={`shrink-0 h-9 px-3 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-colors ${
                  activeTab === status ? "bg-indigo-600 text-white" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-gray-100 dark:border-slate-800"
                }`}
              >
                {t(`orderStatus.${info.key}`)} {tabCounts[status] > 0 ? `(${tabCounts[status]})` : ""}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 space-y-3 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-indigo-500" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
            <ClipboardList size={36} className="text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{t("staffApp.emptyOrders")}</p>
          </div>
        ) : (
          filteredOrders.map((order, index) => (
            <StaffOrderCard
              key={order.id}
              order={order}
              orderNumber={filteredOrders.length - index}
              canManageCouriers={canManageCouriers}
              couriers={couriers}
              staffId={staffId}
              staffName={staffName}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default StaffOrdersSection;
