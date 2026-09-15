import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Sparkles, Send, Zap, Clock, CreditCard, AlertTriangle, Loader2 } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import { useSession } from "@/context/SessionContext";
import StatusModal from "@/components/ui/StatusModal";
import { useLanguage } from "@/context/LanguageContext";
import startTariffTrial from "@/services/tariffs/startTariffTrial";
import createTariffPayment from "@/services/tariffs/createTariffPayment";
import getTariffPaymentStatus from "@/services/tariffs/getTariffPaymentStatus";
import {
  TARIFF_LIMITS, TRIAL_DAYS, TARIFF_MONTHLY_PRICE_SOM, getEffectiveTariffPlan, getNextTrialTier,
  hasUsedTrial, hasActiveTrial, getTrialExpiresAtMs, normalizeTariffPlan,
  isBillingRequired, isTariffPastDue, isTariffPurchasable, getPaidUntilMs, getGraceExpiresAtMs,
} from "@/utils/tariffLimits";

// UZS narxini "199 000 so'm/oy" shaklida formatlaydi — loyihada
// allaqachon qabul qilingan konvensiya (`Checkout.jsx`, `CartPage.jsx`
// va h.k. — valyuta HAR DOIM "so'm" bilan, UI tilidan qat'i nazar).
function formatSomPerMonth(amountSom) {
  return `${amountSom.toLocaleString()} so'm/oy`;
}

// MUHIM (2026-09, "tarif to'lov tizimini ishga tushirish" bo'limi):
// bu yerdagi "sotib olish" — FAQAT TARIF (Z-Start/Z-Pro) to'lovi,
// Atmos orqali (`functions/atmosPayments.js`). MAHSULOT/CHECKOUT
// to'lovi bilan ADASHTIRMASLIK kerak — u hamon eski, decentralizatsiya-
// lashgan strukturada qoladi (har bir sotuvchi o'z Click/Payme
// hisobini ulaydi, pul to'g'ridan-to'g'ri sotuvchiga tushadi — bu
// yerda hech narsa o'zgarmadi). Tarif puli esa ZeloShop'ning O'ZIGA
// tegishli (xizmat haqi) — shuning uchun markazlashtirilgan, avtomatik
// Atmos to'lovi mantiqan va huquqiy jihatdan toza.
//
// Z-Biznes hamon "ishlab chiqilmoqda" (narx yakunlanmagan) — shuning
// uchun HAMON faqat "qiziqish bildirish" (`contactAdmin`) orqali.
//
// Z-Start ENDI PULLIK (49 000 so'm/oy), LEKIN FAQAT shu o'zgarish
// joriy etilgan sanadan KEYIN ro'yxatdan o'tgan (yangi) sotuvchilarga
// — oldingi (bepul Start'da ishlayotgan) sotuvchilar "grandfather"
// qilinadi (`isBillingRequired`, batafsil izoh: `functions/lib/tariffs.js`).
// Yangi sotuvchilar uchun ham — ro'yxatdan o'tgandan keyingi BIRINCHI
// 7 kun avtomatik bepul (tugma bosish shart emas).
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

/**
 * "Tariflar" bo'limining ICHKI KONTENTI — sarlavha/orqaga tugmasi/
 * tashqi to'liq ekran o'rovisiz.
 *
 * 2026-09 foydalanuvchi so'roviga ko'ra: "To'lov tizimlari"
 * (`PaymentSettingsSection.jsx`) bilan BITTA sahifada, tab-filtr orqali
 * almashtiriladigan ikki bo'lim sifatida birlashtirildi
 * (`PaymentAndTariffsPage.jsx`). Mantiqning O'ZI (tarif kartalari,
 * sinov boshlash, qiziqish yuborish) BU FAYLGA, `TariffsPage.jsx`dan
 * O'ZGARISHSIZ ko'chirildi — faqat tashqi sahifa o'rovi (header/orqaga
 * tugmasi) olib tashlandi.
 */
