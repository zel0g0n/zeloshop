import React from "react";

const QuickEditSheet = ({ product, editPrice, editStock, saving, onChangePrice, onChangeStock, onCancel, onSave }) => {
  if (!product) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-end justify-center animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-t-[28px] p-5 space-y-4 shadow-xl border-t border-slate-100">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tezkor tahrirlash</span>
            <h3 className="font-black text-sm text-slate-800 truncate max-w-[220px]">
              {product.title || product.name}
            </h3>
          </div>
          <button
            onClick={onCancel}
            disabled={saving}
            className="w-7 h-7 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center font-bold text-xs disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">Mahsulot narxi (so'm)</label>
          <input
            type="number"
            value={editPrice}
            disabled={saving}
            onChange={(e) => onChangePrice(e.target.value)}
            className="w-full h-11 px-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">Ombor qoldig'i (Stok)</label>
          <input
            type="number"
            value={editStock}
            disabled={saving}
            onChange={(e) => onChangeStock(e.target.value)}
            className="w-full h-11 px-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="h-11 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl disabled:opacity-60"
          >
            Bekor qilish
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="h-11 bg-[#5346E0] text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/10 disabled:opacity-60"
          >
            {saving ? "Saqlanmoqda..." : "Yangilash ✨"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(QuickEditSheet);
