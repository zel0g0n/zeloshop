import { useState, useCallback } from "react";
import { ShoppingCart, Heart, RotateCcw, FileText, Zap, ChevronRight } from "lucide-react";
import updateSeller from "@/services/sellers/updateSeller";
import { useLanguage } from "@/context/LanguageContext";
import { computeAutopilotStatus } from "@/utils/aiAutopilotStatus";

/**
 * "AI Sales Autopilot" (ZeloShop TOP 15, #14) - BITTA joyda,
 * sotuvchining barcha avtomatik ishlaydigan funksiyalarini ko'rsatadi.
 *
 * MUHIM: bu YANGI avtomatlashtirish YARATMAYDI - faqat mavjud,
 * OLDIN turli sahifalarga tarqalgan sozlamalarni birlashtiradi
 * (`utils/aiAutopilotStatus.js`da batafsil izoh). "Asosiy" (basic)
 * qatlam bu yerda TO'G'RIDAN-TO'G'RI o'zgartiriladi (xuddi shu
 * maydonlar `MarketingCoupons.jsx`da ham bor - ikkalasi ham xavfsiz,
 * chunki ikkalasi ham bitta Firestore maydoniga yozadi). "AI CEO
 * (Pro)" qatlami esa FAQAT o'qish uchun ko'rsatiladi - haqiqiy
 * boshqaruv shu sahifaning pastroqdagi "Kengaytirilgan sozlamalar"
 * bo'limida (ikki joyda bitta narsani tahrirlaydigan interfeys
 * chalkashtiradi, shuning uchun u yerga "Sozlash" havolasi orqali
 * yo'naltiriladi).
 */
const BASIC_TIER_ROWS = [
  { key: "cartReminder", field: "cartReminderEnabled", icon: ShoppingCart, titleKey: "marketing.cartReminder.title" },
  { key: "favoriteReminder", field: "favoriteReminderEnabled", icon: Heart, titleKey: "marketing.favoriteReminder.title" },
  { key: "repurchaseReminder", field: "repurchaseReminderEnabled", icon: RotateCcw, titleKey: "marketing.repurchaseReminder.title" },
  { key: "dailyReport", field: "notifyDailyReport", icon: FileText, titleKey: "aiCeo.autopilot.dailyReportTitle" },
];

const AI_TIER_ROWS = [
  { key: "aiFavoriteText", titleKey: "aiCeo.autopilot.aiFavoriteText" },
  { key: "aiWinBackText", titleKey: "aiCeo.autopilot.aiWinBackText" },
  { key: "aiAutoDiscount", titleKey: "aiCeo.autopilot.aiAutoDiscount" },
  { key: "telegramApproval", titleKey: "aiCeo.autopilot.telegramApproval" },
];

const ToggleSwitch = ({ active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${active ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
  >
    <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
  </button>
);

/**
 * @param {Object} store - joriy sotuvchi hujjati (`useSession().store`)
 * @param {string} sellerId
 * @param {{aiCeoAutoFavoriteEnabled: boolean, aiCeoAutoWinBackEnabled: boolean, aiCeoAutoDiscountEnabled: boolean, aiCeoTelegramApprovalEnabled: boolean}} liveAiTier - shu sahifaning O'ZIDAGI jonli holat (pastdagi "Kengaytirilgan sozlamalar" bilan bir xil manba)
 * @param {() => void} onOpenAdvanced - "Kengaytirilgan sozlamalar" bo'limini ochish
 */
const AutopilotStatusCard = ({ store, sellerId, liveAiTier, onOpenAdvanced }) => {
  const { t } = useLanguage();
  const [basicValues, setBasicValues] = useState({
    cartReminderEnabled: store?.cartReminderEnabled !== false,
    favoriteReminderEnabled: store?.favoriteReminderEnabled !== false,
    repurchaseReminderEnabled: store?.repurchaseReminderEnabled !== false,
    notifyDailyReport: store?.notifyDailyReport !== false,
  });

  // `store` odatda montaj vaqtida hali yuklanmagan bo'lishi mumkin
  // (`useSession().store` bir martalik so'rov), keyin to'ldiriladi -
  // shuning uchun uni useEffect ICHIDA emas, RENDER vaqtida (React
  // hujjatlarida tavsiya etilgan "moslashtirish" andozasi) solishtirib,
  // faqat HAQIQIY o'zgarishda qayta sinxronlaymiz - useEffect + setState
  // "kaskad render" xatosini yaratmaydi.
  const [syncedStore, setSyncedStore] = useState(store);
  if (store !== syncedStore) {
    setSyncedStore(store);
    if (store) {
      setBasicValues({
        cartReminderEnabled: store.cartReminderEnabled !== false,
        favoriteReminderEnabled: store.favoriteReminderEnabled !== false,
        repurchaseReminderEnabled: store.repurchaseReminderEnabled !== false,
        notifyDailyReport: store.notifyDailyReport !== false,
      });
    }
  }

  const handleToggle = useCallback(async (field) => {
    const next = !basicValues[field];
    setBasicValues((prev) => ({ ...prev, [field]: next }));
    if (!sellerId) return;
    try {
      await updateSeller(sellerId, { [field]: next });
    } catch {
      // Muvaffaqiyatsiz bo'lsa - optimistik o'zgarishni qaytaramiz.
      setBasicValues((prev) => ({ ...prev, [field]: !next }));
    }
  }, [basicValues, sellerId]);

  const aiCeoEnabled = store?.aiCeoEnabled === true;
  const status = computeAutopilotStatus({
    ...basicValues,
    aiCeoEnabled,
    aiCeoAutoFavoriteEnabled: liveAiTier?.aiCeoAutoFavoriteEnabled,
    aiCeoAutoWinBackEnabled: liveAiTier?.aiCeoAutoWinBackEnabled,
    aiCeoAutoDiscountEnabled: liveAiTier?.aiCeoAutoDiscountEnabled,
    aiCeoTelegramApprovalEnabled: liveAiTier?.aiCeoTelegramApprovalEnabled,
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap size={14} className="text-indigo-500" />
          <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">{t("aiCeo.autopilot.title")}</h3>
        </div>
        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-full">
          {t("aiCeo.autopilot.activeCount", { count: status.activeCount, total: status.totalCount })}
        </span>
      </div>

      <div className="space-y-1">
        {BASIC_TIER_ROWS.map(({ key, field, icon: Icon, titleKey }) => (
          <div key={key} className="flex items-center justify-between py-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <Icon size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{t(titleKey)}</span>
            </div>
            <ToggleSwitch active={basicValues[field]} onClick={() => handleToggle(field)} />
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("aiCeo.autopilot.aiTierLabel")}</p>
        {AI_TIER_ROWS.map(({ key, titleKey }) => {
          const active = status.aiTier.find((a) => a.key === key)?.active;
          return (
            <div key={key} className="flex items-center justify-between py-1">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{t(titleKey)}</span>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  active
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                }`}
              >
                {active ? t("aiCeo.autopilot.on") : t("aiCeo.autopilot.off")}
              </span>
            </div>
          );
        })}
        <button
          type="button"
          onClick={onOpenAdvanced}
          className="w-full flex items-center justify-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 pt-1.5"
        >
          {aiCeoEnabled ? t("aiCeo.autopilot.configureLink") : t("aiCeo.autopilot.upgradeLink")}
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
};

export default AutopilotStatusCard;
