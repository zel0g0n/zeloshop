import { useState, useCallback, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, X, ImageOff, Loader2, Sparkles } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { useProductDrafts } from "@/hooks/seller/useProductDrafts";
import { getEffectiveCategoriesForStore } from "@/config/categoryCustomization";
import CustomSelect from "@/components/ui/CustomSelect";
import addProduct from "@/services/products/addProduct";
import { rejectProductDraft, markDraftApproved } from "@/services/products/productDrafts";

/**
 * AI'ning taklif qilgan kategoriyasini HAQIQIY (tasdiqlangan)
 * kategoriyalar ro'yxatiga moslaydi - AI matnidan hech qachon
 * to'g'ridan-to'g'ri, tekshirilmagan qiymat saqlanmaydi.
 *
 * MUHIM TUZATISH: backend prompti (`functions/productDrafts.js`)
 * endi AI'dan ANIQ shu ro'yxatdagi nomlardan BITTASINI (aynan shu
 * yozilishda) qaytarishni so'raydi - shuning uchun AVVAL ANIQ
 * (katta-kichik harfga sezgir bo'lmagan) mosликни tekshiramiz.
 * Eski, tasodifiy (masalan ingliz tilidagi "Skincare" kabi) javoblar
 * bilan orqaga moslik uchun, aniq moslik topilmasa, oldingi
 * "qism-satr" (substring) taxminiga qaytamiz.
 */
export function matchClosestCategory(aiCategory, categories) {
  if (!categories || categories.length === 0) return "";
  if (!aiCategory) return categories[0].value;
  const normalized = aiCategory.trim().toLowerCase();

  const exact = categories.find((c) => c.value.toLowerCase() === normalized);
  if (exact) return exact.value;

  const found = categories.find(
    (c) => c.value.toLowerCase().includes(normalized) || normalized.includes(c.value.toLowerCase())
  );
  return found ? found.value : categories[0].value;
}

