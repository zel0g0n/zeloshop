import { useState, useCallback } from "react";
import { Sparkles, Loader2, Check } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { useUploadImage } from "@/hooks/storage/useUploadStorage";
import { useProductImages } from "@/hooks/seller/useProductImages";
import { submitProductDraft } from "@/services/products/productDrafts";
import { useProductDrafts } from "@/hooks/seller/useProductDrafts";
import MultiImageUploadCard from "./MultiImageUploadCard";

/**
 * "TEZ QO'SHISH" (AI CEO 2-bosqichi) — ILGARI alohida sahifa
 * (`QuickProductCapture.jsx`, `/seller/products/quick-add`) va
 * Products.jsx'dagi alohida banner orqali ochilardi. Foydalanuvchi
 * so'roviga ko'ra endi shu yerga — "Yangi mahsulot" sahifasining
 * o'ziga, AVVAL shu joyda turgan "AI yordamida to'ldirish" (bir
 * martalik, faqat tavsifni to'ldiruvchi) blokining O'RNIGA
 * ko'chirildi. Ikkalasi ham bir xil maqsadga xizmat qilardi (AI
 * yordamida tezroq to'ldirish), lekin bu — TO'LIQROQ variant: nom,
 * tavsif VA kategoriyani ham AI o'zi (kechqurun) tayyorlaydi, sotuvchi
 * shu yerda faqat rasm(lar) + ixtiyoriy izoh qoldiradi.
 *
 * MUHIM: bu blok ORQALI yuborilgan mahsulot BU sahifadagi pastroqda
 * turgan to'liq formadan MUSTAQIL — o'zining alohida rasm/izoh
 * holatiga ega, "Navbatga qo'shish" bosilganda FAQAT navbatga
 * (`productDrafts`) yoziladi, pastdagi forma bilan aralashmaydi.
 * Narx SO'RALMAYDI (`ProductDraftReview.jsx`dagi tasdiqlash bosqichida
 * sotuvchining o'zi kiritadi) — narxni AI "taxmin qilishi" ishonchsiz
 * bo'lardi.
 */
const MAX_QUEUED_DRAFTS = 30;

const QuickAddAICard = () => {
  const { t } = useLanguage();
  const { sellerId, store } = useSession();
  const { uploadImage, progress, loading: uploading } = useUploadImage();
  const { images, addFiles, removeImage, setThumbnail, resolveUploadedUrls, reset: resetImages } = useProductImages();
  const { queued } = useProductDrafts(sellerId);
  const queueFull = queued.length >= MAX_QUEUED_DRAFTS;

  const [rawHint, setRawHint] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const processHour = Number.isInteger(store?.aiCeoDraftProcessHour) ? store.aiCeoDraftProcessHour : 21;
  const processHourLabel = `${String(processHour).padStart(2, "0")}:00`;

  const handleSubmit = useCallback(async () => {
    if (images.length === 0) {
      setError(t("quickCapture.imageRequiredError"));
      return;
    }
    if (queueFull) {
      setError(t("quickCapture.queueFullError"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const imageUrls = await resolveUploadedUrls(uploadImage, `products/${sellerId}`);
      await submitProductDraft(sellerId, { imageUrls, rawHint });
      setSuccess(true);
      resetImages();
      setRawHint("");
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError(err.message || t("quickCapture.submitError"));
    } finally {
      setSubmitting(false);
    }
  }, [images.length, queueFull, resolveUploadedUrls, uploadImage, sellerId, rawHint, resetImages, t]);

  const isBusy = submitting || uploading;

  return (
    <div className="rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/25 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
          {isBusy ? <Loader2 size={16} className="animate-spin" /> : success ? <Check size={16} /> : <Sparkles size={16} />}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black text-indigo-700 dark:text-indigo-300">{t("quickCapture.cardTitle")}</p>
          <p className="text-[10px] text-indigo-500/80 dark:text-indigo-400/70 font-medium">{t("quickCapture.cardSubtitle")}</p>
        </div>
      </div>

      <MultiImageUploadCard
        images={images}
        disabled={isBusy}
        onAddFiles={addFiles}
        onRemoveImage={removeImage}
        onSetThumbnail={setThumbnail}
      />

      <textarea
        value={rawHint}
        onChange={(e) => setRawHint(e.target.value)}
        placeholder={t("quickCapture.hintPlaceholder")}
        rows={2}
        disabled={isBusy}
        className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-60"
      />

      {error && <p className="text-[11px] text-rose-500 font-semibold">{error}</p>}
      {queueFull && !error && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">{t("quickCapture.queueFullError")}</p>
      )}

      {uploading && (
        <div className="h-1.5 rounded-full bg-white/60 dark:bg-slate-800 overflow-hidden">
          <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isBusy || images.length === 0 || queueFull}
        className="w-full h-11 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm shadow-indigo-600/30 active:scale-[0.98] transition-transform disabled:opacity-50"
      >
        {isBusy ? <Loader2 size={14} className="animate-spin" /> : success ? <Check size={14} /> : null}
        {isBusy ? t("quickCapture.submitting") : success ? t("quickCapture.submitted") : t("quickCapture.submitButton")}
      </button>

      <p className="text-[10px] text-indigo-500/70 dark:text-indigo-400/60 text-center leading-relaxed">
        {t("quickCapture.processingNote", { hour: processHourLabel })}
      </p>
    </div>
  );
};

export default QuickAddAICard;
