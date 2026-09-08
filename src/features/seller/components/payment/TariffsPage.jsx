import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Sparkles, Send, Zap, Clock } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import { useSession } from "@/context/SessionContext";
import StatusModal from "@/components/ui/StatusModal";
import { useLanguage } from "@/context/LanguageContext";
import startTariffTrial from "@/services/tariffs/startTariffTrial";
import {
  TARIFF_LIMITS, TRIAL_DAYS, getEffectiveTariffPlan, getNextTrialTier,
  hasUsedTrial, hasActiveTrial, getTrialExpiresAtMs, normalizeTariffPlan,
} from "@/utils/tariffLimits";

// Platforma o'zining to'lov yig'ish tizimiga ega emas — arxitektura
// ataylab markazlashtirilmagan: har bir sotuvchi o'z Click/Payme
// hisobini ulaydi, pul to'g'ridan-to'g'ri sotuvchiga tushadi. Shuning
// uchun bu yerda "sotib olish" tugmasi yo'q — soxta to'lov oqimi
// yaratish o'rniga, sotuvchi qiziqishi admin'ga xabar sifatida
// yuboriladi (mavjud `contactAdmin` Cloud Function, o'zgartirilmagan).
//
// 2026-09 (tarif tanlashni to'liq ishga tushirish bo'limi): sahifa
// endi Z-Tariflar artefaktida (`/tmp/artifacts/z-tariflar.html`)
// FOYDALANUVCHI BILAN TASDIQLANGAN 3 bosqichli tuzilmani ko'rsatadi -
// Z-Start (bepul) / Z-Pro (199 000 so'm/oy) / Z-Biznes (≈349 000
// so'm/oy, narx hali yakunlanmagan). Endi bu — FAQAT ko'rsatish EMAS:
// xodim/banner/aksiya/promo kod limitlari VA AI CEO'ga kirish HAQIQIY
// `sellers.tariffPlan`ga bog'liq (`firestore.rules` + Cloud
// Functions). Sotuvchi bu yerdan 7 kunlik BEPUL SINOVNI o'zi
// boshlashi mumkin (har bir tarif faqat bir marta) - HAQIQIY (pullik)
// tarifga o'tish esa hamon admin bilan bog'lanish orqali (real
// markazlashtirilgan to'lov tizimi hali yo'q).
const PLAN_ORDER = ["start", "pro", "biznes"];

const PLANS = [
  {
    id: "start",
    nameKey: "planStartName",
    priceKey: "planStartPrice",
    featureKeys: [
      "startFeature1", "startFeature2", "startFeature3", "startFeature4",
      "startFeature5", "startFeature6", "startFeature7",
    ],
    accent: "slate",
  },
  {
    id: "pro",
    nameKey: "planProName",
    priceKey: "planProPrice",
    periodKeys: ["planProPriceQuarter", "planProPriceHalfYear", "planProPriceYear"],
    cumulativeFromKey: "planStartName",
    featureKeys: [
      "proFeature1", "proFeature2", "proFeature3", "proFeature4",
      "proFeature5", "proFeature6", "proFeature7", "proFeature8",
    ],
    accent: "indigo",
    recommended: true,
  },
  {
    id: "biznes",
    nameKey: "planBiznesName",
    priceKey: "planBiznesPrice",
    periodKeys: ["planBiznesPriceQuarter", "planBiznesPriceHalfYear", "planBiznesPriceYear"],
    cumulativeFromKey: "planProName",
    featureKeys: ["biznesFeature1", "biznesFeature2"],
    accent: "amber",
    // 2026-09: Z-Biznes hali TO'LIQ ishga tushirilmagan (Buyruq Markazi/
    // Avtomatlashtirish/Mijozlar razvedkasi kabi bo'limlar mavjud, lekin
    // tarif rasmiy ravishda "sotuvda" emas) — shu sabab "tavsiya etiladi"
    // o'rniga ishlab chiqilayotgani haqida belgi ko'rsatiladi.
    inDevelopment: true,
  },
];

