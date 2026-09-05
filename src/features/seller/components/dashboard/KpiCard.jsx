import { memo } from "react";

/**
 * Ixcham KPI kartochkasi (2x2 katakning bitta katagi). Loyihaning
 * BOSHQA barcha sahifalari bilan BIR XIL rang kombinatsiyasidan
 * foydalanadi (theme-aware: och/to'q rejimga moslashadigan) — shu
 * orqali Dashboard boshqa sahifalardan rang jihatidan farq qilib
 * qolmaydi.
 */
const KpiCard = ({ icon: Icon, iconColorClass, label, value, subtext, subtextColorClass }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-3 shadow-2xs">
    <div className="flex items-center gap-1.5 mb-2">
      <Icon size={13} className={iconColorClass} />
      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">{label}</span>
    </div>
    <p className="text-[15px] font-black text-slate-800 dark:text-white leading-none truncate">{value}</p>
    {subtext && (
      <p className={`text-[10px] font-semibold mt-1.5 truncate ${subtextColorClass || "text-slate-400 dark:text-slate-500"}`}>{subtext}</p>
    )}
  </div>
);

export default memo(KpiCard);
