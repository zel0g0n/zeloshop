import { useState } from "react";
import { Ban, Check } from "lucide-react";
import { CANCEL_REASON_KEYS } from "@/constants/orderStatus";
import { useLanguage } from "@/context/LanguageContext";
import Sheet from "@/components/ui/Sheet";

const CancelReasonModal = ({ onConfirm, onClose, busy }) => {
  const { t } = useLanguage();
  const [selectedReasonKey, setSelectedReasonKey] = useState(null);

  return (
    <Sheet
      onClose={onClose}
      busy={busy}
      icon={Ban}
      accent="rose"
      size="sm"
      title={t("sellerOrders.cancelReasonModalTitle")}
      subtitle={t("sellerOrders.cancelReasonModalSubtitle")}
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="hidden lg:flex h-11 px-5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 items-center justify-center transition-colors disabled:opacity-50"
          >
            {t("common.close")}
          </button>
          <button
            type="button"
            disabled={!selectedReasonKey || busy}
            onClick={() => onConfirm(t(`orderStatus.cancelReasons.${selectedReasonKey}`))}
            className="flex-1 h-11 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs rounded-xl disabled:opacity-40 disabled:hover:bg-rose-500 transition-colors"
          >
            {busy ? t("sellerOrders.cancelling") : t("sellerOrders.confirmCancelFull")}
          </button>
        </div>
      }
    >
      <div className="space-y-2" role="radiogroup">
        {CANCEL_REASON_KEYS.map((reasonKey) => {
          const selected = selectedReasonKey === reasonKey;
          return (
            <button
              key={reasonKey}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setSelectedReasonKey(reasonKey)}
              className={`w-full flex items-center justify-between gap-3 text-left px-4 py-3 rounded-2xl border text-[13px] font-bold transition-all ${
                selected
                  ? "bg-rose-50 dark:bg-rose-500/10 border-rose-400 text-rose-600 dark:text-rose-400"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <span>{t(`orderStatus.cancelReasons.${reasonKey}`)}</span>
              <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${selected ? "bg-rose-500 border-rose-500 text-white" : "border-slate-300 dark:border-slate-600"}`}>
                {selected && <Check size={12} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
};

export default CancelReasonModal;
