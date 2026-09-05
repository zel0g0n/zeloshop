import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, TrendingUp, TrendingDown, Check, X, Loader2, ShieldAlert } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { usePricingSuggestions } from "@/hooks/seller/usePricingSuggestions";
import updateSeller from "@/services/sellers/updateSeller";
import { useLanguage } from "@/context/LanguageContext";

/**
 * "AI NARX TAVSIYALARI" (dynamic pricing, TAKLIF SHAKLIDA).
 *
 * MUHIM, ATAYLAB QILINGAN QAROR (batafsil izoh: `functions/
 * pricingSuggestions.js`): bu sahifa HECH QACHON mahsulot narxini
 * o'zi o'zgartirmaydi. Har bir qatordagi tavsiya — AI CEO haftalik
 * tahlili asosida hisoblangan TAKLIF, xolos. Narx FAQAT sotuvchi
 * "Qo'llash" tugmasini ANIQ bosgandagina o'zgaradi — server bu
 * paytda mahsulotning HOZIRGI holatidan tavsiyani QAYTA tekshiradi.
 */
const PricingSuggestionsPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId, store, patchStore } = useSession();
  const { suggestions, loading, error, apply, dismiss } = usePricingSuggestions(sellerId);

  // MUHIM: `store.aiPricingSuggestionsEnabled` — kech keladigan prop
  // (`useSession` boshida `store` hali `null` bo'lishi mumkin). Buni
  // `useState`ga bir marta "urug'" sifatida berish, keyin `useEffect`
  // orqali sinxronlash — eskirgan/noto'g'ri qiymatni "muzlatib qo'yish"
  // xavfini keltirib chiqaradi (`StoryAdImageCard.jsx`da ham xuddi shu
  // naqsh qo'llanilgan). Shuning uchun har renderda faqat OPTIMISTIK
  // ustunlik (`overrideEnabled`, toggle bosilganda) YOKI haqiqiy
  // `store` qiymatidan hisoblanadi — alohida sinxronlash effekti YO'Q.
  const [overrideEnabled, setOverrideEnabled] = useState(null);
  const enabled = overrideEnabled ?? Boolean(store?.aiPricingSuggestionsEnabled);
  const [toggleSaving, setToggleSaving] = useState(false);
  const [toggleError, setToggleError] = useState(null);
  const [busyProductId, setBusyProductId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [appliedIds, setAppliedIds] = useState([]);

  const handleToggle = useCallback(async () => {
    const next = !enabled;
    setOverrideEnabled(next);
    setToggleSaving(true);
    setToggleError(null);
    try {
      await updateSeller(sellerId, { aiPricingSuggestionsEnabled: next });
      patchStore({ aiPricingSuggestionsEnabled: next });
    } catch (err) {
      setOverrideEnabled(null);
      setToggleError(err.message || t("pricingSuggestions.toggleError"));
    } finally {
      setToggleSaving(false);
    }
  }, [enabled, sellerId, patchStore, t]);

  const handleApply = useCallback(async (productId) => {
    setBusyProductId(productId);
    setActionError(null);
    try {
      await apply(productId);
      setAppliedIds((prev) => [...prev, productId]);
    } catch (err) {
      setActionError(err.message || t("pricingSuggestions.applyError"));
    } finally {
      setBusyProductId(null);
    }
  }, [apply, t]);

  const handleDismiss = useCallback(async (productId) => {
    setBusyProductId(productId);
    setActionError(null);
    try {
      await dismiss(productId);
    } catch (err) {
      setActionError(err.message || t("pricingSuggestions.dismissError"));
    } finally {
      setBusyProductId(null);
    }
  }, [dismiss, t]);

  const visibleSuggestions = suggestions.filter((s) => !appliedIds.includes(s.id));
  const aiCeoEnabled = store?.aiCeoEnabled === true;

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-36 transition-colors duration-300">
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">{t("pricingSuggestions.title")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("pricingSuggestions.subtitle")}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {!aiCeoEnabled ? (
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex items-start gap-2.5">
            <ShieldAlert size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t("pricingSuggestions.requiresAiCeo")}</p>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0">
                    <Sparkles size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-black text-slate-800 dark:text-white">{t("pricingSuggestions.enableLabel")}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("pricingSuggestions.enableDesc")}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggle}
                  disabled={toggleSaving}
                  className={`w-11 h-6 rounded-full p-0.5 shrink-0 transition-colors disabled:opacity-60 ${enabled ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`}
                >
                  <span className={`w-5 h-5 rounded-full bg-white block transition-transform ${enabled ? "translate-x-5" : ""}`} />
                </button>
              </div>
              {toggleError && <p className="text-[11px] text-rose-500 font-semibold">{toggleError}</p>}
            </div>

            {enabled && (
              <>
                {loading && (
                  <div className="flex items-center justify-center py-10 text-slate-400 dark:text-slate-500">
                    <Loader2 size={20} className="animate-spin" />
                  </div>
                )}

                {!loading && error && (
                  <p className="text-xs text-rose-500 font-semibold text-center py-6">{error}</p>
                )}

                {!loading && !error && visibleSuggestions.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{t("pricingSuggestions.emptyTitle")}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{t("pricingSuggestions.emptyDesc")}</p>
                  </div>
                )}

                {actionError && (
                  <p className="text-[11px] text-rose-500 font-semibold px-1">{actionError}</p>
                )}

                <div className="space-y-3">
                  {visibleSuggestions.map((suggestion) => {
                    // YANGI (#115): kategoriya-solishtiruv tavsiyalari
                    // (`category_price_low`) HAM narx OSHIRISHNI
                    // anglatishi mumkin - faqat `high_demand_increase`
                    // emas.
                    const isIncrease = suggestion.type === "high_demand_increase" || suggestion.type === "category_price_low";
                    const busy = busyProductId === suggestion.id;
                    return (
                      <div key={suggestion.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={suggestion.productImage || "/placeholder.png"}
                            alt={suggestion.productName}
                            className="w-12 h-12 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{suggestion.productName}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-slate-400 dark:text-slate-500 line-through font-mono">
                                {Number(suggestion.currentPrice).toLocaleString()} so'm
                              </span>
                              <span className={`text-xs font-black font-mono ${isIncrease ? "text-emerald-600 dark:text-emerald-400" : "text-indigo-600 dark:text-indigo-400"}`}>
                                → {Number(suggestion.suggestedPrice).toLocaleString()} so'm
                              </span>
                            </div>
                          </div>
                          <span className={`shrink-0 flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg ${
                            isIncrease
                              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                          }`}>
                            {isIncrease ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                            {suggestion.changePercent > 0 ? "+" : ""}{suggestion.changePercent}%
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed bg-[#F4F5F9] dark:bg-slate-800 rounded-xl p-2.5">
                          {suggestion.reasoning}
                        </p>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleDismiss(suggestion.id)}
                            disabled={busy}
                            className="flex-1 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
                          >
                            <X size={13} /> {t("pricingSuggestions.dismissButton")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApply(suggestion.id)}
                            disabled={busy}
                            className="flex-1 h-10 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
                          >
                            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                            {t("pricingSuggestions.applyButton")}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PricingSuggestionsPage;
