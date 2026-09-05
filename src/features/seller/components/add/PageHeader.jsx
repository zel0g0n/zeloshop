import React from "react";
import { ChevronLeft } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const PageHeader = () => {
  const { t } = useLanguage();
  return (
  <div className="bg-white dark:bg-slate-900 px-5 py-4 sticky top-0 z-30 shadow-xs flex items-center gap-3">
    <button
      type="button"
      className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform"
      onClick={() => window.history.back()}
    >
      <ChevronLeft size={20} strokeWidth={2.5} />
    </button>
    <div>
      <h1 className="text-base font-black text-slate-800 dark:text-white tracking-tight">{t("sellerProductForm.newProductTitle")}</h1>
      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("sellerProductForm.newProductSubtitle")}</p>
    </div>
  </div>
  );
};

export default React.memo(PageHeader);
