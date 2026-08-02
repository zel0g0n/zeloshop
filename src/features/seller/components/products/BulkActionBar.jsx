import React, { memo } from "react";
import { X, Eye, EyeOff, Trash2 } from "lucide-react";

const BulkActionBar = ({ selectedCount, onActivate, onDeactivate, onDelete, onCancel, busy }) => (
  <div className="sticky top-0 z-20 bg-indigo-600 text-white px-4 py-2.5 flex items-center justify-between rounded-2xl shadow-md mb-2.5 animate-fade-in">
    <div className="flex items-center gap-2">
      <button onClick={onCancel} className="w-6 h-6 rounded-full bg-white/15 text-white flex items-center justify-center" aria-label="Bekor qilish">
        <X size={13} />
      </button>
      <span className="text-xs font-black">{selectedCount} ta tanlandi</span>
    </div>

    <div className="flex items-center gap-1.5">
      <button type="button" disabled={busy} onClick={onActivate} title="Faol qilish" className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center disabled:opacity-50">
        <Eye size={14} />
      </button>
      <button type="button" disabled={busy} onClick={onDeactivate} title="Nofaol qilish" className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center disabled:opacity-50">
        <EyeOff size={14} />
      </button>
      <button type="button" disabled={busy} onClick={onDelete} title="O'chirish" className="w-8 h-8 rounded-lg bg-rose-500 flex items-center justify-center disabled:opacity-50">
        <Trash2 size={14} />
      </button>
    </div>
  </div>
);

export default memo(BulkActionBar);
