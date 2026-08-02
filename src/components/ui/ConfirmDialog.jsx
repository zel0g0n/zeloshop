import React from "react";

const ConfirmDialog = ({ title, message, confirmLabel = "Ha", cancelLabel = "Bekor qilish", danger, busy, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-xl">
      <div>
        <h3 className="text-sm font-black text-slate-800 dark:text-white">{title}</h3>
        {message && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="h-11 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-2xl disabled:opacity-60"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={`h-11 text-white font-black text-xs rounded-2xl disabled:opacity-60 ${danger ? "bg-rose-500" : "bg-indigo-600"}`}
        >
          {busy ? "..." : confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

export default ConfirmDialog;
