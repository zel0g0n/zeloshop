import React, { memo, useState } from "react";
import updateProduct from "@/services/products/updateProduct";

const QuickEditSheet = ({ product, onClose }) => {
  const title = product.title || product.name || "";
  const [price, setPrice] = useState(product.price);
  const [stock, setStock] = useState(product.stock);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateProduct(product.id, {
        price: Number(price) || 0,
        stock: Number(stock) || 0,
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-end justify-center animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-t-[28px] p-5 space-y-4 shadow-xl border-t border-slate-100">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tezkor tahrirlash</span>
            <h3 className="font-black text-sm text-slate-800 truncate max-w-[220px]">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center font-bold text-xs"
          >
            ✕
          </button>
        </div>

        {error && <p className="text-xs text-rose-500 font-semibold">{error}</p>}

        <div className="space-y-1">
          <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">Mahsulot narxi (so'm)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full h-11 px-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">Ombor qoldig'i (Stok)</label>
          <input
            type="number"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="w-full h-11 px-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button onClick={onClose} disabled={saving} className="h-11 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl disabled:opacity-60">
            Bekor qilish
          </button>
          <button
            onClick={handleSave}
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

export default memo(QuickEditSheet);
