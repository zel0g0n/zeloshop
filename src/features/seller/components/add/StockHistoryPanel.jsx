import React from "react";
import { History, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useStockAuditLog } from "@/hooks/seller/useStockAuditLog";
import { getStockChangeReasonLabelKey } from "@/utils/stockChangeReasons";
import { formatRelativeTime } from "@/utils/relativeTime";

/**
 * ZAXIRA HARAKATI AUDIT JURNALI (2026-09, "ombor nazorati" — haqiqiy
 * muammoni yechish bo'limi): bitta mahsulotning so'nggi zaxira
 * harakatlarini (kim, qachon, necha dona, nima uchun) ko'rsatadi.
 * Bu — funksiyaning ASOSIY maqsadi: bir nechta xodim ichida
 * HISOBDORLIK, faqat "yozib qo'yish" emas, balki HAQIQATAN
 * KO'RINADIGAN tarix. `EditProductPage.jsx`da, faqat tahrirlash
 * rejimida (`originalStock != null`) ko'rsatiladi.
 */
const StockHistoryPanel = ({ sellerId, productId }) => {
  const { t } = useLanguage();
  const { entries, loading } = useStockAuditLog(sellerId, productId);

  const actorLabel = (entry) => {
    if (entry.actorName) return entry.actorName;
    if (entry.actorUid && entry.actorUid === sellerId) return t("sellerProductForm.stockHistoryByOwner");
    return t("sellerProductForm.stockHistoryBySystem");
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-2.5">
      <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
        <History size={12} /> {t("sellerProductForm.stockHistoryTitle")}
      </label>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 size={16} className="animate-spin text-slate-400" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 py-1">{t("sellerProductForm.stockHistoryEmpty")}</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {entries.map((entry) => {
            const isPositive = Number(entry.deltaQty) > 0;
            return (
              <div key={entry.id} className="flex items-start gap-2 text-xs border-b border-slate-50 dark:border-slate-800 pb-2 last:border-0 last:pb-0">
                <div
                  className={`shrink-0 w-6 h-6 rounded-lg flex items-center justify-center ${
                    isPositive
                      ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {isPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 dark:text-white">
                    {isPositive ? "+" : ""}
                    {entry.deltaQty} · {t(`sellerProductForm.${getStockChangeReasonLabelKey(entry.reason)}`)}
                    {entry.orderNumber != null && ` · ${t("sellerProductForm.stockHistoryOrderRef", { number: entry.orderNumber })}`}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {actorLabel(entry)} · {formatRelativeTime(entry.createdAtMs)} · {entry.oldStock} → {entry.newStock}
                  </p>
                  {entry.note && <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 italic">"{entry.note}"</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default React.memo(StockHistoryPanel);
