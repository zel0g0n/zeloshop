import React from "react";

const StatusTabs = ({ activeTab, onlyLowStock, onSelectTab, totalCount, activeCount, inactiveCount }) => (
  <div className="px-4 mt-3 flex items-center gap-1.5 text-[11px] font-bold">
    <button
      onClick={() => onSelectTab("Barchasi")}
      className={`px-3 py-1 rounded-lg transition-all ${
        activeTab === "Barchasi" && !onlyLowStock ? "bg-white text-indigo-600 shadow-xs border border-indigo-100" : "text-slate-400"
      }`}
    >
      Hammasi ({totalCount})
    </button>
    <span className="text-slate-200">|</span>
    <button
      onClick={() => onSelectTab("Faol")}
      className={`px-3 py-1 rounded-lg transition-all ${
        activeTab === "Faol" ? "bg-white text-emerald-600 shadow-xs border border-emerald-100" : "text-slate-400"
      }`}
    >
      Faol ({activeCount})
    </button>
    <span className="text-slate-200">|</span>
    <button
      onClick={() => onSelectTab("Nofaol")}
      className={`px-3 py-1 rounded-lg transition-all ${
        activeTab === "Nofaol" ? "bg-white text-rose-600 shadow-xs border border-rose-100" : "text-slate-400"
      }`}
    >
      Nofaol ({inactiveCount})
    </button>
  </div>
);

export default React.memo(StatusTabs);
