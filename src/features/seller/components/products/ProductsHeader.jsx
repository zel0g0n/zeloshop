import React, { memo } from "react";

const ProductsHeader = ({ searchQuery, onSearchChange, countLowStock, onlyLowStock, onToggleLowStock }) => (
  <div className="bg-white px-4 pt-4 pb-3 sticky top-0 z-30 shadow-xs space-y-3">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-lg font-black text-slate-800 tracking-tight">Katalog boshqaruvi</h1>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ombor qoldig'i real-time</p>
      </div>

      {countLowStock > 0 && (
        <button
          onClick={onToggleLowStock}
          className={`flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1.5 rounded-full transition-all border ${
            onlyLowStock
              ? "bg-rose-500 text-white border-rose-600 animate-none"
              : "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
          }`}
        >
          ⚠️ {countLowStock} ta tugamoqda
        </button>
      )}
    </div>

    <div className="relative">
      <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      </span>
      <input
        type="text"
        placeholder="Nomi yoki kategoriyasi bo'yicha qidirish..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full h-10 pl-9 pr-4 bg-[#F4F5F9] rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400"
      />
    </div>
  </div>
);

export default memo(ProductsHeader);
