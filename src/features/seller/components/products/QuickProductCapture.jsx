import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Check, X, Loader2 } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { useUploadImage } from "@/hooks/storage/useUploadStorage";
import { submitProductDraft } from "@/services/products/productDrafts";
import { useProductDrafts } from "@/hooks/seller/useProductDrafts";

/**
 * "TEZ QO'SHISH" — AI CEO 2-bosqichining kirish nuqtasi. ATAYLAB
 * to'liq "Yangi mahsulot" formasidan (nom, narx, ombor, tavsif...)
 * FARQLI - bu yerda FAQAT rasm + bir og'iz izoh so'raladi. Butun
 * qiymati shunda: sotuvchi kunning istalgan vaqtida, 10 soniyada,
 * ko'p o'ylamasdan "navbatga" qo'yadi; AI (kechqurun) qolganini
 * to'ldiradi, sotuvchi keyin ko'rib chiqib tasdiqlaydi.
 *
 * MUHIM: narx SO'RALMAYDI - bu yerda ham, keyingi bosqichda ham
 * (AI CEO tomonidan) - narx faqat SHARHLASH ekranida, sotuvchining
 * o'zi tomonidan kiritiladi.
 */
const QuickProductCapture = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId, store } = useSession();
  const { uploadImage, progress, loading: uploading } = useUploadImage();
  const fileInputRef = useRef(null);

  // XAVFSIZLIK CHEGARASI: server tomonida (`processProductDrafts`)
  // bitta yugurishda ENG KO'PI BILAN 30 ta qoralama qayta ishlanadi -
  // shu bilan mos, mijoz tomonida ham navbat ALLAQACHON to'lib
  // qolgan bo'lsa, YANGI qo'shishga to'sqinlik qilamiz (aks holda
  // sotuvchi cheksiz qo'sha berib, navbatni kerak bo'lganidan ko'p
  // "shishirib" qo'yishi mumkin edi).
  const MAX_QUEUED_DRAFTS = 30;
  const { queued } = useProductDrafts(sellerId);
  const queueFull = queued.length >= MAX_QUEUED_DRAFTS;

  const [imageFile, setImageFile] = useState(null);

  // MUHIM TUZATISH (foydalanuvchi topgan nomuvofiqlik): OLDIN bu
  // sahifada "soat 21:00 atrofida" degan matn QATTIQ YOZILGAN edi -
  // sotuvchi AI CEO sahifasida (`AiCeoInfoPage.jsx`) BOSHQA vaqt
  // tanlagan bo'lsa ham, bu YERDA hamon "21:00" ko'rsatilardi.
  // Endi - sotuvchining HAQIQIY tanlagan soati (`aiCeoDraftProcessHour`)
  // ko'rsatiladi - backend (`processProductDrafts`) bilan BIR XIL
  // standart qiymat (21) ishlatiladi, agar sotuvchi hali hech narsa
  // tanlamagan bo'lsa.
  const processHour = Number.isInteger(store?.aiCeoDraftProcessHour) ? store.aiCeoDraftProcessHour : 21;
  const processHourLabel = `${String(processHour).padStart(2, "0")}:00`;
  const [imagePreview, setImagePreview] = useState(null);
  const [rawHint, setRawHint] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handlePickImage = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError(null);
  }, []);

  const handleRemoveImage = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
  }, []);

  const resetForm = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
    setRawHint("");
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!imageFile) {
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
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile, `products/${sellerId}`);
      }
      await submitProductDraft(sellerId, { imageUrl, rawHint });
      setSuccess(true);
      resetForm();
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err.message || t("quickCapture.submitError"));
    } finally {
      setSubmitting(false);
    }
  }, [rawHint, imageFile, sellerId, uploadImage, resetForm, t, queueFull]);

  const isBusy = submitting || uploading;

  return (
    <div className="h-screen overflow-y-auto bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased transition-colors duration-300">

      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-transform shrink-0"
        >
          <ArrowLeft size={17} />
        </button>
        <div className="min-w-0">
          <h1 className="text-sm font-black text-slate-800 dark:text-white truncate">{t("quickCapture.pageTitle")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">{t("quickCapture.subtitle")}</p>
        </div>
      </div>

      <div className="p-4 space-y-4 pb-36">
        <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl p-3.5">
          <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 leading-relaxed">{t("quickCapture.explainer")}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4">
          {imagePreview ? (
            <div className="relative">
              <img src={imagePreview} alt="" className="w-full h-48 object-cover rounded-xl" />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-40 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500"
            >
              <Camera size={24} />
              <span className="text-xs font-bold">{t("quickCapture.addPhoto")}</span>
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePickImage} />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-2">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {t("quickCapture.hintLabel")} <span className="text-slate-300 dark:text-slate-600 font-normal">({t("quickCapture.optionalLabel")})</span>
          </label>
          <textarea
            value={rawHint}
            onChange={(e) => setRawHint(e.target.value)}
            placeholder={t("quickCapture.hintPlaceholder")}
            rows={3}
            className="w-full px-3 py-2.5 bg-[#F4F5F9] dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          />
        </div>

        {error && <p className="text-xs text-rose-500 font-semibold text-center">{error}</p>}

        {queueFull && !error && (
          <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold text-center">
            {t("quickCapture.queueFullError")}
          </p>
        )}

        {uploading && (
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isBusy || !imageFile || queueFull}
          className="w-full h-12 rounded-2xl bg-indigo-600 text-white text-sm font-black flex items-center justify-center gap-2 shadow-md shadow-indigo-600/30 disabled:opacity-50"
        >
          {isBusy ? <Loader2 size={16} className="animate-spin" /> : success ? <Check size={16} /> : null}
          {isBusy ? t("quickCapture.submitting") : success ? t("quickCapture.submitted") : t("quickCapture.submitButton")}
        </button>

        <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center leading-relaxed">{t("quickCapture.processingNote", { hour: processHourLabel })}</p>
      </div>
    </div>
  );
};

export default QuickProductCapture;
