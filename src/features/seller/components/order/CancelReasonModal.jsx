import React, { useState } from "react";
import { X } from "lucide-react";
import { CANCEL_REASONS } from "@/constants/orderStatus";

const CancelReasonModal = ({ onConfirm, onClose, busy }) => {
  const [selectedReason, setSelectedReason] = useState(null);

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center">
      <div className="bg-white dark:bg-slate-900 w-full max-w-[440px] rounded-t-[28px] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 dark:text-white">Bekor qilish sababi</h3>
          <button type="button" onClick={onClose} className="text-slate-400 dark:text-slate-500">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2">
          {CANCEL_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => setSelectedReason(reason)}
              className={`w-full text-left px-4 py-3 rounded-2xl border text-xs font-bold transition-all ${
                selectedReason === reason
                  ? "bg-rose-50 dark:bg-rose-500/10 border-rose-400 text-rose-600 dark:text-rose-400"
                  : "bg-[#F4F5F9] dark:bg-slate-800 border-transparent text-slate-600 dark:text-slate-300"
              }`}
            >
              {reason}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={!selectedReason || busy}
          onClick={() => onConfirm(selectedReason)}
          className="w-full h-12 bg-rose-500 text-white font-black text-sm rounded-2xl disabled:opacity-40"
        >
          {busy ? "Bekor qilinmoqda..." : "Bekor qilishni tasdiqlash"}
        </button>
      </div>
    </div>
  );
};

export default CancelReasonModal;
