import { Sparkles, Download } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

/**
 * AI CEO — AVTOMATIK "INSTAGRAM REKLAMA SURATI".
 *
 * FOYDALANUVCHI SO'ROVI BILAN QO'SHILDI: mahsulot qo'shilganda (AI CEO
 * "Tez qo'shish" HAM, oddiy forma HAM), agar sotuvchi AI CEO premium
 * bo'lsa, mahsulotning asosiy rasmidan avtomatik reklama surati
 * generatsiya qilinadi (`functions/productAutomation.js`dagi
 * `maybeGenerateAdImage`, batafsil izoh: `functions/lib/aiImage.js`).
 * Bu — FAQAT KO'RSATISH kartasi (hech qanday generatsiya tugmasi yo'q -
 * generatsiya FONDA, avtomatik sodir bo'ladi) - `product.aiAdImageUrl`
 * mavjud bo'lsagina ko'rinadi.
 */
const InstagramAdImageCard = ({ imageUrl }) => {
  const { t } = useLanguage();
  if (!imageUrl) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-1.5 text-indigo-500">
        <Sparkles size={13} />
        <h3 className="text-xs font-black uppercase tracking-wider">{t("aiAdImage.title")}</h3>
      </div>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("aiAdImage.subtitle")}</p>
      <img
        src={imageUrl}
        alt={t("aiAdImage.title")}
        className="w-full aspect-square object-cover rounded-xl border border-slate-100 dark:border-slate-800"
      />
      <a
        href={imageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center gap-1.5"
      >
        <Download size={13} /> {t("aiAdImage.downloadButton")}
      </a>
    </div>
  );
};

export default InstagramAdImageCard;
