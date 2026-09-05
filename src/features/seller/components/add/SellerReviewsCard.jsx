import React, { useState, useEffect, useCallback } from "react";
import { Star, Pin, Trash2, MessageSquare } from "lucide-react";
import { subscribeToProductReviews, moderateProductReview } from "@/services/reviews/reviewService";
import { useLanguage } from "@/context/LanguageContext";

const StarRow = ({ value }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} size={11} className={n <= value ? "text-amber-400" : "text-slate-300 dark:text-slate-700"} fill={n <= value ? "currentColor" : "none"} />
    ))}
  </div>
);

/**
 * Sotuvchi — mahsulot tahrirlash sahifasida, o'sha mahsulotga
 * qoldirilgan sharhlarni ko'radi va boshqaradi (bitta sharhni
 * "tanlangan" (pin) qilib birinchi o'ringa chiqarish, yoki noo'rin
 * sharhni o'chirish).
 */
const SellerReviewsCard = ({ productId }) => {
  const { t } = useLanguage();
  const [reviews, setReviews] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!productId) return;
    const unsubscribe = subscribeToProductReviews(productId, setReviews, () => {});
    return () => unsubscribe();
  }, [productId]);

  const handleTogglePin = useCallback(async (review) => {
    setBusyId(review.id);
    setError(null);
    try {
      await moderateProductReview(productId, review.id, review.pinned ? "unpin" : "pin");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }, [productId]);

  const handleDelete = useCallback(async (reviewId) => {
    setBusyId(reviewId);
    setError(null);
    try {
      await moderateProductReview(productId, reviewId, "delete");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }, [productId]);

  if (!productId) return null;

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
      <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
        {t("sellerProductForm.reviewsLabel")} ({reviews.length})
      </label>

      {error && <p className="text-[11px] text-rose-500 font-semibold">{error}</p>}

      {reviews.length === 0 ? (
        <div className="flex items-center gap-2 py-3 text-xs text-slate-400 dark:text-slate-500">
          <MessageSquare size={14} /> {t("sellerProductForm.noReviews")}
        </div>
      ) : (
        <div className="space-y-2">
          {reviews.map((r) => (
            <div key={r.id} className="p-2.5 bg-[#F4F5F9] dark:bg-slate-800 rounded-xl">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-bold text-slate-800 dark:text-white truncate">{r.customerName}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleTogglePin(r)}
                    disabled={busyId === r.id}
                    title={r.pinned ? t("sellerProductForm.unpinTitle") : t("sellerProductForm.pinTitle")}
                    className={`w-6 h-6 rounded-lg flex items-center justify-center disabled:opacity-40 ${
                      r.pinned ? "bg-indigo-600 text-white" : "bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    <Pin size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    disabled={busyId === r.id}
                    title={t("sellerProductForm.removeTitle")}
                    className="w-6 h-6 rounded-lg bg-white dark:bg-slate-900 text-rose-500 flex items-center justify-center disabled:opacity-40"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              <StarRow value={r.rating} />
              {r.text && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{r.text}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default React.memo(SellerReviewsCard);
