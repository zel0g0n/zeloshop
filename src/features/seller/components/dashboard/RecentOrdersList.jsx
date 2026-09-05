import { memo } from "react";
import { Link } from "react-router-dom";
import { getOrderStatusInfo } from "@/constants/orderStatus";
import { useLanguage } from "@/context/LanguageContext";

const formatTime = (ms) => {
  if (!ms) return "";
  return new Date(ms).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
};

// Loyihaning umumiy `constants/orderStatus.js`dagi (theme-aware)
// rang sinfidan foydalanadi — boshqa sahifalar bilan bir xil.
//
// `order.orderNumber` — `orders.js`dagi haqiqiy, doimiy hisoblagichdan
// kelgan qiymat; u har bir buyurtmada yaratilgan paytida atomik
// hisoblagich orqali belgilanadi va ro'yxat uzunligiga bog'liq emas. Bu
// maydon mavjud bo'lmagan (eski) buyurtmalar uchun esa
// `orders.length - index` orqali taxminiy raqam zaxira sifatida
// hisoblanadi — bu usul faqat yuklab olingan ro'yxat doirasida to'g'ri
// natija beradi.
const RecentOrdersList = ({ orders }) => {
  const { t } = useLanguage();
  const recentOrders = orders.slice(0, 5);

  return (
    <div>
      <div className="flex justify-between items-center mb-2 px-1">
        <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("sellerDashboard.recentOrders")}</h3>
        <Link to="/seller/orders" className="text-xs font-bold text-[#5346E0] dark:text-[#8b85f5] hover:underline">{t("sellerDashboard.viewAll")}</Link>
      </div>

      {recentOrders.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-6 text-center text-xs text-slate-400 dark:text-slate-500">
          {t("sellerDashboard.noOrders")}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden divide-y divide-slate-50 dark:divide-slate-800">
          {recentOrders.map((order, index) => {
            const statusInfo = getOrderStatusInfo(order.status);
            const orderNumber = order.orderNumber ?? (orders.length - index);
            return (
              <div key={order.id} className="p-3.5 flex items-center justify-between">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-800 dark:text-white">#{orderNumber}</span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold bg-slate-100 dark:bg-slate-800 px-1 rounded">{formatTime(order.createdAt)}</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">{t("sellerDashboard.customer")} {order.customer?.fullName || t("sellerDashboard.unknownCustomer")}</div>
                </div>
                <div className="text-right space-y-1 shrink-0 ml-2">
                  <div className="text-xs font-black text-slate-800 dark:text-white">{Number(order.totalAmount).toLocaleString()} so'm</div>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md inline-block ${statusInfo.color}`}>
                    {t(`orderStatus.${statusInfo.key}`)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default memo(RecentOrdersList);
