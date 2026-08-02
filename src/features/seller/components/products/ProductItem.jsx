import React, { memo, useState, useRef, useEffect } from "react";
import { MoreVertical, Pencil, Copy, Trash2, Flame } from "lucide-react";

const ProductItem = ({
  prod,
  isSelected,
  onToggleSelect,
  onEdit,
  onDuplicate,
  onToggleActive,
  onDelete,
  onInlineUpdate,
}) => {
  const title = prod.title || prod.name || "Nomsiz mahsulot";
  const category = prod.category || "";
  const isActive = prod.isActive ?? true;
  const price = Number(prod.price) || 0;
  const stock = Number(prod.stock) || 0;
  const sold = Number(prod.sold) || 0;

  const [togglingActive, setTogglingActive] = useState(false);
  const [inlineField, setInlineField] = useState(null);
  const [inlineValue, setInlineValue] = useState("");
  const [savingInline, setSavingInline] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const stockBadgeClass =
    stock <= 3
      ? "text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-500/20"
      : stock <= 7
      ? "text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20"
      : "text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-slate-800";

  const handleToggleActive = async (e) => {
    e.stopPropagation();
    if (togglingActive) return;
    setTogglingActive(true);
    try {
      await onToggleActive(prod.id, !isActive);
    } finally {
      setTogglingActive(false);
    }
  };

  const startInlineEdit = (field, currentValue, e) => {
    e.stopPropagation();
    setInlineField(field);
    setInlineValue(String(currentValue));
  };

  const commitInlineEdit = async () => {
    const numValue = Number(inlineValue);
    if (Number.isNaN(numValue) || numValue < 0) {
      setInlineField(null);
      return;
    }
    setSavingInline(true);
    try {
      await onInlineUpdate(prod.id, { [inlineField]: numValue });
    } finally {
      setSavingInline(false);
      setInlineField(null);
    }
  };

  const handleMenuDelete = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      setTimeout(() => setConfirmingDelete(false), 3000);
      return;
    }
    setShowMenu(false);
    onDelete(prod.id);
  };

  return (
    <div
      onClick={() => onEdit(prod)}
      className={`bg-white dark:bg-slate-900 p-3.5 rounded-2xl border dark:border-slate-800 transition-all cursor-pointer active:bg-slate-50 dark:active:bg-slate-800
      ${!isActive ? "opacity-70 bg-slate-50/50 dark:bg-slate-800/50" : ""}
      ${isSelected ? "border-indigo-400 ring-1 ring-indigo-300 dark:ring-indigo-500/40" : "border-slate-100"}`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(prod.id); }}
          className={`shrink-0 mt-1 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
            isSelected ? "bg-indigo-600 border-indigo-600" : "border-slate-300 dark:border-slate-600"
          }`}
          aria-label="Tanlash"
        >
          {isSelected && <span className="text-white text-[10px] font-black">✓</span>}
        </button>

        <img
          src={prod.image}
          alt=""
          className="w-[60px] h-[60px] object-cover rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shrink-0"
        />

        <div className="flex-1 min-w-0 space-y-1">
          {category && <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">{category}</span>}
          <h4 className="text-sm font-black text-slate-800 dark:text-white truncate leading-tight line-clamp-1">{title}</h4>

          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            {inlineField === "price" ? (
              <input
                autoFocus
                type="number"
                value={inlineValue}
                disabled={savingInline}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setInlineValue(e.target.value)}
                onBlur={commitInlineEdit}
                onKeyDown={(e) => e.key === "Enter" && commitInlineEdit()}
                className="w-24 h-6 px-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-300 dark:border-indigo-500/40 rounded text-xs font-black text-slate-900 dark:text-white focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={(e) => startInlineEdit("price", price, e)}
                className="text-xs font-black text-slate-900 dark:text-white hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:ring-1 hover:ring-indigo-300 dark:hover:ring-indigo-500/40 rounded px-1.5 py-0.5 transition-all"
              >
                {price.toLocaleString()} so'm
              </button>
            )}

            {inlineField === "stock" ? (
              <input
                autoFocus
                type="number"
                value={inlineValue}
                disabled={savingInline}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setInlineValue(e.target.value)}
                onBlur={commitInlineEdit}
                onKeyDown={(e) => e.key === "Enter" && commitInlineEdit()}
                className="w-16 h-6 px-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-300 dark:border-indigo-500/40 rounded text-[10px] font-bold text-slate-900 dark:text-white focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={(e) => startInlineEdit("stock", stock, e)}
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-all hover:ring-1 hover:ring-indigo-300 dark:hover:ring-indigo-500/40 ${stockBadgeClass}`}
              >
                Stok: {stock} ta
              </button>
            )}

            <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Flame size={10} /> {sold} sotildi
            </span>
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={togglingActive}
            aria-label={isActive ? "Nofaol qilish" : "Faollashtirish"}
            className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out flex items-center disabled:opacity-50 ${
              isActive ? "bg-emerald-500 justify-end" : "bg-slate-300 dark:bg-slate-700 justify-start"
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white shadow-xs"></span>
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v); }}
              className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-zinc-300 flex items-center justify-center"
              aria-label="Boshqa amallar"
            >
              <MoreVertical size={14} />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-8 z-30 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-lg py-1 w-40">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMenu(false); onEdit(prod); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <Pencil size={13} /> Tahrirlash
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMenu(false); onDuplicate(prod.id); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <Copy size={13} /> Dublikat qilish
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleMenuDelete(); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold ${confirmingDelete ? "text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/20" : "text-rose-500 hover:bg-slate-50 dark:hover:bg-slate-700"}`}
                >
                  <Trash2 size={13} /> {confirmingDelete ? "Tasdiqlash uchun bosing" : "O'chirish"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(ProductItem);
