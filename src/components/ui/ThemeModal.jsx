import { memo } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";

const ThemeModal = ({ onClose }) => {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();

  const options = [
    { id: "light", icon: "☀️", label: t("themePage.light"), desc: t("themePage.lightDesc") },
    { id: "dark", icon: "🌙", label: t("themePage.dark"), desc: t("themePage.darkDesc") },
  ];

  const handleSelect = (id) => {
    setTheme(id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-end justify-center animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[28px] p-5 space-y-4 shadow-xl border-t border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("themePage.subtitle")}</span>
            <h3 className="font-black text-sm text-slate-800 dark:text-white">{t("themePage.title")}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-full flex items-center justify-center font-bold text-xs"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                theme === opt.id
                  ? "bg-blue-50 dark:bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400"
                  : "bg-slate-50 dark:bg-slate-800 border-transparent text-slate-700 dark:text-slate-200"
              }`}
            >
              <span className="flex items-center gap-3">
                <span className="text-xl">{opt.icon}</span>
                <span className="text-left">
                  <span className="block font-bold text-sm">{opt.label}</span>
                  <span className="block text-xs opacity-70">{opt.desc}</span>
                </span>
              </span>
              {theme === opt.id && (
                <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs shrink-0">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default memo(ThemeModal);
