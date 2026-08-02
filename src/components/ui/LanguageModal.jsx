import { memo } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { SUPPORTED_LANGUAGES, translations } from "@/i18n/translations";

const LANGUAGE_META = {
  uz: { flag: "🇺🇿" },
  ru: { flag: "🇷🇺" },
  en: { flag: "🇬🇧" },
};

const LanguageModal = ({ onClose }) => {
  const { language, setLanguage, t } = useLanguage();

  const handleSelect = (lang) => {
    setLanguage(lang);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-end justify-center animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[28px] p-5 space-y-4 shadow-xl border-t border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("languagePage.subtitle")}</span>
            <h3 className="font-black text-sm text-slate-800 dark:text-white">{t("languagePage.title")}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-full flex items-center justify-center font-bold text-xs"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang}
              onClick={() => handleSelect(lang)}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                language === lang
                  ? "bg-blue-50 dark:bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400"
                  : "bg-slate-50 dark:bg-slate-800 border-transparent text-slate-700 dark:text-slate-200"
              }`}
            >
              <span className="flex items-center gap-3 font-bold text-sm">
                <span className="text-xl">{LANGUAGE_META[lang].flag}</span>
                {translations[lang].language_name}
              </span>
              {language === lang && (
                <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default memo(LanguageModal);
