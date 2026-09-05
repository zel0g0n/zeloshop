import useGetAllSellers from "@/hooks/admin/useGetAllSellers";
import AdminSellerCard from "./AdminSellerCard";
import { ListSkeleton } from "@/components/ui/Skeleton";

const AdminSellersPage = () => {
  const {
    sellers,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    error,
    counts,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    isSearching,
    searchIsApproximate,
    patchSellerStatus,
    patchSellerTariffPlan,
    removeSeller,
  } = useGetAllSellers();

  return (
    <div className="p-4 space-y-4 pb-28">
      <div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Do'kon nomi yoki telefon bo'yicha qidirish..."
          className="w-full h-11 px-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="flex gap-2">
        {[
          { id: "all", label: `Barchasi (${counts.total})` },
          { id: "active", label: `Faol (${counts.active})` },
          { id: "suspended", label: `To'xtatilgan (${counts.suspended})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === tab.id
                ? "bg-indigo-600 text-white"
                : "bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-400 border border-gray-100 dark:border-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* HALOL ogohlantirish: qidiruv platformadagi ENG SO'NGGI
          `ADMIN_SELLER_SEARCH_SCAN_CAP` ta sotuvchi orasida
          o'tkazilgani, va bu chegaraga yetilgani (demak undan eski
          sotuvchilar orasida mos kelishi mumkin bo'lgan natijalar
          tekshirilmagan bo'lishi mumkinligi) uchun ko'rsatiladi. */}
      {isSearching && searchIsApproximate && (
        <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/30 rounded-xl px-3 py-2">
          Diqqat: qidiruv faqat eng so'nggi qo'shilgan sotuvchilar orasida amalga oshirildi — juda eski
          sotuvchilar natijada ko'rinmasligi mumkin.
        </div>
      )}

      {loading && <ListSkeleton count={4} />}

      {!loading && error && (
        <div className="text-center py-16 text-sm text-rose-500 font-medium">Xatolik: {error}</div>
      )}

      {!loading && !error && sellers.length === 0 && (
        <div className="text-center py-16 text-sm text-gray-400 dark:text-slate-500">
          Hech qanday sotuvchi topilmadi
        </div>
      )}

      {!loading && !error && sellers.length > 0 && (
        <div className="space-y-3">
          {sellers.map((seller) => (
            <AdminSellerCard
              key={seller.id}
              seller={seller}
              onStatusChanged={patchSellerStatus}
              onTariffPlanChanged={patchSellerTariffPlan}
              onDeleted={removeSeller}
            />
          ))}
        </div>
      )}

      {!loading && !error && !isSearching && hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full h-11 rounded-2xl text-sm font-bold bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border border-gray-100 dark:border-slate-800 disabled:opacity-60"
        >
          {loadingMore ? "Yuklanmoqda..." : "Yana yuklash"}
        </button>
      )}
    </div>
  );
};

export default AdminSellersPage;
