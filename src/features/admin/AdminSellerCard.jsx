import { memo, useState } from "react";
import updateSellerStatus from "@/services/admin/updateSellerStatus";

const STATUS_META = {
  active: { label: "Faol", color: "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  suspended: { label: "To'xtatilgan", color: "bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400" },
};

const AdminSellerCard = ({ seller }) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const isActive = seller.status !== "suspended";
  const meta = STATUS_META[isActive ? "active" : "suspended"];

  const handleToggle = async () => {
    setPending(true);
    setError(null);
    try {
      await updateSellerStatus(seller.id, isActive ? "suspended" : "active");
    } catch (err) {
      setError(err.message || "Xatolik yuz berdi");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 text-lg">
            {seller.logo ? <img src={seller.logo} alt={seller.storeName} className="w-full h-full object-cover" /> : "🏪"}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-800 dark:text-white truncate">{seller.storeName || "Nomsiz do'kon"}</h3>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">{seller.category || "Soha ko'rsatilmagan"} · {seller.phone || "Telefon yo'q"}</p>
          </div>
        </div>
        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md shrink-0 ${meta.color}`}>
          {meta.label}
        </span>
      </div>

      {error && <p className="text-[11px] text-rose-500 font-semibold">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleToggle}
          disabled={pending}
          className={`flex-1 h-9 rounded-xl text-xs font-bold transition-all disabled:opacity-60 ${
            isActive
              ? "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"
              : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {pending ? "..." : isActive ? "To'xtatish" : "Qayta faollashtirish"}
        </button>
      </div>
    </div>
  );
};

export default memo(AdminSellerCard);
