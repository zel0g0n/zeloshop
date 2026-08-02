import React, { memo, useState } from "react";
import { Search, ArrowUpDown } from "lucide-react";

const SORT_OPTIONS = [
  { value: "none", label: "Standart" },
  { value: "price-desc", label: "Narx: qimmatdan arzonga" },
  { value: "price-asc", label: "Narx: arzondan qimmatga" },
  { value: "stock-desc", label: "Stok: ko'pdan kamga" },
  { value: "stock-asc", label: "Stok: kamdan ko'pga" },
];

const ProductsHeader = ({ searchQuery, onSearchChange, productsCount, inventoryValue, sortBy, onSortChange }) => {
  const [showSortMenu, setShowSortMenu] = useState(false);

  return (
    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">Katalog Boshqaruvi</h1>
          <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Ombor qoldig'i real-time</p>
        </div>
        <div className="text-right">
          <span className="block text-xs font-bold text-slate-800 dark:text-white">{productsCount} tovar</span>
          <span className="block text-[10px] font-medium text-slate-500 dark:text-zinc-400">{inventoryValue.toLocaleString()} so'm</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 dark:text-zinc-400">
            <Search size={15} />
          </span>
          <input
            type="text"
            placeholder="Nomi yoki kategoriyasi bo'yicha qidirish..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-10 pl-9 pr-4 bg-[#F4F5F9] dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400 dark:placeholder:text-zinc-400"
          />
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowSortMenu((v) => !v)}
            className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${
              sortBy !== "none" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "bg-[#F4F5F9] dark:bg-slate-800 text-slate-500 dark:text-zinc-300"
            }`}
            title="Saralash"
          >
            <ArrowUpDown size={15} />
          </button>

          {showSortMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
              <div className="absolute right-0 top-12 z-50 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 py-1.5 w-56">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { onSortChange(opt.value); setShowSortMenu(false); }}
                    className={`w-full text-left px-3.5 py-2 text-xs font-semibold ${
                      sortBy === opt.value ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10" : "text-slate-600 dark:text-zinc-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(ProductsHeader);
