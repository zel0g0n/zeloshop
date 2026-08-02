import { memo } from "react";

const TIMEFRAMES = ["Bugun", "Hafta", "Oy"];

const TimeframeTabs = ({ timeframe, onChange }) => (
  <div className="bg-slate-200/60 dark:bg-slate-800 p-1 rounded-xl grid grid-cols-3 text-center text-xs font-black text-slate-500 dark:text-slate-400">
    {TIMEFRAMES.map((t) => (
      <button
        key={t}
        onClick={() => onChange(t)}
        className={`py-2 rounded-lg transition-all ${
          timeframe === t
            ? "bg-white dark:bg-slate-900 text-[#5346E0] dark:text-[#8b85f5] shadow-xs scale-[1.02]"
            : "hover:text-slate-800 dark:hover:text-slate-200"
        }`}
      >
        {t}
      </button>
    ))}
  </div>
);

export default memo(TimeframeTabs);
