import { useState, useCallback } from "react";
import { Clapperboard, Download, Loader2, Sparkles } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import generateStoryImage from "@/services/products/generateStoryImage";

/**
 * AI CEO — TALAB BO'YICHA (on-demand) "Story" (Instagram/Telegram
 * Stories, 9:16) reklama surati.
 *
 * `InstagramAdImageCard.jsx`dagi (avtomatik, faqat ko'rsatish) kvadrat
 * kartadan FARQLI ravishda, bu yerda GENERATSIYA TUGMASI bor — sotuvchi
 * o'zi xohlagan paytda (masalan aynan hozir story qo'ymoqchi bo'lganda)
 * so'raydi (batafsil izoh: `functions/storyImage.js`). Faqat AI CEO
 * yoqilgan (`aiCeoEnabled`) sotuvchilar uchun ko'rsatiladi — server
 * ham buni qat'iy tekshiradi, bu yerdagi tekshiruv faqat foydasiz
 * xato xabaridan oldini olish uchun.
 */
const StoryAdImageCard = ({ productId, initialImageUrl, aiCeoEnabled }) => {
  const { t } = useLanguage();
  // `initialImageUrl` mahsulot hujjati asinxron yuklangandan keyin
  // (birinchi renderda hali `null`) kech kelishi mumkin - shuning
  // uchun uni to'g'ridan-to'g'ri `useState`ning boshlang'ich qiymati
  // sifatida OLMAYMIZ (aks holda kech kelgan qiymat e'tiborsiz
  // qolardi). Buning o'rniga: "hozirgina generatsiya qilingan" qiymat
  // alohida saqlanadi va bor bo'lsa ustunlik qiladi, aks holda propdan
  // kelgan (allaqachon saqlangan) qiymat ko'rsatiladi - render vaqtida
  // hisoblanadi, effekt shart emas.
  const [freshlyGeneratedUrl, setFreshlyGeneratedUrl] = useState(null);
  const imageUrl = freshlyGeneratedUrl || initialImageUrl || null;
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = useCallback(async () => {
    if (!productId) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateStoryImage(productId);
      setFreshlyGeneratedUrl(result.imageUrl);
    } catch (err) {
      setError(err.message || t("aiStoryImage.generateError"));
    } finally {
      setGenerating(false);
    }
  }, [productId, t]);

  if (!aiCeoEnabled) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-1.5 text-violet-500">
        <Clapperboard size={13} />
        <h3 className="text-xs font-black uppercase tracking-wider">{t("aiStoryImage.title")}</h3>
      </div>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("aiStoryImage.subtitle")}</p>

      {imageUrl && (
        <img
          src={imageUrl}
          alt={t("aiStoryImage.title")}
          className="w-full max-w-[220px] mx-auto aspect-[9/16] object-cover rounded-xl border border-slate-100 dark:border-slate-800"
        />
      )}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating || !productId}
        className="w-full h-10 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
      >
        {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
        {generating
          ? t("aiStoryImage.generating")
          : imageUrl
            ? t("aiStoryImage.regenerateButton")
            : t("aiStoryImage.generateButton")}
      </button>

      {error && <p className="text-[11px] text-rose-500 font-semibold">{error}</p>}

      {imageUrl && !generating && (
        <a
          href={imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5"
        >
          <Download size={13} /> {t("aiStoryImage.downloadButton")}
        </a>
      )}
    </div>
  );
};

export default StoryAdImageCard;