// Har bir qoralama kartochkasi - MEMO qilingan, alohida holatga ega
// (mustaqil tahrirlanadi) - bitta kartochkani tasdiqlash/o'zgartirish
// boshqa kartochkalarni QAYTA CHIZISHGA sabab bo'lmaydi.
const DraftCard = memo(({ draft, categories, sellerId, onDone, t }) => {
  const [name, setName] = useState(draft.aiName || draft.rawHint || "");
  const [description, setDescription] = useState(draft.aiDescription || "");
  const [category, setCategory] = useState(() => matchClosestCategory(draft.aiCategory, categories));
  const [costPrice, setCostPrice] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Eski qoralamalar BITTA `imageUrl` (satr) bilan yozilgan edi, endi
  // yangilari `imageUrls` (4 tagacha rasm massivi) bilan yoziladi -
  // ikkalasini ham qo'llab-quvvatlaymiz. `useMemo` - har renderda
  // yangi massiv yaratilib, pastdagi `useCallback`ni keraksiz qayta
  // yaratmasligi uchun.
  const imageUrls = useMemo(
    () =>
      Array.isArray(draft.imageUrls) && draft.imageUrls.length > 0
        ? draft.imageUrls
        : draft.imageUrl
        ? [draft.imageUrl]
        : [],
    [draft.imageUrls, draft.imageUrl]
  );

  const handleApprove = useCallback(async () => {
    if (!name.trim()) {
      setError(t("productDraftReview.nameRequiredError"));
      return;
    }
    if (!price || Number(price) <= 0) {
      setError(t("productDraftReview.priceRequiredError"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addProduct(
        {
          title: name.trim(),
          category,
          price: Number(price),
          costPrice: Number(costPrice) || 0,
          stock: Number(stock) || 0,
          description,
          images: imageUrls,
          // 15-NICHE UNIVERSAL PLATFORMA: AI (`functions/productDrafts.js`)
          // sxema bo'yicha tekshirilgan atributlarni (`aiAttributes`)
          // qoralamaga yozgan bo'lishi mumkin - tasdiqlanganda ular
          // to'g'ridan-to'g'ri mahsulotning `attributes` maydoniga
          // o'tadi (sotuvchi keyinroq "Tahrirlash" orqali ko'rib,
          // kerak bo'lsa o'zgartirishi mumkin).
          attributes: draft.aiAttributes || {},
        },
        sellerId
      );
      await markDraftApproved(sellerId, draft.id);
      onDone(draft.id);
    } catch (err) {
      setError(err.message || t("productDraftReview.saveError"));
      setSaving(false);
    }
  }, [draft, name, category, costPrice, price, stock, description, imageUrls, sellerId, onDone, t]);

  const handleReject = useCallback(async () => {
    setSaving(true);
    try {
      await rejectProductDraft(sellerId, draft.id);
      onDone(draft.id);
    } catch {
      setSaving(false);
    }
  }, [sellerId, draft.id, onDone]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex gap-3">
        {imageUrls.length > 0 ? (
          <div className="flex gap-1.5 shrink-0">
            {imageUrls.slice(0, 4).map((url, idx) => (
              <div key={url + idx} className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <img src={url} alt={name ? `${name} (${idx + 1})` : ""} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <div className="w-20 h-20 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden flex items-center justify-center">
            <ImageOff size={18} className="text-slate-300 dark:text-slate-600" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wide flex items-center gap-1">
            <Sparkles size={10} /> {t("productDraftReview.aiPreparedLabel")}
          </p>
          {draft.rawHint && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{t("productDraftReview.yourNoteLabel")}: {draft.rawHint}</p>}
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{t("productDraftReview.nameLabel")}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mt-1 h-10 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{t("productDraftReview.descriptionLabel")}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full mt-1 px-3 py-2 bg-[#F4F5F9] dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
        />
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{t("productDraftReview.categoryLabel")}</label>
        <CustomSelect
          value={category}
          onChange={setCategory}
          options={categories}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{t("productDraftReview.costPriceLabel")}</label>
          <input
            type="number"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            placeholder="0"
            className="w-full mt-1 h-10 px-2.5 bg-[#F4F5F9] dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{t("productDraftReview.priceLabel")}</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
            className="w-full mt-1 h-10 px-2.5 bg-[#F4F5F9] dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{t("productDraftReview.stockLabel")}</label>
        <input
          type="number"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          placeholder="0"
          className="w-full mt-1 h-10 px-2.5 bg-[#F4F5F9] dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {error && <p className="text-[11px] text-rose-500 font-semibold">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleReject}
          disabled={saving}
          className="flex-1 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <X size={14} /> {t("productDraftReview.rejectButton")}
        </button>
        <button
          type="button"
          onClick={handleApprove}
          disabled={saving}
          className="flex-[2] h-11 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {t("productDraftReview.approveButton")}
        </button>
      </div>
    </div>
  );
});
DraftCard.displayName = "DraftCard";

const ProductDraftReview = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId, store } = useSession();
  const { readyForReview, queued, loading } = useProductDrafts(sellerId);
  const categories = getEffectiveCategoriesForStore(store);

  // Tasdiqlangan/rad etilgan kartochka DARHOL ekrandan yo'qolishi
  // uchun - jonli tinglovchi (`onSnapshot`) baribir tez orada shu
  // holatni tasdiqlaydi, lekin bu, foydalanuvchiga DARHOL fikr-
  // mulohaza (feedback) beradi, kichik kechikishni kutmasdan.
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const handleDone = useCallback((draftId) => {
    setDismissedIds((prev) => new Set(prev).add(draftId));
  }, []);

  const visibleDrafts = readyForReview.filter((d) => !dismissedIds.has(d.id));

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
          <h1 className="text-sm font-black text-slate-800 dark:text-white truncate">{t("productDraftReview.pageTitle")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">
            {visibleDrafts.length} {t("productDraftReview.pendingSuffix")}
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4 pb-36">
        {loading ? (
          <div className="h-64 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">{t("productAnalytics.loading")}</div>
        ) : visibleDrafts.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-center px-6">
            <Sparkles size={28} className="text-slate-300 dark:text-slate-600" />
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {queued.length > 0
                ? t("productDraftReview.stillProcessingMessage", { count: queued.length })
                : t("productDraftReview.emptyMessage")}
            </p>
          </div>
        ) : (
          visibleDrafts.map((draft) => (
            <DraftCard key={draft.id} draft={draft} categories={categories} sellerId={sellerId} onDone={handleDone} t={t} />
          ))
        )}
      </div>
    </div>
  );
};

export default ProductDraftReview;
