import React from "react";
import {LOW_STOCK_THRESHOLD} from "./catalog.js";

const ProductItem = ({ prod, isToggling, onQuickEdit, onToggleActive }) => {
  // Sxema drift uchun himoya: eski hujjatlarda `name`, yangilarida `title` bo'lishi mumkin.
  // Barcha yangi yozuvlar bitta maydonga (title) o'tkazilishi tavsiya etiladi.
  const displayName = prod.title || prod.name || "Nomsiz mahsulot";
  const displayBrand = prod.brand || prod.category;
  const isLowStock = prod.stock <= LOW_STOCK_THRESHOLD;

  return (
    <div
      onClick={() => onQuickEdit(prod)}
      className={`bg-white p-3 rounded-2xl border transition-all flex items-center justify-between active:bg-slate-50 cursor-pointer
      ${!prod.isActive ? "opacity-60 bg-slate-50/50" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <img src={prod.image} alt="" className="w-14 h-14 object-cover rounded-xl bg-slate-50 border border-slate-100" />
          {!prod.isActive && (
            <span className="absolute inset-0 bg-slate-900/40 rounded-xl flex items-center justify-center text-[8px] font-black text-white uppercase">OFF</span>
          )}
        </div>

        <div className="space-y-0.5 max-w-[170px]">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{displayBrand}</span>
          <h4 className="text-xs font-black text-slate-800 truncate leading-tight">{displayName}</h4>
          <div className="text-xs font-black text-slate-900">{prod.price.toLocaleString()} so'm</div>

          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
                isLowStock ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-500"
              }`}
            >
              Stok: {prod.stock} ta
            </span>
            <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-sm">
              🔥 {prod.sold ?? 0} sotildi
            </span>
          </div>
        </div>
      </div>

      {/* iOS Style Switch Active Controller */}
      <button
        onClick={(e) => {
          e.stopPropagation(); // karta bosilib Quick Edit ochilib ketmasligi uchun
          onToggleActive(prod);
        }}
        disabled={isToggling}
        className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out flex items-center disabled:opacity-50 ${
          prod.isActive ? "bg-emerald-500 justify-end" : "bg-slate-200 justify-start"
        }`}
      >
        <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
      </button>
    </div>
  );
};

// prod, isToggling o'zgarmagan mahsulot kartalari qayta render bo'lmasin —
// masalan, izlash inputiga yozilganda faqat ro'yxat filtrlanadi,
// filtrdan o'zgarmay qolgan itemlar qayta chizilmaydi
export default React.memo(ProductItem);
