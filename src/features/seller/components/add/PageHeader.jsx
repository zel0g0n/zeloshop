import React from "react";

const PageHeader = () => (
  <div className="bg-white dark:bg-slate-900 px-5 py-4 sticky top-0 z-30 shadow-xs flex items-center gap-3">
    <button
      type="button"
      className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform"
      onClick={() => window.history.back()}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
      </svg>
    </button>
    <div>
      <h1 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Yangi mahsulot</h1>
      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Katalogga tovar qo'shish</p>
    </div>
  </div>
);

// Static markup, props yo'q — hech qachon qayta render bo'lishi shart emas
export default React.memo(PageHeader);