const TariffsSection = () => {
  const { t } = useLanguage();
  const { store, patchStore } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const basePlan = normalizeTariffPlan(store?.tariffPlan);
  const effectivePlan = getEffectiveTariffPlan(store);
  const currentPlanIndex = PLAN_ORDER.indexOf(effectivePlan);
  const activeTrial = hasActiveTrial(store);
  const nextTrialTier = getNextTrialTier(basePlan);
  const trialDaysLeft = activeTrial ? formatDaysRemaining(getTrialExpiresAtMs(store)) : 0;

  // ATMOS TO'LOVI (2026-09) — batafsil izoh: yuqoridagi fayl sarlavhasi.
  const billingRequired = isBillingRequired(store);
  const pastDue = isTariffPastDue(store);
  const paidUntilMs = getPaidUntilMs(store);
  const graceExpiresAtMs = getGraceExpiresAtMs(store);
  // Sotuvchi hali BIR MARTA ham to'lamagan (hali "sinov" darchasida) —
  // shu holatda muddat ko'rsatkichi to'lov emas, bepul davr tugashini
  // ko'rsatadi.
  const daysUntilDue = billingRequired
    ? formatDaysRemaining(paidUntilMs > 0 ? paidUntilMs : graceExpiresAtMs)
    : null;

  const [sendingId, setSendingId] = useState(null);
  const [sentPlanId, setSentPlanId] = useState(null);
  const [showSentModal, setShowSentModal] = useState(false);
  const [trialStarting, setTrialStarting] = useState(false);
  const [trialError, setTrialError] = useState(null);
  const [error, setError] = useState(null);

  const [payingId, setPayingId] = useState(null);
  const [payError, setPayError] = useState(null);
  const [awaitingCheckoutPlanId, setAwaitingCheckoutPlanId] = useState(null);
  const [paymentResultModal, setPaymentResultModal] = useState(null); // {variant, title, message}
  const [checkingPaymentStatus, setCheckingPaymentStatus] = useState(false);
  const pollAttemptsRef = useRef(0);

  const handlePayNow = useCallback(
    async (plan) => {
      setPayingId(plan.id);
      setPayError(null);
      try {
        const { checkoutUrl } = await createTariffPayment(plan.id);
        setAwaitingCheckoutPlanId(plan.id);
        // Loyihada allaqachon qabul qilingan konvensiya — tashqi
        // havolalar `window.open(..., "_blank")` orqali ochiladi
        // (`ShareStoreModal.jsx`, `ConnectionsPage.jsx` va h.k.).
        window.open(checkoutUrl, "_blank");
      } catch (err) {
        setPayError(err.message || t("tariffs.paymentStartError"));
      } finally {
        setPayingId(null);
      }
    },
    [t]
  );

  // Checkout'dan qaytgach (`?atmosTxn=...`) — to'lov holatini
  // tekshiradi. Webhook AVTORITET manba (Firestore'ni to'g'ridan-to'g'ri
  // yangilaydi) — bu yerdagi so'rov faqat TEZKOR fikr-mulohaza (UI
  // darhol yangilansin) uchun, shuning uchun kechiksa/muvaffaqiyatsiz
  // bo'lsa ham jiddiy muammo emas (sotuvchi sahifani qayta ochganda
  // baribir to'g'ri holatni ko'radi, `verifyTelegramAuth` qayta
  // chaqirilganda).
  useEffect(() => {
    const transactionId = searchParams.get("atmosTxn");
    if (!transactionId) return;

    let cancelled = false;
    pollAttemptsRef.current = 0;
    setCheckingPaymentStatus(true);

    const cleanUrl = () => {
      const next = new URLSearchParams(searchParams);
      next.delete("atmosTxn");
      setSearchParams(next, { replace: true });
    };

    const poll = async () => {
      try {
        const result = await getTariffPaymentStatus(transactionId);
        if (cancelled) return;

        if (result.status === "paid") {
          patchStore({
            tariffPlan: result.plan,
            tariffPaidUntil: result.paidUntilMs,
          });
          setPaymentResultModal({
            variant: "success",
            title: t("tariffs.paymentSuccessTitle"),
            message: t("tariffs.paymentSuccessMessage", { plan: t(`tariffs.plan${result.plan.charAt(0).toUpperCase()}${result.plan.slice(1)}Name`) }),
          });
          setCheckingPaymentStatus(false);
          cleanUrl();
          return;
        }

        pollAttemptsRef.current += 1;
        if (pollAttemptsRef.current < 5) {
          setTimeout(poll, 2500);
        } else {
          setPaymentResultModal({
            variant: "info",
            title: t("tariffs.paymentPendingTitle"),
            message: t("tariffs.paymentPendingMessage"),
          });
          setCheckingPaymentStatus(false);
          cleanUrl();
        }
      } catch (err) {
        if (cancelled) return;
        setPaymentResultModal({
          variant: "info",
          title: t("tariffs.paymentPendingTitle"),
          message: err.message || t("tariffs.paymentPendingMessage"),
        });
        setCheckingPaymentStatus(false);
        cleanUrl();
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
    // Faqat `atmosTxn` o'zgarganda ishga tushishi kerak — `searchParams`/
    // `setSearchParams` har renderda yangi obyekt bo'lishi mumkin,
    // ularni dependency qilish cheksiz tsiklga olib kelardi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("atmosTxn")]);

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
    <>
      <div className="p-4 space-y-3">
        {pastDue && (
          <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 p-3.5 rounded-2xl flex items-center gap-2.5">
            <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 leading-relaxed">{t("tariffs.pastDueBanner")}</p>
          </div>
        )}

        {!pastDue && billingRequired && daysUntilDue !== null && daysUntilDue <= 3 && (
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 p-3.5 rounded-2xl flex items-center gap-2.5">
            <Clock size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 leading-relaxed">
              {t(paidUntilMs > 0 ? "tariffs.dueSoonBanner" : "tariffs.graceSoonBanner", { days: daysUntilDue })}
            </p>
          </div>
        )}

        {activeTrial && (
          <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 p-3.5 rounded-2xl flex items-center gap-2.5">
            <Clock size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 leading-relaxed">{trialBannerText}</p>
          </div>
        )}

        {checkingPaymentStatus && (
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 p-3.5 rounded-2xl flex items-center gap-2.5">
            <Loader2 size={16} className="text-slate-500 dark:text-slate-400 shrink-0 animate-spin" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">{t("tariffs.paymentChecking")}</p>
          </div>
        )}

        {PLANS.map((plan) => {
          const classes = ACCENT_CLASSES[plan.accent] || ACCENT_CLASSES.slate;
          const planIndex = PLAN_ORDER.indexOf(plan.id);
          const isCurrent = planIndex === currentPlanIndex;
          const isAlreadyIncluded = planIndex < currentPlanIndex;
          const isSent = sentPlanId === plan.id;
          const isSending = sendingId === plan.id;
          const isPaying = payingId === plan.id;

          // "Sinash" tugmasi FAQAT shu tarif - sotuvchining KEYINGI
          // tarifi bo'lsa (bir pog'ona yuqori), faol sinov yo'q bo'lsa,
          // VA bu tarif ILGARI sinalmagan bo'lsa ko'rsatiladi.
          const canTrialThis = plan.id === nextTrialTier && !activeTrial && !hasUsedTrial(store, plan.id);

          // HAQIQIY TO'LOV (Atmos) — bu tarif to'g'ridan-to'g'ri
          // sotib olinishi mumkinmi. `isCurrent`dan QAT'I NAZAR
          // ko'rsatiladi (renewal/oldindan to'lash uchun ham kerak) —
          // faqat sotuvchi ALLAQACHON yuqoriroq tarifda bo'lsa (masalan
          // Z-Biznes'dagi sotuvchiga Z-Pro to'lovi ma'nosiz) yashiriladi.
          // Z-Start uchun esa FAQAT billing talab qilinadigan (yangi)
          // sotuvchilarga (grandfather qilinganlar uchun hamon bepul).
          const canPayThis = isTariffPurchasable(plan.id) && !isAlreadyIncluded && (plan.id !== "start" || billingRequired);

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

              <p className={`text-lg font-black mb-1 ${classes.price}`}>
                {plan.id === "start" && billingRequired
                  ? formatSomPerMonth(TARIFF_MONTHLY_PRICE_SOM.start)
                  : t(`tariffs.${plan.priceKey}`)}
              </p>
              {plan.id === "start" && billingRequired && (
                <p className={`text-[10px] font-bold mb-1.5 ${classes.muted}`}>{t("tariffs.startGraceNote", { days: TRIAL_DAYS })}</p>
              )}

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

              {canPayThis && (
                <button
                  type="button"
                  onClick={() => handlePayNow(plan)}
                  disabled={isPaying}
                  className={`w-full h-11 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-70 ${classes.btn}`}
                >
                  {isPaying ? (
                    <><Loader2 size={13} className="animate-spin" /> {t("tariffs.paymentStarting")}</>
                  ) : (
                    <><CreditCard size={13} /> {isCurrent ? t("tariffs.payRenewButton") : t("tariffs.payButton")}</>
                  )}
                </button>
              )}
              {canPayThis && awaitingCheckoutPlanId === plan.id && (
                <p className={`text-[10px] font-semibold mt-1.5 text-center ${classes.muted}`}>{t("tariffs.checkoutOpenedHint")}</p>
              )}

              {!canPayThis && !isCurrent && !isAlreadyIncluded && (
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
        {payError && <p className="text-[11px] text-rose-500 font-semibold text-center">{payError}</p>}
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

      {paymentResultModal && (
        <StatusModal
          variant={paymentResultModal.variant}
          title={paymentResultModal.title}
          message={paymentResultModal.message}
          onClose={() => setPaymentResultModal(null)}
        />
      )}
    </>
  );
};

export default TariffsSection;
