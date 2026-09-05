import { useState } from "react";
import { X } from "lucide-react";
import { CANCEL_REASON_KEYS } from "@/constants/orderStatus";
import { useLanguage } from "@/context/LanguageContext";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";

const CancelReasonModal = ({ onConfirm, onClose, busy }) => {
  const { t } = useLanguage();
  const [selectedReasonKey, setSelectedReasonKey] = useState(null);

  useEscapeToClose(onClose, !busy);

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-900 w-full max-w-[440px] rounded-t-[28px] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 dark:text-white">{t("sellerOrders.cancelReasonModalTitle")}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 dark:text-slate-500">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2">
          {CANCEL_REASON_KEYS.map((reasonKey) => (
            <button
              key={reasonKey}
              type="button"
              onClick={() => setSelectedReasonKey(reasonKey)}
              className={`w-full text-left px-4 py-3 rounded-2xl border text-xs font-bold transition-all ${
                selectedReasonKey === reasonKey
                  ? "bg-rose-50 dark:bg-rose-500/10 border-rose-400 text-rose-600 dark:text-rose-400"
                  : "bg-[#F4F5F9] dark:bg-slate-800 border-transparent text-slate-600 dark:text-slate-300"
              }`}
            >
              {t(`orderStatus.cancelReasons.${reasonKey}`)}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={!selectedReasonKey || busy}
          onClick={() => onConfirm(t(`orderStatus.cancelReasons.${selectedReasonKey}`))}
          className="w-full h-12 bg-rose-500 text-white font-black text-sm rounded-2xl disabled:opacity-40"
        >
          {busy ? t("sellerOrders.cancelling") : t("sellerOrders.confirmCancelFull")}
        </button>
      </div>
    </div>
  );
};

export default CancelReasonModal;
