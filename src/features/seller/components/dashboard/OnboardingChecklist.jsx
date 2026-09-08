import { memo, useMemo, useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronDown, X, Store, Package, Truck, Share2, CreditCard, Sparkles } from "lucide-react";
import { buildOnboardingSteps, computeOnboardingProgress } from "@/utils/onboardingChecklist";
import updateSeller from "@/services/sellers/updateSeller";
import { useLanguage } from "@/context/LanguageContext";
import { useSession } from "@/context/SessionContext";

const STEP_ICONS = {
  storeInfo: Store,
  firstProduct: Package,
  deliveryZone: Truck,
  shareStore: Share2,
  paymentInfo: CreditCard,
};

// Har bir qator alohida, memo qilingan - shu orqali, faqat BITTA
// bosqich holati o'zgarganda (masalan mahsulot qo'shilganda), qolgan
// qatorlar QAYTA CHIZILMAYDI (ota komponent `steps` massivini har
// safar useMemo bilan yangi qayta hisoblasa ham, o'zgarmagan
// qatorlar uchun props bir xil qoladi).
const StepRow = memo(({ step, label, onActivate }) => {
  const Icon = STEP_ICONS[step.key];
  return (
    <button
      type="button"
      onClick={() => !step.done && onActivate(step)}
      disabled={step.done}
      className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-colors ${
        step.done ? "bg-emerald-50/60 dark:bg-emerald-500/10" : "bg-slate-50 dark:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800"
      }`}
    >
      <span
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          step.done ? "bg-emerald-500 text-white" : "bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700"
        }`}
      >
        {step.done ? <Check size={15} /> : <Icon size={14} />}
      </span>
      <span className={`flex-1 text-xs font-bold ${step.done ? "text-emerald-700 dark:text-emerald-400 line-through decoration-emerald-400/50" : "text-slate-700 dark:text-slate-200"}`}>
        {label}
      </span>
    </button>
  );
});
StepRow.displayName = "StepRow";

/**
 * SOTUVCHINI FAOLLASHTIRISH (activation) UCHUN — birinchi haftada
 * do'konni to'liq sozlashga yo'naltiruvchi, real ma'lumotga asoslangan
 * qo'llanma. Barcha bosqichlar HAQIQIY holatdan (`store`,
 * `dashboardSummary`) hisoblanadi - hech qanday soxta/qo'lda
 * belgilanadigan bayroq yo'q (bittasidan tashqari - "ulashish",
 * buni avtomatik aniqlashning ishonchli yo'li yo'q).
 *
 * PERFORMANCE: yangi Firestore so'rovi UMUMAN yo'q (`onboardingChecklist.js`
 * qarang). `useMemo` bilan o'ralgan hisob-kitoblar faqat `store`/
 * `dashboardSummary` haqiqatan o'zgarganda qayta ishlaydi.
 *
 * 100% BAJARILGANDA: karta avtomatik yashiriladi (qayta ko'rsatilmaydi) -
 * push-xabar/banner charchatishning oldini oladi. Bajarilmagan holda
 * ham, foydalanuvchi "X" bosib YOPISHI mumkin (avtonomiyani hurmat
 * qilish) - buni ham Firestore'da saqlaymiz, qayta ko'rsatilmaydi.
 */
const OnboardingChecklist = ({ sellerId, store, dashboardSummary, onOpenShareModal }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { patchStore } = useSession();
  const [dismissed, setDismissed] = useState(Boolean(store?.onboardingDismissed));
  const [expanded, setExpanded] = useState(true);

  // MUHIM TUZATISH (haqiqiy production xatosi, o'zim tekshirib
  // topganman): `store` — Dashboard.jsx birinchi render paytida
  // HALI YUKLANMAGAN (null) bo'lishi mumkin, `useState`ning boshlang'ich
  // qiymati esa FAQAT birinchi renderda hisoblanadi. Agar shu paytda
  // `store` hali null bo'lsa, `dismissed` HAR DOIM `false` bo'lib
  // qolar edi - hatto sotuvchi avval checklistni yopgan (Firestore'ga
  // saqlagan) bo'lsa ham, keyingi safar ilovani ochganda karta
  // QAYTA PAYDO BO'LIB QOLARDI. `store` haqiqatan yuklangach, holatni
  // QAYTA sinxronlaymiz - xuddi `MarketingCoupons.jsx`dagi referal/
  // savat-eslatmasi sozlamalari bilan bir xil tamoyil.
  useEffect(() => {
    if (!store) return;
    setDismissed(Boolean(store.onboardingDismissed));
  }, [store]);

  const steps = useMemo(() => buildOnboardingSteps(store, dashboardSummary), [store, dashboardSummary]);
  const progress = useMemo(() => computeOnboardingProgress(steps), [steps]);

  const handleActivate = useCallback(
    (step) => {
      if (step.action === "share") {
        onOpenShareModal?.();
        // MUHIM: "ulashdim" belgisi darhol, ulashish oynasi ochilgan
        // ZAHOTI qo'yiladi (haqiqatan yuborilganini kuzatib bo'lmaydi -
        // Telegram bu haqda hech qanday signal bermaydi). Bu - ataylab
        // "yumshoq" (optimistik) hisoblash, checklist doim keraksiz
        // "tugallanmagan" holatda qolib ketmasligi uchun.
        if (sellerId && !store?.onboardingSharedAt) {
          const sharedAt = Date.now();
          updateSeller(sellerId, { onboardingSharedAt: sharedAt }).catch(() => {});
          // Sessiyadagi nusxani ham darhol yangilaymiz - aks holda bu
          // bosqich ham xuddi boshqalari kabi faqat sahifa yangilangach
          // "bajarilgan" bo'lib ko'rinardi.
          patchStore({ onboardingSharedAt: sharedAt });
        }
        return;
      }
      if (step.routeTo) navigate(step.routeTo);
    },
    [navigate, onOpenShareModal, sellerId, store?.onboardingSharedAt, patchStore]
  );

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    if (sellerId) {
      updateSeller(sellerId, { onboardingDismissed: true }).catch(() => {});
      // MUHIM TUZATISH (12-band): sessiyadagi nusxa ham DARHOL
      // yangilanadi - aks holda, sotuvchi shu sahifadan chiqib qayta
      // kirsa (masalan boshqa tabga o'tib qaytsa), yuqoridagi
      // `useEffect` `store.onboardingDismissed`ni ESKI (hali
      // yangilanmagan) qiymatdan qayta o'qib, karta QAYTA paydo bo'lib
      // qolardi.
      patchStore({ onboardingDismissed: true });
    }
  }, [sellerId, patchStore]);

  if (dismissed || progress.isComplete) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full p-4 flex items-center gap-3 text-left">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-600/30">
          <Sparkles size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-slate-800 dark:text-white">{t("onboardingChecklist.title")}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${progress.percent}%` }} />
            </div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 shrink-0">{progress.completed}/{progress.total}</span>
          </div>
        </div>
        <ChevronDown size={16} className={`text-slate-400 dark:text-slate-500 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); handleDismiss(); } }}
          className="w-6 h-6 rounded-full flex items-center justify-center text-slate-300 dark:text-slate-600 shrink-0"
          aria-label={t("onboardingChecklist.dismiss")}
        >
          <X size={13} />
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {steps.map((step) => (
            <StepRow key={step.key} step={step} label={t(`onboardingChecklist.steps.${step.key}`)} onActivate={handleActivate} />
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(OnboardingChecklist);
