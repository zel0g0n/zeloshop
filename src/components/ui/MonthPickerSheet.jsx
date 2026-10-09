import { memo } from "react";
import { Check, CalendarDays } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { getRecentMonthOptions } from "@/utils/dateRange";
import Sheet from "@/components/ui/Sheet";

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

  return (
    <Sheet onClose={onClose} icon={CalendarDays} accent="indigo" size="sm" title={t("monthPicker.title")}>
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
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
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
    </Sheet>
  );
};

export default memo(MonthPickerSheet);
