import { useMemo, useState } from "react";
import useGetAllSellers from "@/hooks/admin/useGetAllSellers";
import AdminSellerCard from "./AdminSellerCard";
import { ListSkeleton } from "@/components/ui/Skeleton";

const AdminSellersPage = () => {
  const { sellers, loading, error } = useGetAllSellers();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'active' | 'suspended'

  const filteredSellers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return sellers.filter((seller) => {
      const matchesSearch =
        !query ||
        seller.storeName?.toLowerCase().includes(query) ||
        seller.phone?.includes(query);

      const isActive = seller.status !== "suspended";
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && isActive) ||
        (statusFilter === "suspended" && !isActive);

      return matchesSearch && matchesStatus;
    });
  }, [sellers, searchQuery, statusFilter]);

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
          { id: "all", label: `Barchasi (${sellers.length})` },
          { id: "active", label: "Faol" },
          { id: "suspended", label: "To'xtatilgan" },
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

      {loading && <ListSkeleton count={4} />}

      {!loading && error && (
        <div className="text-center py-16 text-sm text-rose-500 font-medium">Xatolik: {error}</div>
      )}

      {!loading && !error && filteredSellers.length === 0 && (
        <div className="text-center py-16 text-sm text-gray-400 dark:text-slate-500">
          Hech qanday sotuvchi topilmadi
        </div>
      )}

      {!loading && !error && filteredSellers.length > 0 && (
        <div className="space-y-3">
          {filteredSellers.map((seller) => (
            <AdminSellerCard key={seller.id} seller={seller} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminSellersPage;
