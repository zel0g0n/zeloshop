import React, { memo } from "react";
import { AlertTriangle } from "lucide-react";

const ProductsStatusTabs = ({ activeTab, onChangeTab, allCount, activeCount, inactiveCount, lowStockCount }) => (
  <div className="px-4 pt-3 pb-3 flex items-center gap-1.5 text-[11px] font-bold bg-white dark:bg-slate-900 overflow-x-auto no-scrollbar">
    <button
      onClick={() => onChangeTab("Barchasi")}
      className={`shrink-0 px-3 py-1.5 rounded-lg transition-all ${activeTab === "Barchasi" ? "bg-[#F4F5F9] dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20" : "text-slate-500 dark:text-zinc-400"}`}
    >
      Hammasi ({allCount})
    </button>
    <span className="text-slate-200 dark:text-slate-700 shrink-0">|</span>
    <button
      onClick={() => onChangeTab("Faol")}
      className={`shrink-0 px-3 py-1.5 rounded-lg transition-all ${activeTab === "Faol" ? "bg-[#F4F5F9] dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20" : "text-slate-500 dark:text-zinc-400"}`}
    >
      Faol ({activeCount})
    </button>
    <span className="text-slate-200 dark:text-slate-700 shrink-0">|</span>
    <button
      onClick={() => onChangeTab("Nofaol")}
      className={`shrink-0 px-3 py-1.5 rounded-lg transition-all ${activeTab === "Nofaol" ? "bg-[#F4F5F9] dark:bg-slate-800 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20" : "text-slate-500 dark:text-zinc-400"}`}
    >
      Nofaol ({inactiveCount})
    </button>
    <span className="text-slate-200 dark:text-slate-700 shrink-0">|</span>
    <button
      onClick={() => onChangeTab("KamQolgan")}
      className={`shrink-0 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${activeTab === "KamQolgan" ? "bg-[#F4F5F9] dark:bg-slate-800 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20" : "text-slate-500 dark:text-zinc-400"}`}
    >
      <AlertTriangle size={11} /> Kam qolgan ({lowStockCount})
    </button>
  </div>
);

export default memo(ProductsStatusTabs);
