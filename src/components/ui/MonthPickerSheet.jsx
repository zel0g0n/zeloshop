import { memo } from "react";
import { X, Check, CalendarDays } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { getRecentMonthOptions } from "@/utils/dateRange";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";

/**
 * "Oy" filtri bosilganda ochiladigan oy-tanlash paneli (2026-09
 * punkt-royxati, 1-band: "filter tablarda oy filtirini click
 * qilinganda OYni tanlash qismi ochilishi kerak ... tanlangan oydagi
 * malumotlar korinishi kerak"). So'nggi `monthsCount` ta oyni
 * (standart 12) ro'yxat sifatida ko'rsatadi — eng yangisi ("Joriy oy")
 * yuqorida, aniq belgi bilan.
 *
 * Bu — Dashboard, PnLDashboard, ProfitDeepDive va ProductAnalytics
 * to'rttalasida BIR XIL, umumiy komponent (`getRecentMonthOptions`,
 * `src/utils/dateRange.js`, bilan bir xil manbadan) - avval har bir
 * sahifa "Oy"ni o'zicha, turlicha (va xato bilan) hisoblardi.
 */
const MonthPickerSheet = ({ selectedMonthsAgo = 0, monthsCount = 12, onSelect, onClose }) => {
  const { t } = useLanguage();
  const monthNames = t("common.monthNamesShort");
  const options = getRecentMonthOptions(monthsCount);

  useEscapeToClose(onClose);

  return (
    <div className="fixed inset-0 bg-slate-900/55 z-50 flex items-end justify-center animate-fade-in" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[28px] p-5 space-y-3 shadow-xl border-t border-slate-100 dark:border-slate-800 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3 sticky -top-5 bg-white dark:bg-slate-900 pt-1">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <CalendarDays size={15} />
            </span>
            <h3 className="font-black text-sm text-slate-800 dark:text-white">{t("monthPicker.title")}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-full flex items-center justify-center shrink-0"
          >
            <X size={13} />
          </button>
        </div>

        <div className="space-y-1.5">
          {options.map((opt) => {
            const isSelected = opt.monthsAgo === selectedMonthsAgo;
            const label = Array.isArray(monthNames) ? `${monthNames[opt.month]} ${opt.year}` : `${opt.month + 1}/${opt.year}`;
            return (
              <button
                key={opt.monthsAgo}
                type="button"
                onClick={() => { onSelect(opt.monthsAgo); onClose(); }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                  isSelected
                    ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400"
                    : "bg-slate-50 dark:bg-slate-800 border-transparent text-slate-700 dark:text-slate-200"
                }`}
              >
                <span className="font-bold text-sm">
                  {label}
                  {opt.monthsAgo === 0 && (
                    <span className="ml-2 text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-md align-middle">
                      {t("common.thisMonth")}
                    </span>
                  )}
                </span>
                {isSelected && (
                  <span className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0">
                    <Check size={11} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default memo(MonthPickerSheet);