// MUHIM: Tailwind JIT dinamik shablon satrlarni (masalan
// `text-${accent}-600`) "ko'ra olmaydi" — loyihaning o'rnatilgan
// qoidasiga ko'ra rang klasslari LOOKUP-OBYEKT orqali beriladi.
const ACCENT_CLASSES = {
  slate: {
    card: "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800",
    title: "text-slate-800 dark:text-white",
    price: "text-slate-800 dark:text-white",
    badge: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
    check: "bg-slate-100 dark:bg-slate-800 text-slate-500",
    text: "text-slate-600 dark:text-slate-300",
    muted: "text-slate-400 dark:text-slate-500",
    btn: "bg-slate-800 hover:bg-slate-900 text-white",
    trialBtn: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200",
  },
  indigo: {
    card: "bg-gradient-to-br from-[#5346E0] to-[#4338CA] border-transparent shadow-lg shadow-indigo-600/20",
    title: "text-white",
    price: "text-white",
    badge: "bg-white/15 text-white",
    check: "bg-white/15 text-white",
    text: "text-white/90",
    muted: "text-indigo-200/90",
    btn: "bg-white text-indigo-700",
    trialBtn: "bg-white/15 text-white",
  },
  amber: {
    card: "bg-white dark:bg-slate-900 border-amber-100 dark:border-amber-500/20",
    title: "text-amber-700 dark:text-amber-300",
    price: "text-slate-800 dark:text-white",
    badge: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
    check: "bg-amber-50 dark:bg-amber-500/10 text-amber-500",
    text: "text-slate-600 dark:text-slate-300",
    muted: "text-slate-400 dark:text-slate-500",
    btn: "bg-amber-600 hover:bg-amber-700 text-white",
    trialBtn: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
};

function formatDaysRemaining(expiresAtMs) {
  const ms = expiresAtMs - Date.now();
  const days = Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  return days;
}

const TariffsPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { store, patchStore } = useSession();

  const basePlan = normalizeTariffPlan(store?.tariffPlan);
  const effectivePlan = getEffectiveTariffPlan(store);
  const currentPlanIndex = PLAN_ORDER.indexOf(effectivePlan);
  const activeTrial = hasActiveTrial(store);
  const nextTrialTier = getNextTrialTier(basePlan);
  const trialDaysLeft = activeTrial ? formatDaysRemaining(getTrialExpiresAtMs(store)) : 0;

  const [sendingId, setSendingId] = useState(null);
  const [sentPlanId, setSentPlanId] = useState(null);
  const [showSentModal, setShowSentModal] = useState(false);
  const [trialStarting, setTrialStarting] = useState(false);
  const [trialError, setTrialError] = useState(null);
  const [error, setError] = useState(null);

  const handleExpressInterest = useCallback(
    async (plan) => {
      setSendingId(plan.id);
      setError(null);
      try {
        const contactAdmin = httpsCallable(functions, "contactAdmin");
        await contactAdmin({
          category: "pro-interest",
          requestedPlan: plan.id,
          message: t("tariffs.interestMessagePlan", { plan: t(plan.nameKey) }),
        });
        setSentPlanId(plan.id);
        setShowSentModal(true);
      } catch (err) {
        setError(err.message || t("tariffs.sendError"));
      } finally {
        setSendingId(null);
      }
    },
    [t]
  );

  const handleStartTrial = useCallback(async () => {
    setTrialStarting(true);
    setTrialError(null);
    try {
      const result = await startTariffTrial();
      patchStore({
        tariffTrialActive: true,
        tariffTrialPlan: result.trialPlan,
        tariffTrialExpiresAt: result.expiresAtMs,
        tariffTrialsUsed: [...(store?.tariffTrialsUsed || []), result.trialPlan],
        ...(TARIFF_LIMITS[result.trialPlan]?.aiCeoEnabled ? { aiCeoEnabled: true } : {}),
      });
    } catch (err) {
      setTrialError(err.message || t("tariffs.trialError"));
    } finally {
      setTrialStarting(false);
    }
  }, [patchStore, store, t]);

  const trialBannerText = activeTrial
    ? t("tariffs.activeTrialBanner", {
        plan: t(`tariffs.plan${effectivePlan.charAt(0).toUpperCase()}${effectivePlan.slice(1)}Name`),
        days: trialDaysLeft,
      })
    : null;

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-36 transition-colors duration-300">
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">{t("tariffs.title")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("tariffs.subtitle")}</p>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {activeTrial && (
          <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 p-3.5 rounded-2xl flex items-center gap-2.5">
            <Clock size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 leading-relaxed">{trialBannerText}</p>
          </div>
        )}

        {PLANS.map((plan) => {
          const classes = ACCENT_CLASSES[plan.accent] || ACCENT_CLASSES.slate;
          const planIndex = PLAN_ORDER.indexOf(plan.id);
          const isCurrent = planIndex === currentPlanIndex;
          const isAlreadyIncluded = planIndex < currentPlanIndex;
          const isSent = sentPlanId === plan.id;
          const isSending = sendingId === plan.id;

          // "Sinash" tugmasi FAQAT shu tarif - sotuvchining KEYINGI
          // tarifi bo'lsa (bir pog'ona yuqori), faol sinov yo'q bo'lsa,
          // VA bu tarif ILGARI sinalmagan bo'lsa ko'rsatiladi.
          const canTrialThis = plan.id === nextTrialTier && !activeTrial && !hasUsedTrial(store, plan.id);

          return (
            <div key={plan.id} className={`rounded-[24px] p-5 border ${classes.card}`}>
              <div className="flex items-center justify-between mb-1 gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {plan.recommended && <Sparkles size={15} className={classes.title} />}
                  <span className={`text-xs font-black uppercase tracking-wider truncate ${classes.title}`}>{t(`tariffs.${plan.nameKey}`)}</span>
                </div>
                {isCurrent ? (
                  <span className={`shrink-0 text-[9px] font-black px-2 py-1 rounded-md ${classes.badge}`}>
                    {activeTrial && plan.id === effectivePlan && plan.id !== basePlan ? t("tariffs.trialBadge") : t("tariffs.currentBadge")}
                  </span>
                ) : plan.recommended ? (
                  <span className={`shrink-0 text-[9px] font-black px-2 py-1 rounded-md ${classes.badge}`}>{t("tariffs.recommendedBadge")}</span>
                ) : (
                  plan.inDevelopment && (
                    <span className={`shrink-0 text-[9px] font-black px-2 py-1 rounded-md ${classes.badge}`}>{t("tariffs.biznesInDevelopmentBadge")}</span>
                  )
                )}
              </div>

              <p className={`text-lg font-black mb-1 ${classes.price}`}>{t(`tariffs.${plan.priceKey}`)}</p>

              {plan.periodKeys && (
                <div className="flex flex-col gap-0.5 mb-2.5">
                  {plan.periodKeys.map((key) => (
                    <p key={key} className={`text-[10px] font-bold ${classes.muted}`}>{t(`tariffs.${key}`)}</p>
                  ))}
                </div>
              )}

              {plan.cumulativeFromKey && (
                <p className={`text-[11px] mb-2.5 ${classes.muted}`}>
                  {t("tariffs.cumulativeNote", { plan: t(`tariffs.${plan.cumulativeFromKey}`) })}
                </p>
              )}

              <div className="space-y-2 mb-4">
                {plan.featureKeys.map((key) => (
                  <div key={key} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${classes.check}`}>
                      <Check size={11} />
                    </div>
                    <span className={`text-xs font-medium ${classes.text}`}>{t(`tariffs.${key}`)}</span>
                  </div>
                ))}
              </div>

              {canTrialThis && (
                <button
                  type="button"
                  onClick={handleStartTrial}
                  disabled={trialStarting}
                  className={`w-full h-11 mb-2 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-70 ${classes.trialBtn}`}
                >
                  <Zap size={13} /> {trialStarting ? t("tariffs.trialStarting") : t("tariffs.startTrialButton", { days: TRIAL_DAYS })}
                </button>
              )}

              {!isCurrent && !isAlreadyIncluded && (
                <button
                  type="button"
                  onClick={() => handleExpressInterest(plan)}
                  disabled={isSending || isSent}
                  className={`w-full h-11 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-70 ${classes.btn}`}
                >
                  {isSent ? (
                    <><Check size={13} /> {t("tariffs.messageSent")}</>
                  ) : (
                    <><Send size={13} /> {isSending ? t("tariffs.sending") : t("tariffs.expressInterest")}</>
                  )}
                </button>
              )}
            </div>
          );
        })}

        {trialError && <p className="text-[11px] text-rose-500 font-semibold text-center">{trialError}</p>}
        {error && <p className="text-[11px] text-rose-500 font-semibold text-center">{error}</p>}

        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 p-3.5 rounded-2xl">
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <strong>{t("tariffs.noteLabel")}</strong> {t("tariffs.noteText")}
          </p>
        </div>
      </div>

      {showSentModal && (
        <StatusModal
          variant="success"
          title={t("tariffs.sentModalTitle")}
          message={t("tariffs.sentModalMessage", { storeName: store?.storeName || t("tariffs.defaultStoreName") })}
          onClose={() => setShowSentModal(false)}
        />
      )}
    </div>
  );
};

export default TariffsPage;
