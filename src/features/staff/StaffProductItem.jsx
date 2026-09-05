import { memo, useState } from "react";
import { Pencil, Flame } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

/**
 * `products/ProductItem.jsx`ning xodim Mini App'i uchun LEAN nusxasi.
 * ATAYLAB OLIB TASHLANGAN: "..." menyusidagi Nusxalash va O'CHIRISH
 * (delete) amallari — `firestore.rules`da xodimga (`manageProducts`
 * ruxsati bilan ham) FAQAT `update` huquqi berilgan, `delete` ATAYLAB
 * berilmagan (qarang: `firestore.rules`dagi izoh). Xodim mahsulotni
 * faqat FAOLSIZLANTIRISHI mumkin (`isActive: false`) — bu oddiy
 * `update`, quyidagi almashtirgich (toggle) shu vazifani bajaradi.
 * Narx/stok inline tahrirlash ham ATAYLAB YO'Q (soddalik uchun) —
 * to'liq tahrirlash uchun "Tahrirlash" tugmasi orqali to'liq forma
 * ochiladi (`StaffProductForm.jsx`).
 */
const StaffProductItem = ({ prod, onEdit, onToggleActive }) => {
  const { t } = useLanguage();
  const title = prod.title || prod.name || t("sellerProducts.untitled");
  const isActive = prod.isActive ?? true;
  const price = Number(prod.price) || 0;
  const stock = Number(prod.stock) || 0;
  const sold = Number(prod.sold) || 0;

  const [togglingActive, setTogglingActive] = useState(false);

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

  return (
    <div
      onClick={() => onEdit(prod)}
      className={`bg-white dark:bg-slate-900 border rounded-xl p-3 mb-2.5 transition-colors cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500/40 border-slate-100 dark:border-slate-800 ${
        !isActive ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center gap-2.5">
        <img
          src={prod.image}
          alt=""
          loading="lazy"
          className="w-14 h-14 object-cover rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shrink-0"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">{title}</h4>
            <button
              type="button"
              onClick={handleToggleActive}
              disabled={togglingActive}
              aria-label={isActive ? t("sellerProducts.deactivate") : t("sellerProducts.activate")}
              className={`shrink-0 w-9 h-5 rounded-full p-0.5 transition-colors flex items-center disabled:opacity-50 ${
                isActive ? "bg-emerald-500 justify-end" : "bg-slate-300 dark:bg-slate-700 justify-start"
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{price.toLocaleString()} so'm</span>
            <span className="text-slate-300 dark:text-slate-600 text-[10px]">|</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${stockBadgeClass}`}>
              {t("sellerProducts.stockLabel")} {stock} {t("sellerProducts.stockSuffix")}
            </span>
            <span className="text-slate-300 dark:text-slate-600 text-[10px]">|</span>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
              <Flame size={10} /> {sold} {t("sellerProducts.soldSuffix")}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(prod); }}
          className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"
          aria-label={t("sellerProducts.edit")}
        >
          <Pencil size={14} />
        </button>
      </div>
    </div>
  );
};

export default memo(StaffProductItem);
