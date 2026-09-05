import { memo } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

// MUHIM: bu banner "Yangi mahsulot" sahifasidan (`AddProductPage.jsx`)
// olib tashlandi va o'rniga `QuickAddAICard.jsx` (rasm+izoh orqali AI
// CEO navbatiga qo'shish) qo'yildi - foydalanuvchi so'roviga ko'ra.
// Bu komponent hali ham "Mahsulotni tahrirlash" sahifasida
// (`EditProductPage.jsx`) ishlatiladi - u yerda mahsulot ALLAQACHON
// mavjud (nomi/rasmi bor), shuning uchun "bir martalik tavsif
// to'ldirish" hali ham to'g'ri, mantiqiy funksiya bo'lib qoladi.
const AIBanner = ({ generating, error, onGenerate }) => {
  const { t } = useLanguage();
  return (
  <div>
    <button
      type="button"
      onClick={onGenerate}
      disabled={generating}
      className="w-full p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/25 flex items-center justify-between gap-3 active:scale-[0.98] transition-transform disabled:opacity-70"
    >
      <div className="flex items-center gap-3 text-left min-w-0">
        <span className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black text-indigo-700 dark:text-indigo-300 truncate">
            {generating ? t("sellerProductForm.generatingDescription") : t("sellerProductForm.aiHelpFill")}
          </p>
          <p className="text-[10px] text-indigo-500/80 dark:text-indigo-400/70 font-medium truncate">
            {t("sellerProductForm.aiHelpDesc")}
          </p>
        </div>
      </div>
      {!generating && (
        <span className="shrink-0 text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-500/30 px-2.5 py-1.5 rounded-lg">
          {t("sellerProductForm.autoFill")}
        </span>
      )}
    </button>
    {error && <p className="text-[11px] text-rose-500 font-semibold mt-1.5 pl-1">{error}</p>}
  </div>
  );
};

export default memo(AIBanner);
