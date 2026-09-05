import { memo } from "react";
import { useLanguage } from "@/context/LanguageContext";

const TIMEFRAMES = ["Bugun", "Hafta", "Oy"];
// Ichki holat (state) VA boshqa joylarda lug'at kaliti sifatida
// ishlatiladigan qiymatlar — bular O'ZGARTIRILMAYDI (ingliz/rus
// tiliga o'tkazilmaydi), faqat KO'RSATILADIGAN matn tarjima qilinadi.
const LABEL_KEYS = { Bugun: "timeframe.today", Hafta: "timeframe.week", Oy: "timeframe.month" };

// `variant="pure-dark"` — Dashboard kabi, doim to'q rejimda
// ishlaydigan sahifalar uchun (Telegram dark theme, `dark:` variant
// kerak emas). Standart (`variant` berilmasa) — theme-aware (P&L
// Dashboard kabi, foydalanuvchi tanlagan mavzuga moslashadigan)
// sahifalar uchun, avvalgidek.
const TimeframeTabs = ({ timeframe, onChange, variant }) => {
  const { t } = useLanguage();
  const isPureDark = variant === "pure-dark";

  return (
    <div
      className={
        isPureDark
          ? "bg-[#232e3c] p-1 rounded-xl grid grid-cols-3 text-center text-xs font-black text-zinc-400"
          : "bg-slate-200/60 dark:bg-slate-800 p-1 rounded-xl grid grid-cols-3 text-center text-xs font-black text-slate-500 dark:text-slate-400"
      }
    >
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          onClick={() => onChange(tf)}
          className={`py-2 rounded-lg transition-colors ${
            timeframe === tf
              ? isPureDark
                ? "bg-[#17212b] text-indigo-400"
                : "bg-white dark:bg-slate-900 text-[#5346E0] dark:text-[#8b85f5] shadow-xs"
              : isPureDark
                ? "hover:text-zinc-200"
                : "hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          {t(LABEL_KEYS[tf])}
        </button>
      ))}
    </div>
  );
};

export default memo(TimeframeTabs);
