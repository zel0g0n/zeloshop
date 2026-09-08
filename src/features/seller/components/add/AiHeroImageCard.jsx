import { useState, useCallback } from "react";
import { Wand2, Download, Loader2, Check } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import generateProductHeroImage from "@/services/products/generateProductHeroImage";

/**
 * AI CEO — TALAB BO'YICHA (on-demand) mahsulot uchun AI "asosiy rasm"
 * (hero image) yaratadi va uni DARHOL mahsulotning asosiy (birinchi)
 * rasmi sifatida saqlaydi (`functions/heroImage.js`).
 *
 * 2026-09, foydalanuvchi so'rovi bilan ESKI `StoryAdImageCard.jsx`
 * (vertikal 9:16 "Story" rasmi, faqat yuklab olish uchun) O'RNIGA
 * YARATILDI — sabab: 9:16 vertikal rasm `ProductCard.jsx`dagi
 * mahsulot kartochkasi joyiga (kengroq, deyarli kvadrat) SIG'MAYDI.
 * Bu YANGI komponent doim KVADRAT (1:1) rasm yaratadi va NATIJANI
 * DARHOL "asosiy rasm" qiladi — shuning uchun bu yerda alohida
 * "saqlash" tugmasi YO'Q, generatsiya = saqlash (backend'ning o'zi
 * `products/{id}.images`/`image` maydonlarini yangilaydi).
 *
 * USLUB TANLOVI (foydalanuvchi so'rovi: "/adcreative yoki
 * /premiumshowcase"): sotuvchi ikkita tayyor uslubdan birini tanlaydi
 * — ikkalasi ham backend'da (`lib/aiImage.js`) alohida promptga ega.
 *
 * `onGenerated(images)` — muvaffaqiyatli generatsiyadan keyin
 * chaqiriladi, YANGI `images` massivi bilan (yangi rasm birinchi
 * o'rinda) — chaqiruvchi (`EditProductPage.jsx`) shu orqali sahifadagi
 * mahalliy rasm holatini (`useProductImages`) DARHOL yangilaydi, aks
 * holda sotuvchi "Saqlash"ni bosmaguncha yangi asosiy rasmni
 * ko'rmagan bo'lardi (u ALLAQACHON Firestore'da saqlangan bo'lsa ham).
 */
const HERO_STYLES = [
  { key: "adCreative", labelKey: "aiHeroImage.styleAdCreative", descKey: "aiHeroImage.styleAdCreativeDesc" },
  { key: "premiumShowcase", labelKey: "aiHeroImage.stylePremiumShowcase", descKey: "aiHeroImage.stylePremiumShowcaseDesc" },
];

const AiHeroImageCard = ({ productId, aiCeoEnabled, onGenerated }) => {
  const { t } = useLanguage();
  const [style, setStyle] = useState("adCreative");
  const [freshlyGeneratedUrl, setFreshlyGeneratedUrl] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = useCallback(async () => {
    if (!productId) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateProductHeroImage(productId, style);
      setFreshlyGeneratedUrl(result.imageUrl);
      onGenerated?.(result.images);
    } catch (err) {
      setError(err.message || t("aiHeroImage.generateError"));
    } finally {
      setGenerating(false);
    }
  }, [productId, style, onGenerated, t]);

  if (!aiCeoEnabled) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-1.5 text-violet-500">
        <Wand2 size={13} />
        <h3 className="text-xs font-black uppercase tracking-wider">{t("aiHeroImage.title")}</h3>
      </div>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("aiHeroImage.subtitle")}</p>

      <div className="grid grid-cols-2 gap-2">
        {HERO_STYLES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStyle(s.key)}
            disabled={generating}
            className={`text-left rounded-xl p-2.5 border transition-colors disabled:opacity-60 ${
              style === s.key
                ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10"
                : "border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
            }`}
          >
            <p className={`text-[11px] font-black ${style === s.key ? "text-violet-600 dark:text-violet-400" : "text-slate-600 dark:text-slate-300"}`}>
              {t(s.labelKey)}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">{t(s.descKey)}</p>
          </button>
        ))}
      </div>

      {freshlyGeneratedUrl && (
        <img
          src={freshlyGeneratedUrl}
          alt={t("aiHeroImage.title")}
          className="w-full max-w-[220px] mx-auto aspect-square object-cover rounded-xl border border-slate-100 dark:border-slate-800"
        />
      )}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating || !productId}
        className="w-full h-10 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
      >
        {generating ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
        {generating
          ? t("aiHeroImage.generating")
          : freshlyGeneratedUrl
            ? t("aiHeroImage.regenerateButton")
            : t("aiHeroImage.generateButton")}
      </button>

      {error && <p className="text-[11px] text-rose-500 font-semibold">{error}</p>}

      {freshlyGeneratedUrl && !generating && (
        <>
          <p className="flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <Check size={13} /> {t("aiHeroImage.savedAsMain")}
          </p>
          <a
            href={freshlyGeneratedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <Download size={13} /> {t("aiHeroImage.downloadButton")}
          </a>
        </>
      )}
    </div>
  );
};

export default AiHeroImageCard;
