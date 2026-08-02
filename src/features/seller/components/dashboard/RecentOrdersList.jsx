import { memo } from "react";
import { Link } from "react-router-dom";
import { getOrderStatusInfo } from "@/constants/orderStatus";

const formatTime = (ms) => {
  if (!ms) return "";
  return new Date(ms).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
};

const RecentOrdersList = ({ orders }) => {
  const recentOrders = orders.slice(0, 3);

  return (
    <div>
      <div className="flex justify-between items-center mb-2 px-1">
        <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">So'nggi buyurtmalar</h3>
        <Link to="/seller/orders" className="text-xs font-bold text-[#5346E0] dark:text-[#8b85f5] hover:underline">Barchasi &gt;</Link>
      </div>

      {recentOrders.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-6 text-center text-xs text-slate-400 dark:text-slate-500">
          Hali buyurtmalar yo'q
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden divide-y divide-slate-50 dark:divide-slate-800">
          {recentOrders.map((order) => {
            const statusInfo = getOrderStatusInfo(order.status);
            return (
              <div key={order.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-800 dark:text-white">#{order.id.slice(0, 6)}</span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold bg-slate-100 dark:bg-slate-800 px-1 rounded">{formatTime(order.createdAt)}</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Mijoz: {order.customer?.fullName || "Noma'lum"}</div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-xs font-black text-slate-800 dark:text-white">{Number(order.totalAmount).toLocaleString()} so'm</div>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md inline-block ${statusInfo.color}`}>
                    {statusInfo.label}
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
