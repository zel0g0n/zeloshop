import usePlatformStats from "@/hooks/admin/usePlatformStats";
import useGetAllSellers from "@/hooks/admin/useGetAllSellers";
import { useMemo } from "react";

const StatCard = ({ label, value, icon }) => (
  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xs">
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="text-lg">{icon}</span>
    </div>
    <div className="text-2xl font-black text-gray-800 dark:text-white mt-1">{value}</div>
  </div>
);

const AdminDashboard = () => {
  const { stats, loading: statsLoading } = usePlatformStats();
  const { sellers, loading: sellersLoading } = useGetAllSellers();

  const suspendedCount = useMemo(
    () => sellers.filter((s) => s.status === "suspended").length,
    [sellers]
  );

  return (
    <div className="p-4 space-y-4 pb-28">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Jami sotuvchilar" value={statsLoading ? "…" : stats?.totalSellers ?? 0} icon="🏪" />
        <StatCard label="Jami mahsulotlar" value={statsLoading ? "…" : stats?.totalProducts ?? 0} icon="📦" />
        <StatCard label="Jami buyurtmalar" value={statsLoading ? "…" : stats?.totalOrders ?? 0} icon="🧾" />
        <StatCard label="To'xtatilgan do'konlar" value={sellersLoading ? "…" : suspendedCount} icon="⛔️" />
      </div>

      <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl p-4 text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
        💡 "Sotuvchilar" bo'limidan istalgan do'konni qidirishingiz va
        kerak bo'lsa faoliyatini to'xtatib qo'yishingiz mumkin.
      </div>
    </div>
  );
};

export default AdminDashboard;
