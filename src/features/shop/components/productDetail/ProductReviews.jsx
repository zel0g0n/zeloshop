import { useState, useEffect, useCallback } from "react";
import { Star, MessageSquare, Share2, Loader2, Check } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { subscribeToProductReviews, submitProductReview, getMyProductReview } from "@/services/reviews/reviewService";

const StarRow = ({ value, size = 14, interactive = false, onChange }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type={interactive ? "button" : undefined}
        disabled={!interactive}
        onClick={interactive ? () => onChange(n) : undefined}
        className={interactive ? "active:scale-90 transition-transform" : ""}
      >
        <Star
          size={size}
          className={n <= value ? "text-amber-400" : "text-slate-300 dark:text-slate-700"}
          fill={n <= value ? "currentColor" : "none"}
        />
      </button>
    ))}
  </div>
);

const formatDate = (createdAt) => {
  if (!createdAt) return "";
  const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return date.toLocaleDateString("uz-UZ", { day: "2-digit", month: "long" });
};

const ProductReviews = ({ product }) => {
  const { clientId } = useSession();
  const { t } = useLanguage();
  const [reviews, setReviews] = useState([]);
  const [myExistingReview, setMyExistingReview] = useState(null);
  const [myRating, setMyRating] = useState(0);
  const [myText, setMyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    if (!product?.id) return;
    const unsubscribe = subscribeToProductReviews(product.id, setReviews, () => {});
    return () => unsubscribe();
  }, [product?.id]);

  // MUHIM: "men allaqachon sharh qoldirganmanmi" tekshiruvi endi
  // yuqoridagi (chegaralangan) `reviews` ro'yxatidan EMAS, balki
  // alohida, to'g'ridan-to'g'ri ID bo'yicha o'qishdan keladi — batafsil
  // izoh `reviewService.js`dagi `getMyProductReview`da. Shunda mashhur
  // mahsulotda mijozning ESKI sharhi ro'yxat chegarasidan tashqarida
  // qolib ketsa ham, "allaqachon sharh qoldirgan" holati TO'G'RI aniqlanadi.
  useEffect(() => {
    if (!product?.id || !clientId) {
      setMyExistingReview(null);
      return;
    }
    let cancelled = false;
    getMyProductReview(product.id, clientId)
      .then((review) => {
        if (!cancelled) setMyExistingReview(review);
      })
      .catch(() => {
        // Xato bo'lsa ham forma ko'rsatilaveradi — mijoz eng yomon
        // holatda sharhini qayta yuborishi mumkin (backend `.set()`
        // bilan yangilaydi, xato/dublikat yaratmaydi).
      });
    return () => {
      cancelled = true;
    };
  }, [product?.id, clientId]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (myRating === 0) {
      setSubmitError(t("productDetail.reviewsRatingRequired"));
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      // MUHIM (2026-09 dizayn tuzatishi): sharhga rasm biriktirish
      // qismi olib tashlandi - shuning uchun endi doim bo'sh massiv
      // bilan yuboriladi (`submitProductReview`ning 4-parametri
      // ixtiyoriy, standart qiymati ham `[]`).
      await submitProductReview(product.id, myRating, myText);
      setSubmitted(true);
      setMyRating(0);
      setMyText("");
    } catch (err) {
      setSubmitError(err.message || "Sharh yuborishda xatolik yuz berdi.");
    } finally {
      setSubmitting(false);
    }
  }, [product, myRating, myText, t]);

  const handleShare = useCallback(async () => {
    const shareData = {
      title: product?.title || product?.name,
      text: `${product?.title || product?.name} — ZeloShop'da ko'ring`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      }
    } catch {
      // Foydalanuvchi ulashishni bekor qilgan bo'lishi mumkin — bu xato emas.
    }
  }, [product]);

  const averageRating = Number(product?.averageRating) || 0;
  const reviewCount = Number(product?.reviewCount) || reviews.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StarRow value={Math.round(averageRating)} />
          <span className="text-sm font-black text-slate-800 dark:text-white">
            {averageRating > 0 ? averageRating.toFixed(1) : "—"}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">({reviewCount} {t("productDetail.reviewsCountSuffix")})</span>
        </div>
        <button
          type="button"
          onClick={handleShare}
          className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-xl active:scale-95 transition-transform"
        >
          <Share2 size={13} /> {shareCopied ? t("productDetail.reviewsCopied") : t("productDetail.reviewsShare")}
        </button>
      </div>

      {/* SHARH QOLDIRISH FORMASI */}
      {!myExistingReview && (
        submitted ? (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <Check size={15} /> {t("productDetail.reviewsThanks")}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2.5">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{t("productDetail.reviewsWriteTitle")}</p>
            <StarRow value={myRating} size={22} interactive onChange={setMyRating} />
            <textarea
              rows="2"
              disabled={submitting}
              value={myText}
              onChange={(e) => setMyText(e.target.value)}
              placeholder={t("productDetail.reviewsPlaceholder")}
              className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-60"
            />

            {submitError && <p className="text-[11px] text-rose-500 font-semibold">{submitError}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-9 bg-indigo-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : t("productDetail.reviewsSubmit")}
            </button>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
              {t("productDetail.reviewsPurchaseOnly")}
            </p>
          </form>
        )
      )}

      {/* SHARHLAR RO'YXATI */}
      {reviews.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-6 text-center">
          <MessageSquare size={20} className="text-slate-300 dark:text-slate-700" />
          <p className="text-xs text-slate-400 dark:text-slate-500">{t("productDetail.reviewsEmpty")}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {reviews.map((r) => (
            <div key={r.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black text-[11px] flex items-center justify-center">
                    {(r.customerName || "?").charAt(0).toUpperCase()}
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-white">{r.customerName}</span>
                  {r.pinned && (
                    <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded-md">{t("productDetail.reviewsPinned")}</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatDate(r.createdAt)}</span>
              </div>
              <StarRow value={r.rating} size={12} />
              {r.text && <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">{r.text}</p>}
              {Array.isArray(r.photoUrls) && r.photoUrls.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2">
                  {r.photoUrls.map((url) => (
                    <img
                      key={url}
                      src={url}
                      alt={t("productDetail.reviewPhotoAlt")}
                      className="w-14 h-14 object-cover rounded-lg border border-slate-100 dark:border-slate-800"
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductReviews;
