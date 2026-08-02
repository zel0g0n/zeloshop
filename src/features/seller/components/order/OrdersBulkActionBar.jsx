import React, { memo } from "react";
import { X, Truck, CheckCircle2, Ban } from "lucide-react";

const OrdersBulkActionBar = ({ selectedCount, onApprove, onShip, onCancel, onCancelReset, busy }) => (
  <div className="sticky top-0 z-30 bg-indigo-600 text-white px-4 py-2.5 flex items-center justify-between rounded-2xl shadow-md mb-2.5 animate-fade-in">
    <div className="flex items-center gap-2">
      <button onClick={onCancelReset} className="w-6 h-6 rounded-full bg-white/15 text-white flex items-center justify-center" aria-label="Bekor qilish">
        <X size={13} />
      </button>
      <span className="text-xs font-black">{selectedCount} ta tanlandi</span>
    </div>

    <div className="flex items-center gap-1.5">
      <button type="button" disabled={busy} onClick={onApprove} title="Barchasini tasdiqlash" className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center disabled:opacity-50">
        <CheckCircle2 size={14} />
      </button>
      <button type="button" disabled={busy} onClick={onShip} title="Kuryerga topshirish" className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center disabled:opacity-50">
        <Truck size={14} />
      </button>
      <button type="button" disabled={busy} onClick={onCancel} title="Bekor qilish" className="w-8 h-8 rounded-lg bg-rose-500 flex items-center justify-center disabled:opacity-50">
        <Ban size={14} />
      </button>
    </div>
  </div>
);

export default memo(OrdersBulkActionBar);
