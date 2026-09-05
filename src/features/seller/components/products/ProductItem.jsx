import { memo, useState, useRef, useEffect } from "react";
import { MoreVertical, Pencil, Copy, Trash2, Flame, Check } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { CLIENT_STOCK_CHANGE_REASONS, getStockChangeReasonLabelKey } from "@/utils/stockChangeReasons";

// OLDIN: kartochka ikki ustunli katak (grid) ichida, nisbatan
// "baland" formatda edi. Endi — spetsifikatsiyaga mos, ixcham,
// gorizontal-yo'naltirilgan bitta qator (checkbox+rasm+nom+toggle
// yuqorida, narx|stok|sotildi+menyu pastda).
const ProductItem = ({
  prod,
  isSelected,
  onToggleSelect,
  onEdit,
  onDuplicate,
  onToggleActive,
  onDelete,
  onInlineUpdate,
  // ZAXIRA HARAKATI AUDIT JURNALI (2026-09, "ombor nazorati" — haqiqiy
  // muammoni yechish bo'limi): FAQAT xodim Mini App'idan
  // (`StaffProductsSection.jsx`) beriladi - sotuvchining o'zi bu
  // ikkalasini bermaydi (u - owner, "kim o'zgartirdi" savoliga
  // ehtiyoj yo'q, batafsil: `lib/stockAuditLog.js`).
  staffId = null,
  staffName = null,
}) => {
  const { t } = useLanguage();
  const title = prod.title || prod.name || t("sellerProducts.untitled");
  const isActive = prod.isActive ?? true;
  const price = Number(prod.price) || 0;
  const stock = Number(prod.stock) || 0;
  const sold = Number(prod.sold) || 0;

  const [togglingActive, setTogglingActive] = useState(false);
  // ZAXIRA HARAKATI AUDIT JURNALI (2026-09, "ombor nazorati" — haqiqiy
  // muammoni yechish bo'limi): `inlineField` endi "stock" YOZILGANDAN
  // KEYIN darhol "stock-reason" holatiga o'tishi mumkin (raqam
  // o'zgargan bo'lsa) - bu, sotuvchi/xodim ombor qoldig'ini tezkor
  // (inline) o'zgartirganda ham SABAB tanlashni talab qiladi, xuddi
  // to'liq tahrirlash sahifasidagi kabi (`PricingCard.jsx`). Narx
  // (`price`) uchun bu qadam YO'Q - faqat stock uchun.
  const [inlineField, setInlineField] = useState(null);
  const [inlineValue, setInlineValue] = useState("");
  const [pendingStockValue, setPendingStockValue] = useState(null);
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

  const cancelInlineEdit = (e) => {
    e?.stopPropagation();
    setInlineField(null);
    setPendingStockValue(null);
  };

  const commitInlineEdit = async () => {
    const numValue = Number(inlineValue);
    if (Number.isNaN(numValue) || numValue < 0) {
      setInlineField(null);
      return;
    }
    // ZAXIRA HARAKATI AUDIT JURNALI: "stock" HAQIQATAN o'zgargan
    // bo'lsa - darhol saqlash O'RNIGA, sabab tanlash bosqichiga
    // o'tamiz (pastdagi "stock-reason" render bloki). O'zgarmagan
    // bo'lsa (yoki narx maydoni bo'lsa) - avvalgidek darhol saqlanadi.
    if (inlineField === "stock" && numValue !== stock) {
      setPendingStockValue(numValue);
      setInlineField("stock-reason");
      return;
    }
    if (inlineField === "stock") {
      // qiymat O'ZGARMAGAN - hech narsa qilmasdan yopamiz (keraksiz
      // audit yozuvi/tarmoq so'rovi yaratmaslik uchun).
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

  const commitStockReason = async (reasonKey, e) => {
    e.stopPropagation();
    setSavingInline(true);
    try {
      await onInlineUpdate(prod.id, {
        stock: pendingStockValue,
        lastStockChangeReason: reasonKey,
        ...(staffId ? { lastStockChangeByStaffId: staffId, lastStockChangeByStaffName: staffName || null } : {}),
      });
    } finally {
      setSavingInline(false);
      setInlineField(null);
      setPendingStockValue(null);
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
      className={`bg-white dark:bg-slate-900 border rounded-xl p-3 mb-2.5 transition-colors cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500/40 ${
        !isActive ? "opacity-60" : ""
      } ${isSelected ? "border-indigo-400 ring-1 ring-indigo-300 dark:ring-indigo-500/40" : "border-slate-100 dark:border-slate-800"}`}
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(prod.id); }}
          className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
            isSelected ? "bg-indigo-600 border-indigo-600" : "border-slate-300 dark:border-slate-600"
          }`}
          aria-label={t("sellerProducts.select")}
        >
          {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
        </button>

        <img
          src={prod.image}
          alt={prod.name}
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
              <span className="w-4 h-4 rounded-full bg-white shadow-xs"></span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap mt-1">
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
                className="w-24 h-6 px-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-300 dark:border-indigo-500/40 rounded text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={(e) => startInlineEdit("price", price, e)}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded px-1 py-0.5 transition-colors"
              >
                {price.toLocaleString()} so'm
              </button>
            )}

            <span className="text-slate-300 dark:text-slate-600 text-[10px]">|</span>

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
            ) : inlineField === "stock-reason" ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300">
                {t("sellerProducts.stockLabel")} {pendingStockValue} {t("sellerProducts.stockSuffix")}
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => startInlineEdit("stock", stock, e)}
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${stockBadgeClass}`}
              >
                {t("sellerProducts.stockLabel")} {stock} {t("sellerProducts.stockSuffix")}
              </button>
            )}

            <span className="text-slate-300 dark:text-slate-600 text-[10px]">|</span>

            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
              <Flame size={10} /> {sold} {t("sellerProducts.soldSuffix")}
            </span>
          </div>

          {/* ZAXIRA HARAKATI AUDIT JURNALI (2026-09, "ombor nazorati"):
              stock tezkor (inline) o'zgartirilganda, SABAB tanlash
              SHART - bu, ro'yxatdagi eng tez-tez ishlatiladigan
              o'zgartirish yo'li bo'lgani uchun, ENG MUHIM joy. */}
          {inlineField === "stock-reason" && (
            <div onClick={(e) => e.stopPropagation()} className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {CLIENT_STOCK_CHANGE_REASONS.map((reasonKey) => (
                <button
                  key={reasonKey}
                  type="button"
                  disabled={savingInline}
                  onClick={(e) => commitStockReason(reasonKey, e)}
                  className="text-[9px] font-bold px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 disabled:opacity-60"
                >
                  {t(`sellerProductForm.${getStockChangeReasonLabelKey(reasonKey)}`)}
                </button>
              ))}
              <button
                type="button"
                disabled={savingInline}
                onClick={cancelInlineEdit}
                className="text-[9px] font-bold px-2 py-1 rounded-lg text-slate-500 dark:text-slate-400"
              >
                {t("sellerProducts.bulkCancel")}
              </button>
            </div>
          )}
        </div>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v); }}
            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-zinc-300 flex items-center justify-center"
            aria-label={t("sellerProducts.moreActions")}
          >
            <MoreVertical size={14} />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-8 z-30 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-lg py-1 w-40">
              <button
                onClick={(e) => { e.stopPropagation(); setShowMenu(false); onEdit(prod); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <Pencil size={13} /> {t("sellerProducts.edit")}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setShowMenu(false); onDuplicate(prod.id); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <Copy size={13} /> {t("sellerProducts.duplicate")}
              </button>
              {/* `onDelete` XODIM Mini App'idan (`StaffProductsSection.jsx`)
                  ATAYLAB berilmaydi - `firestore.rules`da xodimga
                  (`manageProducts` ruxsati bilan ham) FAQAT `update`/
                  `create` huquqi berilgan, `delete` emas. Bu komponent
                  o'zi umumiy (sotuvchi VA xodim tomonidan qayta
                  ishlatiladi), shuning uchun "O'chirish" tugmasi shu
                  yerda, prop mavjudligiga qarab shartli ko'rsatiladi. */}
              {onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleMenuDelete(); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold ${confirmingDelete ? "text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/20" : "text-rose-500 hover:bg-slate-50 dark:hover:bg-slate-700"}`}
                >
                  <Trash2 size={13} /> {confirmingDelete ? t("sellerProducts.confirmDelete") : t("sellerProducts.bulkDelete")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(ProductItem);
