import React, { memo } from "react";

const ProductsStatusTabs = ({ activeTab, onChangeTab, allCount, activeCount, inactiveCount }) => (
  <div className="px-4 mt-3 flex items-center gap-1.5 text-[11px] font-bold">
    <button
      onClick={() => onChangeTab("Barchasi")}
      className={`px-3 py-1 rounded-lg transition-all ${activeTab === "Barchasi" ? "bg-white text-indigo-600 shadow-xs border border-indigo-100" : "text-slate-400"}`}
    >
      Hammasi ({allCount})
    </button>
    <span className="text-slate-200">|</span>
    <button
      onClick={() => onChangeTab("Faol")}
      className={`px-3 py-1 rounded-lg transition-all ${activeTab === "Faol" ? "bg-white text-emerald-600 shadow-xs border border-emerald-100" : "text-slate-400"}`}
    >
      Faol ({activeCount})
    </button>
    <span className="text-slate-200">|</span>
    <button
      onClick={() => onChangeTab("Nofaol")}
      className={`px-3 py-1 rounded-lg transition-all ${activeTab === "Nofaol" ? "bg-white text-rose-600 shadow-xs border border-rose-100" : "text-slate-400"}`}
    >
      Nofaol ({inactiveCount})
    </button>
  </div>
);

export default memo(ProductsStatusTabs);
