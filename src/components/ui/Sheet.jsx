import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { useLanguage } from "@/context/LanguageContext";

// Yagona modal/pastdan chiquvchi oyna (bottom sheet) qobig'i.
//
// OLDIN har bir modal (`CourierPickerModal`, `YandexTariffModal`,
// `CancelReasonModal`, `SellerQuickCreateMenu` ...) o'z `fixed inset-0`
// qobig'ini alohida yozgan edi: kompyuterda ular ekran pastiga
// yopishgan telefon-sheet bo'lib qolar, yon panel (z-40) / yuqori panel
// (z-30) bilan stacking-context to'qnashuvi sababli qisman yopilib
// qolar, orqa fon xiralashmas edi.
//
// ENDI: `document.body`ga portal qilinadi (hech qanday ota-element
// stacking-context'iga tushmaydi), telefonda — pastdan chiqadigan sheet
// (tutqich bilan), kompyuterda (lg+) — markazdagi toza dialog.
const ACCENTS = {
  indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
  teal: "bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400",
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
};

const SIZES = {
  sm: "lg:max-w-[420px]",
  md: "lg:max-w-[480px]",
  lg: "lg:max-w-[560px]",
};

const Sheet = ({
  onClose,
  title,
  subtitle,
  icon: Icon,
  accent = "indigo",
  size = "md",
  busy = false,
  footer = null,
  children,
}) => {
  const { t } = useLanguage();
  useEscapeToClose(onClose, !busy);

  // Oyna ochiq turganda orqadagi sahifa skroll bo'lmasin.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleBackdrop = () => { if (!busy) onClose?.(); };

  return createPortal(
    <div
      className="sheet-root fixed inset-0 z-[200] flex items-end justify-center lg:items-center lg:p-6 bg-slate-900/60 lg:backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : undefined}
      onClick={handleBackdrop}
    >
      <div
        className={`sheet-panel relative flex flex-col w-full max-w-[440px] ${SIZES[size] || SIZES.md} max-h-[88vh] lg:max-h-[min(86vh,720px)] bg-white dark:bg-slate-900 rounded-t-[28px] lg:rounded-3xl shadow-2xl lg:ring-1 lg:ring-slate-200/80 dark:lg:ring-slate-800 border-t border-slate-100 dark:border-slate-800 lg:border-t-0 overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lg:hidden flex justify-center pt-2.5 shrink-0">
          <span className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>

        <div className={`flex ${subtitle ? "items-start" : "items-center"} gap-3 px-5 pt-3 lg:pt-5 pb-4 shrink-0`}>
          {Icon && (
            <span className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center ${ACCENTS[accent] || ACCENTS.indigo}`}>
              <Icon size={19} />
            </span>
          )}
          <div className={`min-w-0 flex-1 ${subtitle ? "pt-0.5" : ""}`}>
            <h3 className="text-[15px] leading-5 font-black text-slate-800 dark:text-white">{title}</h3>
            {subtitle && (
              <p className="mt-0.5 text-[11px] leading-4 font-medium text-slate-400 dark:text-slate-500">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t("common.close")}
            className="shrink-0 w-9 h-9 -mr-1.5 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Sheet;
