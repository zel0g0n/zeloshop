import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Bot, TrendingUp, TrendingDown, Package, Instagram, Users, Check, Clock,
  Info, X, Tag, RotateCcw, ShoppingCart, Heart, Send, Loader2, RefreshCw,
  ChevronRight, ChevronDown, Star, MessageCircle, Zap, Sparkles, HelpCircle, Target,
  FileWarning, ImageOff, Crown, Megaphone, Flame,
} from "lucide-react";
import { useSession } from "@/context/SessionContext";
import updateSeller from "@/services/sellers/updateSeller";
import { formatTimeSaved } from "@/utils/formatTimeSaved";
import { generateDailyAiCeoReport, askAiCeo } from "@/services/ai/aiCeoInsights";
import CustomSelect from "@/components/ui/CustomSelect";
import { useLanguage } from "@/context/LanguageContext";
import { getEffectiveTariffPlan } from "@/utils/tariffLimits";
import AutopilotStatusCard from "./AutopilotStatusCard";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";

/**
 * AI CEO sahifasi kunlik hisobotni asosiy kontent sifatida ko'rsatadi:
 * sahifa har safar ochilganda `generateDailyAiCeoReport` orqali bugungi
 * haqiqiy ma'lumotdan hisobot tuziladi va ko'rsatiladi. "AI CEO nima
 * qila oladi" tushuntirishi kichik "ℹ" tugmasi orqali ochiladigan modal
 * ichida joylashgan.
 */
const FEATURES = [
  { icon: TrendingUp, titleKey: "aiCeo.infoFeature1Title", descKey: "aiCeo.infoFeature1Desc" },
  { icon: Package, titleKey: "aiCeo.infoFeature2Title", descKey: "aiCeo.infoFeature2Desc" },
  { icon: Instagram, titleKey: "aiCeo.infoFeature3Title", descKey: "aiCeo.infoFeature3Desc" },
  { icon: Users, titleKey: "aiCeo.infoFeature4Title", descKey: "aiCeo.infoFeature4Desc" },
];

const formatMoney = (n) => `${Math.round(Number(n) || 0).toLocaleString()} so'm`;

/**
 * "Nima qila oladi" va xavfsizlik ro'yxatini ko'rsatadigan modal.
 */
const CapabilitiesModal = ({ onClose, t }) => {
  useEscapeToClose(onClose);
  return (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose} role="dialog" aria-modal="true">
    <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#F4F5F9] dark:bg-slate-950 rounded-t-[28px] max-h-[85vh] overflow-y-auto">
      <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 border-b border-slate-100 dark:border-slate-800 p-4 flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-800 dark:text-white">{t("aiCeo.infoPageTitle")}</h3>
        <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <X size={14} className="text-slate-500 dark:text-slate-400" />
        </button>
      </div>
      <div className="p-4 space-y-4">
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-[24px] p-5 text-white text-center shadow-lg shadow-indigo-600/20">
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-2.5">
            <Bot size={22} />
          </div>
          <h2 className="text-sm font-black">{t("aiCeo.infoHeroTitle")}</h2>
          <p className="text-[11px] font-medium text-white/80 mt-1.5 leading-relaxed">{t("aiCeo.infoHeroSubtitle")}</p>
        </div>

        <div className="space-y-2.5">
          {FEATURES.map(({ icon: Icon, titleKey, descKey }) => (
            <div key={titleKey} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-3.5 flex gap-3">
              <span className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Icon size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-800 dark:text-white">{t(titleKey)}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">{t(descKey)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-2.5">
          <h3 className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("aiCeo.infoSafetyTitle")}</h3>
          {["infoSafety1", "infoSafety2", "infoSafety3", "infoSafety4"].map((key) => (
            <div key={key} className="flex items-start gap-2">
              <Check size={13} className="text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{t(`aiCeo.${key}`)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
  );
};

const TONE_CLASSES = {
  slate: "bg-slate-50 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400",
  indigo: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  emerald: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

const StatCard = ({ icon: Icon, label, value, tone = "slate" }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-3.5">
    <span className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${TONE_CLASSES[tone] || TONE_CLASSES.slate}`}>
      <Icon size={14} />
    </span>
    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{label}</p>
    <p className="text-sm font-black text-slate-800 dark:text-white mt-0.5">{value}</p>
  </div>
);

/**
 * "Bugungi rejalar" — harakat markazi.
 *
 * Diqqat talab qiladigan mijozlar (VIP/uxlab qolgan) va mahsulot
 * tavsiyalari (chegirma/aksiya nomzodlari) bitta, ustuvorlik bo'yicha
 * tartiblangan ro'yxatda ko'rsatiladi. Har bir band uchun bitta tugma
 * bosilishi bilan keyingi qadam to'liq tayyorlangan holda ochiladi
 * (masalan, "VIP'larga yubor" tugmasi CRM Hub'ni "vip" segmenti
 * allaqachon tanlangan va AI matni allaqachon generatsiya qilinayotgan
 * holda ochadi).
 */
/**
 * `buildActionPlan()` (pastda) mavjud harakat bandlarini va ularning
 * mazmunini (matn, havola) hisoblaydi hamda standart holatda ularni
 * qattiq kodlangan qoida bo'yicha (VIP > churn > chegirma > aksiya)
 * tartiblaydi. Ushbu funksiya esa, agar backend (`buildDailyReport`,
 * `functions/aiCeo.js`) Gemini orqali bugungi haqiqiy vaziyatga qarab
 * o'z tartibini yaratgan bo'lsa (`report.aiActionPlan`), o'sha tartibni
 * qo'llaydi — qattiq kodlangan tartib faqat zaxira sifatida ishlatiladi
 * (AI ishlamagan yoki hali hisoblanmagan holatlar uchun).
 */
export function applyAiActionPlanOrder(items, aiActionPlan) {
  if (!aiActionPlan || !Array.isArray(aiActionPlan.order) || aiActionPlan.order.length === 0) return items;
  const byKey = new Map(items.map((item) => [item.key, item]));
  const ordered = [];
  aiActionPlan.order.forEach((key) => {
    const item = byKey.get(key);
    if (item) {
      ordered.push(item);
      byKey.delete(key);
    }
  });
  // AI tartibida bo'lmagan (masalan formatlash muammosi tufayli tushib
  // qolgan) bandlar bo'lsa, ularning yo'qolib qolmasligi uchun oxiriga
  // qo'shiladi.
  byKey.forEach((item) => ordered.push(item));
  return ordered;
}

// "Eng ko'p sotilayotgan mahsulot" uchun "Post yaratish" bandi vaqtincha
// yashirilgan — funksiyaning o'zi (backend `generateSocialPost`,
// `SocialPostGeneratorCard` mahsulotni tahrirlash sahifasida)
// o'chirilmagan, faqat shu "Bugungi rejalar" ro'yxatidagi CTA yashirilgan.
// Qayta yoqish uchun quyidagi qiymatni `true`ga o'zgartirish kifoya.
const PROMOTE_ACTION_ENABLED = false;

export function buildActionPlan(report) {
  if (!report) return [];
  const items = [];

  if (report.attentionNeeded?.vipCount > 0) {
    items.push({
      key: "vip",
      icon: Star,
      tone: "amber",
      title: "aiCeo.actionVipTitle",
      titleParams: { count: report.attentionNeeded.vipCount },
      desc: "aiCeo.actionVipDesc",
      ctaKey: "aiCeo.actionVipCta",
      to: "/seller/crm?audience=vip&autoAi=1",
    });
  }
  if (report.attentionNeeded?.churnCount > 0) {
    items.push({
      key: "churn",
      icon: MessageCircle,
      tone: "rose",
      title: "aiCeo.actionChurnTitle",
      titleParams: { count: report.attentionNeeded.churnCount },
      desc: "aiCeo.actionChurnDesc",
      ctaKey: "aiCeo.actionChurnCta",
      to: "/seller/crm?audience=churn&autoAi=1",
    });
  }
  const discountCandidate = report.productRecommendations?.discountCandidates?.[0];
  if (discountCandidate) {
    items.push({
      key: "discount",
      icon: Tag,
      tone: "indigo",
      title: "aiCeo.actionDiscountTitle",
      titleParams: { name: discountCandidate.name },
      desc: "aiCeo.actionDiscountDesc",
      ctaKey: "aiCeo.actionDiscountCta",
      to: `/seller/products/${discountCandidate.id}/edit`,
    });
  }
  const promoteCandidate = report.productRecommendations?.promoteCandidates?.[0];
  if (promoteCandidate && PROMOTE_ACTION_ENABLED) {
    items.push({
      key: "promote",
      icon: Sparkles,
      tone: "emerald",
      title: "aiCeo.actionPromoteTitle",
      titleParams: { name: promoteCandidate.name },
      desc: "aiCeo.actionPromoteDesc",
      ctaKey: "aiCeo.actionPromoteCta",
      to: `/seller/products/${promoteCandidate.id}/edit`,
    });
  }
  return items;
}

// "AI Business Manager" (Z-Biznes, 2026-09 punkt-royxati, 4-band):
// "AI CEO'dan so'rang" ostidagi TAYYOR savol tugmalari - sotuvchi
// backend'dagi yangi, chuqurroq vositalarni (`get_sales_decline_diagnostic`,
// `plan_ad_campaign`, `get_trending_products`, batafsil izoh:
// `functions/aiCeoAgent.js`) "kashf qilishi" uchun. Matnning O'ZI
// (`textKey` orqali) haqiqiy savol sifatida `askAiCeo`ga yuboriladi -
// bu yerda hech qanday qo'shimcha frontend mantiq shart emas, Gemini
// savol matnidan o'zi kerakli vositani tanlaydi.
export const BIZNES_SUGGESTED_QUESTIONS = [
  { key: "salesDecline", icon: TrendingDown, textKey: "aiCeo.suggestedQuestionSalesDecline" },
  { key: "adCampaign", icon: Megaphone, textKey: "aiCeo.suggestedQuestionAdCampaign" },
  { key: "trendingProducts", icon: Flame, textKey: "aiCeo.suggestedQuestionTrendingProducts" },
];

const ACTION_TONE_CLASSES = {
  amber: { icon: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400", btn: "bg-amber-500 hover:bg-amber-600" },
  rose: { icon: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400", btn: "bg-rose-500 hover:bg-rose-600" },
  indigo: { icon: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400", btn: "bg-indigo-600 hover:bg-indigo-700" },
  emerald: { icon: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", btn: "bg-emerald-600 hover:bg-emerald-700" },
};

const ActionPlanItem = ({ item, t, onNavigate }) => {
  const Icon = item.icon;
  const tone = ACTION_TONE_CLASSES[item.tone] || ACTION_TONE_CLASSES.indigo;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tone.icon}`}>
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black text-slate-800 dark:text-white truncate">{t(item.title, item.titleParams)}</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">{t(item.desc)}</p>
      </div>
      <button
        type="button"
        onClick={() => onNavigate(item.to)}
        className={`shrink-0 h-9 px-3 text-white text-[11px] font-black rounded-xl flex items-center gap-1 active:scale-95 transition-transform ${tone.btn}`}
      >
        {t(item.ctaKey)} <ChevronRight size={12} />
      </button>
    </div>
  );
};

const AiCeoInfoPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId, store } = useSession();
  // "AI Business Manager" (Z-Biznes) tavsiya etilgan savol tugmalari
  // FAQAT samarali tarifi "biznes" bo'lgan sotuvchiga ko'rsatiladi -
  // gatelashning HAQIQIY joyi backend'da (`handleAskAiCeo`dagi
  // `getEffectiveTariffPlan`), bu yerdagi tekshiruv faqat UI'ni mos
  // ravishda ko'rsatish/yashirish uchun.
  const isBiznes = getEffectiveTariffPlan(store) === "biznes";
  const [enabled, setEnabled] = useState(store?.aiCeoDigestEnabled !== false);
  const [saving, setSaving] = useState(false);
  const [draftHour, setDraftHour] = useState(
    Number.isInteger(store?.aiCeoDraftProcessHour) ? String(store.aiCeoDraftProcessHour) : "21"
  );
  const [savingHour, setSavingHour] = useState(false);
  const [showCapabilities, setShowCapabilities] = useState(false);
  // AI CEO avtonom ijrosi: standart holatda o'chiq (opt-in, opt-out
  // emas) — yoqilsa, 30 kun xarid qilmagan mijozlarga AI CEO matnni o'zi
  // yozadi va sotuvchi tasdiqisiz avtomatik yuboradi (batafsil izoh:
  // `functions/engagementReminders.js`).
  const [autoWinBackEnabled, setAutoWinBackEnabled] = useState(store?.aiCeoAutoWinBackEnabled === true);
  const [savingAutoWinBack, setSavingAutoWinBack] = useState(false);
  // Xuddi shu avtonom ijro mantig'i sevimlilar eslatmasiga ham
  // qo'llaniladi (standart holatda o'chiq, batafsil izoh:
  // `functions/engagementReminders.js`).
  const [autoFavoriteEnabled, setAutoFavoriteEnabled] = useState(store?.aiCeoAutoFavoriteEnabled === true);
  const [savingAutoFavorite, setSavingAutoFavorite] = useState(false);
  // Yuqoridagi kabi avtonom ijro, lekin bu safar haqiqiy moliyaviy
  // oqibatga ega: yoqilsa (va `autoWinBackEnabled` ham yoqilgan bo'lsa,
  // va AI CEO'ning matni yetarlicha ishlamayotgan bo'lsa), qaytarish
  // xabariga haqiqiy, bir martalik chegirma promokodi ham avtomatik
  // qo'shiladi (standart holatda o'chiq, batafsil izoh:
  // `functions/aiCeoAutoDiscount.js`).
  const [autoDiscountEnabled, setAutoDiscountEnabled] = useState(store?.aiCeoAutoDiscountEnabled === true);
  const [savingAutoDiscount, setSavingAutoDiscount] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(
    Number.isInteger(store?.aiCeoAutoDiscountPercent) ? String(store.aiCeoAutoDiscountPercent) : "10"
  );
  const [savingDiscountPercent, setSavingDiscountPercent] = useState(false);
  // Joriy 5+ ta mayda sozlama standart holatda "Kengaytirilgan
  // sozlamalar" ostiga yopiq holda yig'iladi — hech biri olib
  // tashlanmagan, faqat asosiy ko'rinishdan yashirilgan.
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [savingMaster, setSavingMaster] = useState(false);
  // "AI Sales Autopilot" kartochkasidagi "Sozlash" havolasi shu bo'limni
  // ochadi (`advancedOpen`) - lekin bu bo'lim sahifaning ANCHA pastida,
  // havola esa eng yuqorida. OLDIN faqat `setAdvancedOpen(true)`
  // chaqirilardi - bo'lim ochilardi, lekin ko'rinadigan joydan uzoqda
  // bo'lgani uchun sotuvchiga "hech narsa bo'lmadi" bo'lib tuyulardi.
  // ENDI shu bo'limga avtomatik skroll ham qilinadi.
  const advancedSectionRef = useRef(null);
  const handleOpenAdvanced = useCallback(() => {
    setAdvancedOpen(true);
    requestAnimationFrame(() => {
      advancedSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);
  // Telegram orqali "1-tugmali tasdiqlash": Mini App'ni ochmasdan,
  // to'g'ridan-to'g'ri Telegram chatida AI CEO tavsiyasini ko'rib, bitta
  // tugma bilan tasdiqlash mumkin (standart holatda o'chiq, batafsil
  // izoh: `functions/telegramApproval.js`).
  const [telegramApprovalEnabled, setTelegramApprovalEnabled] = useState(store?.aiCeoTelegramApprovalEnabled === true);
  const [savingTelegramApproval, setSavingTelegramApproval] = useState(false);
  // YANGI (#116): mahsulot QO'SHILGANDA avtomatik 9:16 "Story" reklama
  // surati ham generatsiya qilinadi (standart holatda o'CHIQ, opt-in -
  // batafsil izoh: `functions/productAutomation.js`dagi
  // `maybeGenerateStoryImage`). Sotuvchi buni yoqmasa ham, story rasmni
  // istalgan mahsulot sahifasida QO'LDA (`StoryAdImageCard.jsx`) baribir
  // yaratishi mumkin - bu sozlama faqat AVTOMATLASHTIRISHNI boshqaradi.
  const [autoStoryImageEnabled, setAutoStoryImageEnabled] = useState(store?.aiAutoStoryImageEnabled === true);
  const [savingAutoStoryImage, setSavingAutoStoryImage] = useState(false);
  // MENEJERGA PROAKTIV OGOHLANTIRISHLAR (2026-09 punkt-royxati,
  // "Advanced Automation", 5-band) - standart holatda o'chiq, batafsil
  // izoh: `functions/managerAlerts.js`. Ikkalasi ham SOTUVCHINING
  // O'ZIGA yuboriladi (xaridorga emas) - shuning uchun boshqa
  // kartochkalardan farqli, "konversiya" emas, "operatsion nazorat"
  // haqida.
  const [lowStockAlertEnabled, setLowStockAlertEnabled] = useState(store?.aiCeoLowStockAlertEnabled === true);
  const [savingLowStockAlert, setSavingLowStockAlert] = useState(false);
  const [staleOrderAlertEnabled, setStaleOrderAlertEnabled] = useState(store?.aiCeoStaleOrderAlertEnabled === true);
  const [savingStaleOrderAlert, setSavingStaleOrderAlert] = useState(false);

  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState(null);

  // "AI CEO'dan so'rang": sotuvchi erkin matnda savol beradi, backend
  // (`functions/aiCeoAgent.js`) Gemini'ga haqiqiy, chaqiriladigan
  // vositalar (tools) beradi va Gemini o'zi qaysi ma'lumot kerakligini
  // hal qiladi. Faqat o'qish — hech qanday tasdiqlash yoki avtonom ijro
  // shart emas (batafsil izoh: `functions/aiCeoAgent.js`).
  const [askQuestion, setAskQuestion] = useState("");
  const [askAnswer, setAskAnswer] = useState(null);
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState(null);

  // "Bugungi rejalar" — hisobotdan olingan, ustuvorlik bo'yicha
  // tartiblangan, har biri bitta tugmali harakat markazi. Standart
  // tartib qattiq kodlangan qoida bo'yicha, lekin agar backend Gemini
  // orqali bugungi o'z tartibini yaratgan bo'lsa (`report.aiActionPlan`),
  // o'sha qo'llaniladi.
  const baseActionPlan = useMemo(() => buildActionPlan(report), [report]);
  const actionPlan = useMemo(
    () => applyAiActionPlanOrder(baseActionPlan, report?.aiActionPlan),
    [baseActionPlan, report]
  );

  const hourOptions = useMemo(
    () => Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${String(h).padStart(2, "0")}:00` })),
    []
  );

  // Moliyaviy xavfni cheklash uchun qat'iy chegaralangan tanlov (backend,
  // `aiCeoAutoDiscount.js`dagi `MIN_DISCOUNT_PERCENT`/
  // `MAX_DISCOUNT_PERCENT` bilan mos).
  const discountPercentOptions = useMemo(
    () => [5, 10, 15, 20].map((p) => ({ value: String(p), label: `${p}%` })),
    []
  );

  // Katta "yoqish" tugmasi faqat uchta moliyaviy xavfsiz sozlama (kunlik
  // xulosa va ikkala avtomatik xabar turi) hammasi birdaniga yoqilgan
  // holatdagina "yoqilgan" ko'rinadi — aralash holat (masalan faqat
  // ikkitasi yoqilgan, kengaytirilgan bo'limdan qo'lda sozlangan) "o'chiq"
  // deb ko'rsatiladi, chunki to'liq yoqilmagan.
  const allCoreEnabled = enabled && autoWinBackEnabled && autoFavoriteEnabled;

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    setReportError(null);
    try {
      const data = await generateDailyAiCeoReport();
      setReport(data);
    } catch (err) {
      setReportError(err.message || t("aiCeo.reportError"));
    } finally {
      setReportLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleHourChange = useCallback(async (value) => {
    const previous = draftHour;
    setDraftHour(value);
    setSavingHour(true);
    try {
      await updateSeller(sellerId, { aiCeoDraftProcessHour: Number(value) });
    } catch {
      setDraftHour(previous);
    } finally {
      setSavingHour(false);
    }
  }, [draftHour, sellerId]);

  const handleToggle = useCallback(async () => {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    try {
      await updateSeller(sellerId, { aiCeoDigestEnabled: next });
    } catch {
      setEnabled(!next);
    } finally {
      setSaving(false);
    }
  }, [enabled, sellerId]);

  const handleAutoWinBackToggle = useCallback(async () => {
    const next = !autoWinBackEnabled;
    setAutoWinBackEnabled(next);
    setSavingAutoWinBack(true);
    try {
      await updateSeller(sellerId, { aiCeoAutoWinBackEnabled: next });
    } catch {
      setAutoWinBackEnabled(!next);
    } finally {
      setSavingAutoWinBack(false);
    }
  }, [autoWinBackEnabled, sellerId]);

  const handleAutoFavoriteToggle = useCallback(async () => {
    const next = !autoFavoriteEnabled;
    setAutoFavoriteEnabled(next);
    setSavingAutoFavorite(true);
    try {
      await updateSeller(sellerId, { aiCeoAutoFavoriteEnabled: next });
    } catch {
      setAutoFavoriteEnabled(!next);
    } finally {
      setSavingAutoFavorite(false);
    }
  }, [autoFavoriteEnabled, sellerId]);

  const handleAutoDiscountToggle = useCallback(async () => {
    const next = !autoDiscountEnabled;
    setAutoDiscountEnabled(next);
    setSavingAutoDiscount(true);
    try {
      await updateSeller(sellerId, { aiCeoAutoDiscountEnabled: next });
    } catch {
      setAutoDiscountEnabled(!next);
    } finally {
      setSavingAutoDiscount(false);
    }
  }, [autoDiscountEnabled, sellerId]);

  const handleDiscountPercentChange = useCallback(async (value) => {
    const previous = discountPercent;
    setDiscountPercent(value);
    setSavingDiscountPercent(true);
    try {
      await updateSeller(sellerId, { aiCeoAutoDiscountPercent: Number(value) });
    } catch {
      setDiscountPercent(previous);
    } finally {
      setSavingDiscountPercent(false);
    }
  }, [discountPercent, sellerId]);

  // Bitta bosish bilan uchta sozlamani birdaniga yozadi (kaskad) — bu
  // faqat tezkor yo'l qo'shadi, har biri "Kengaytirilgan sozlamalar"da
  // baribir alohida ham sozlanadi. Xatolik bo'lsa, uchalasi ham eski
  // holatiga qaytariladi, yarim yozilgan holat qolmasligi uchun.
  const handleMasterToggle = useCallback(async () => {
    const next = !allCoreEnabled;
    const prevEnabled = enabled;
    const prevAutoWinBack = autoWinBackEnabled;
    const prevAutoFavorite = autoFavoriteEnabled;
    setEnabled(next);
    setAutoWinBackEnabled(next);
    setAutoFavoriteEnabled(next);
    setSavingMaster(true);
    try {
      await updateSeller(sellerId, {
        aiCeoDigestEnabled: next,
        aiCeoAutoWinBackEnabled: next,
        aiCeoAutoFavoriteEnabled: next,
      });
    } catch {
      setEnabled(prevEnabled);
      setAutoWinBackEnabled(prevAutoWinBack);
      setAutoFavoriteEnabled(prevAutoFavorite);
    } finally {
      setSavingMaster(false);
    }
  }, [allCoreEnabled, enabled, autoWinBackEnabled, autoFavoriteEnabled, sellerId]);

  // `handleAskSubmit` (qo'lda kiritilgan savol) VA tavsiya etilgan
  // savol tugmalari (`handleSuggestedQuestionClick`) IKKALASI HAM shu
  // bitta funksiyani ishlatadi - savol matni QAYERDAN kelganidan
  // qat'i nazar, yuborish mantig'i (yuklanish holati, xato ushlash)
  // bir xil bo'lishi kerak.
  const submitQuestion = useCallback(async (questionText) => {
    const trimmed = (questionText || "").trim();
    if (!trimmed || askLoading) return;
    setAskQuestion(trimmed);
    setAskLoading(true);
    setAskError(null);
    try {
      const { answer } = await askAiCeo(trimmed);
      setAskAnswer(answer);
    } catch (err) {
      setAskError(err.message || t("aiCeo.askAiCeoError"));
    } finally {
      setAskLoading(false);
    }
  }, [askLoading, t]);

  const handleAskSubmit = useCallback((e) => {
    e.preventDefault();
    submitQuestion(askQuestion);
  }, [askQuestion, submitQuestion]);

  // Tavsiya etilgan savol tugmasi bosilganda - matn darhol yuboriladi
  // (sotuvchi qo'lda qayta yozishi/tasdiqlashi shart emas, chunki
  // savolning O'ZI oldindan tayyorlangan, xavfsiz, faqat-o'qish
  // so'rov).
  const handleSuggestedQuestionClick = useCallback((questionText) => {
    submitQuestion(questionText);
  }, [submitQuestion]);

  const handleAskReset = useCallback(() => {
    setAskQuestion("");
    setAskAnswer(null);
    setAskError(null);
  }, []);

  const handleTelegramApprovalToggle = useCallback(async () => {
    const next = !telegramApprovalEnabled;
    setTelegramApprovalEnabled(next);
    setSavingTelegramApproval(true);
    try {
      await updateSeller(sellerId, { aiCeoTelegramApprovalEnabled: next });
    } catch {
      setTelegramApprovalEnabled(!next);
    } finally {
      setSavingTelegramApproval(false);
    }
  }, [telegramApprovalEnabled, sellerId]);

  const handleAutoStoryImageToggle = useCallback(async () => {
    const next = !autoStoryImageEnabled;
    setAutoStoryImageEnabled(next);
    setSavingAutoStoryImage(true);
    try {
      await updateSeller(sellerId, { aiAutoStoryImageEnabled: next });
    } catch {
      setAutoStoryImageEnabled(!next);
    } finally {
      setSavingAutoStoryImage(false);
    }
  }, [autoStoryImageEnabled, sellerId]);

  const handleLowStockAlertToggle = useCallback(async () => {
    const next = !lowStockAlertEnabled;
    setLowStockAlertEnabled(next);
    setSavingLowStockAlert(true);
    try {
      await updateSeller(sellerId, { aiCeoLowStockAlertEnabled: next });
    } catch {
      setLowStockAlertEnabled(!next);
    } finally {
      setSavingLowStockAlert(false);
    }
  }, [lowStockAlertEnabled, sellerId]);

  const handleStaleOrderAlertToggle = useCallback(async () => {
    const next = !staleOrderAlertEnabled;
    setStaleOrderAlertEnabled(next);
    setSavingStaleOrderAlert(true);
    try {
      await updateSeller(sellerId, { aiCeoStaleOrderAlertEnabled: next });
    } catch {
      setStaleOrderAlertEnabled(!next);
    } finally {
      setSavingStaleOrderAlert(false);
    }
  }, [staleOrderAlertEnabled, sellerId]);

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
        <h1 className="text-sm font-black text-slate-800 dark:text-white flex-1">{t("aiCeo.dailyReportTitle")}</h1>
        <button
          type="button"
          onClick={loadReport}
          disabled={reportLoading}
          className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 active:scale-95 transition-transform shrink-0 disabled:opacity-50"
          aria-label={t("aiCeo.refreshLabel")}
        >
          <RefreshCw size={14} className={reportLoading ? "animate-spin" : ""} />
        </button>
        {/* "AI CEO nima qila oladi" ma'lumoti shu kichik tugma orqali
            alohida modalda ochiladi. */}
        <button
          type="button"
          onClick={() => setShowCapabilities(true)}
          className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center active:scale-95 transition-transform shrink-0"
          aria-label={t("aiCeo.infoPageTitle")}
        >
          <Info size={16} />
        </button>
      </div>

      <div className="p-4 space-y-4 pb-36">

        {/* "AI Sales Autopilot" (ZeloShop TOP 15, #14) - hisobot
            yuklanishidan MUSTAQIL, sotuvchi hech qachon "hech narsa
            ishlamayapti" holatini ko'rmasligi uchun eng tepada. */}
        <AutopilotStatusCard
          store={store}
          sellerId={sellerId}
          liveAiTier={{
            aiCeoAutoFavoriteEnabled: autoFavoriteEnabled,
            aiCeoAutoWinBackEnabled: autoWinBackEnabled,
            aiCeoAutoDiscountEnabled: autoDiscountEnabled,
            aiCeoTelegramApprovalEnabled: telegramApprovalEnabled,
          }}
          onOpenAdvanced={handleOpenAdvanced}
        />

        {reportLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-xs text-slate-400 dark:text-slate-500">
            <Loader2 size={16} className="animate-spin" /> {t("aiCeo.reportLoading")}
          </div>
        )}

        {!reportLoading && reportError && (
          <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-2xl p-4 text-center space-y-2">
            <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">{reportError}</p>
            <button type="button" onClick={loadReport} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 underline">
              {t("aiCeo.retryButton")}
            </button>
          </div>
        )}

        {!reportLoading && !reportError && report && (
          <>
            {/* Moliyaviy qisqa hisobot */}
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-[24px] p-5 text-white shadow-lg shadow-indigo-600/20">
              <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider mb-1">{t("aiCeo.todayRevenueLabel")}</p>
              <p className="text-xl font-black">{formatMoney(report.financial.todayRevenue)}</p>
              {report.financial.revenueChangePercent !== null && (
                <div className={`inline-flex items-center gap-1 mt-2 text-[11px] font-bold px-2 py-0.5 rounded-md ${report.financial.revenueChangePercent >= 0 ? "bg-emerald-500/20 text-emerald-100" : "bg-rose-500/20 text-rose-100"}`}>
                  {report.financial.revenueChangePercent >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {report.financial.revenueChangePercent >= 0 ? "+" : ""}{report.financial.revenueChangePercent.toFixed(0)}% {t("aiCeo.vsYesterdayLabel")}
                </div>
              )}
              <div className="flex gap-4 mt-3 pt-3 border-t border-white/15">
                <div>
                  <p className="text-[10px] text-white/60">{t("aiCeo.todayOrdersLabel")}</p>
                  <p className="text-sm font-black">{report.financial.todayOrderCount}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/60">{t("aiCeo.todayDeliveredLabel")}</p>
                  <p className="text-sm font-black">{report.financial.todayDeliveredCount}</p>
                </div>
              </div>
            </div>

            {/* "Sellerga vaqt sotamiz" - bugun AI CEO avtomatik bajargan
                harakatlar asosidagi taxminiy tejalgan vaqt. Faqat
                birorta harakat bo'lgan kunlarda ko'rsatiladi - 0
                daqiqa ko'rsatishning ma'nosi yo'q. */}
            {report.impact?.timeSavedMinutesToday > 0 && (
              <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Clock size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                    {t("aiCeo.timeSavedTitle", { time: formatTimeSaved(report.impact.timeSavedMinutesToday, t) })}
                  </p>
                  <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/70 mt-0.5">{t("aiCeo.timeSavedSubtitle")}</p>
                </div>
              </div>
            )}

            {/* Mahsulot qo'shish statistikasi */}
            <div className="grid grid-cols-2 gap-2.5">
              <StatCard icon={Package} label={t("aiCeo.productsAddedLabel")} value={`${report.productAdditions.addedTodayCount} ta`} tone="indigo" />
              <StatCard icon={TrendingUp} label={t("aiCeo.salesFromNewLabel")} value={formatMoney(report.productAdditions.salesFromNewProducts)} tone="emerald" />
            </div>

            {/* Mahsulot tavsifi/rasmi sifati (#118) - ikkita ODDIY,
                HAQIQIY signal asosida (tavsif uzunligi, rasm borligi) -
                hech qanday AI subyektiv bahosi emas (batafsil izoh:
                `functions/lib/contentQuality.js`). Faqat muammo
                bo'lgandagina ko'rsatiladi. */}
            {(report.contentQuality?.weakDescriptionCount > 0 || report.contentQuality?.noImageCount > 0) && (
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-2.5">
                <h3 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                  <FileWarning size={14} className="text-amber-500" /> {t("aiCeo.contentQualityTitle")}
                </h3>
                {report.contentQuality.weakDescriptionCount > 0 && (
                  <div className="flex items-center justify-between gap-2 bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3">
                    <div className="min-w-0 flex items-center gap-2">
                      <FileWarning size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-400 leading-relaxed">
                        {t("aiCeo.weakDescriptionLabel", { count: report.contentQuality.weakDescriptionCount })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/seller/products/${report.contentQuality.weakDescriptionProducts[0].id}/edit`)}
                      className="shrink-0 h-8 px-3 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-black rounded-lg flex items-center gap-1 active:scale-95 transition-transform"
                    >
                      {t("aiCeo.contentQualityFixCta")} <ChevronRight size={11} />
                    </button>
                  </div>
                )}
                {report.contentQuality.noImageCount > 0 && (
                  <div className="flex items-center justify-between gap-2 bg-rose-50 dark:bg-rose-500/10 rounded-xl p-3">
                    <div className="min-w-0 flex items-center gap-2">
                      <ImageOff size={13} className="text-rose-600 dark:text-rose-400 shrink-0" />
                      <p className="text-xs font-bold text-rose-700 dark:text-rose-400 leading-relaxed">
                        {t("aiCeo.noImageLabel", { count: report.contentQuality.noImageCount })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/seller/products/${report.contentQuality.noImageProducts[0].id}/edit`)}
                      className="shrink-0 h-8 px-3 bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-black rounded-lg flex items-center gap-1 active:scale-95 transition-transform"
                    >
                      {t("aiCeo.contentQualityFixCta")} <ChevronRight size={11} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* "Bugungi rejalar" — harakat markazi: ustuvorlik bo'yicha
                tartiblangan bitta ro'yxat, har biri bitta tugma bilan
                keyingi qadamni to'liq tayyorlangan holda ochadi. */}
            {actionPlan.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5 px-1">
                  <Zap size={14} className="text-indigo-500" /> {t("aiCeo.actionPlanTitle")}
                </h3>
                {/* Agar AI CEO bugungi ustuvorlikni o'zi tanlagan bo'lsa,
                    sababi shu yerda ko'rsatiladi — sotuvchi nima uchun
                    aynan shu tartib ekanini tushunadi ("qora quti" emas). */}
                {report?.aiActionPlan?.reasoning && (
                  <div className="bg-indigo-50/60 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl px-3 py-2.5 flex items-start gap-2">
                    <Bot size={13} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-indigo-700 dark:text-indigo-300 leading-relaxed">{report.aiActionPlan.reasoning}</p>
                  </div>
                )}
                {actionPlan.map((item) => (
                  <ActionPlanItem key={item.key} item={item} t={t} onNavigate={navigate} />
                ))}
              </div>
            )}

            {/* CRM faoliyati */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                <Send size={14} className="text-indigo-500" /> {t("aiCeo.crmActivityTitle")}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <ShoppingCart size={12} className="text-slate-400 shrink-0" /> {t("aiCeo.cartRemindersLabel")}: <strong>{report.crmActivity.cartRemindersSent}</strong>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <Heart size={12} className="text-slate-400 shrink-0" /> {t("aiCeo.favoriteRemindersLabel")}: <strong>{report.crmActivity.favoriteRemindersSent}</strong>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <RotateCcw size={12} className="text-slate-400 shrink-0" /> {t("aiCeo.repurchaseRemindersLabel")}: <strong>{report.crmActivity.repurchaseRemindersSent}</strong>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <Send size={12} className="text-slate-400 shrink-0" /> {t("aiCeo.crmBroadcastLabel")}: <strong>{report.crmActivity.crmMessagesSent}</strong>
                </div>
              </div>
              {report.crmActivity.crmMessagesSent > 0 && (
                <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  {t("aiCeo.conversionLabel", { count: report.crmActivity.convertedCount })}
                </div>
              )}
              {/* AI CEO o'zi avtomatik bajargan harakatlarni sotuvchiga
                  ko'rsatadi — oldindan tasdiqlash emas, lekin har doim
                  ko'rinadigan hisobot. */}
              {report.crmActivity.aiAutoActionsCount > 0 && (
                <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-xl p-2.5 text-xs font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                  <Bot size={12} className="shrink-0" /> {t("aiCeo.autoActionsLabel", { count: report.crmActivity.aiAutoActionsCount })}
                </div>
              )}
              {/* Moliyaviy oqibatga ega harakat qasddan yuqoridagi
                  "oddiy" avtomatik harakatlar qatoridan alohida, boshqa
                  rangda (amber) ko'rsatiladi — sotuvchi buni
                  chalkashtirib yubormasligi uchun. */}
              {report.crmActivity.autoDiscountsIssuedCount > 0 && (
                <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-2.5 text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <Tag size={12} className="shrink-0" /> {t("aiCeo.autoDiscountsIssuedLabel", { count: report.crmActivity.autoDiscountsIssuedCount })}
                </div>
              )}
              <div className="flex gap-4 pt-2 border-t border-slate-50 dark:border-slate-800">
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("aiCeo.activeCustomersLabel")}</p>
                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{report.crmActivity.activeCustomers}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("aiCeo.inactiveCustomersLabel")}</p>
                  <p className="text-sm font-black text-slate-400 dark:text-slate-500">{report.crmActivity.inactiveCustomers}</p>
                </div>
              </div>
            </div>

            {/* "AI CEO samaradorligi": yuborilgan xabarlar soni bilan
                birga, evaluatsiya qilingan natija ("shu xabarlardan
                necha foizi mijozni qaytardi") ham ko'rsatiladi. Har bir
                tur (`winback`/`favorite`) faqat hech bo'lmasa bitta xabar
                yuborilgan bo'lsa ko'rsatiladi (batafsil izoh:
                `functions/aiCeoLearning.js`). */}
            {(report?.learningSummary?.winback || report?.learningSummary?.favorite) && (
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Target size={14} className="text-indigo-500" /> {t("aiCeo.learningTitle")}
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {report.learningSummary.winback && (
                    <div className="bg-[#F4F5F9] dark:bg-slate-800/60 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("aiCeo.learningWinbackLabel")}</p>
                      <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{report.learningSummary.winback.conversionRatePercent}%</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{t("aiCeo.learningSentCount", { count: report.learningSummary.winback.sentCount })}</p>
                    </div>
                  )}
                  {report.learningSummary.favorite && (
                    <div className="bg-[#F4F5F9] dark:bg-slate-800/60 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("aiCeo.learningFavoriteLabel")}</p>
                      <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{report.learningSummary.favorite.conversionRatePercent}%</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{t("aiCeo.learningSentCount", { count: report.learningSummary.favorite.sentCount })}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* "AI CEO'dan so'rang": sotuvchi istalgan savolni beradi,
                Gemini esa o'zi qaysi ma'lumot kerakligini hal qilib,
                haqiqiy vositalarni chaqirib javob beradi (bu yerdagi
                boshqa bo'limlardan farqli — ular oldindan belgilangan
                promptlar asosida ishlaydi). */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                <HelpCircle size={14} className="text-indigo-500" /> {t("aiCeo.askAiCeoTitle")}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("aiCeo.askAiCeoSubtitle")}</p>

              {/* "AI Business Manager" (Z-Biznes, 4-band) - tayyor,
                  bitta bosishli savol tugmalari. FAQAT samarali tarifi
                  "biznes" bo'lgan sotuvchiga ko'rsatiladi. */}
              {isBiznes && !askAnswer && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black text-indigo-400 dark:text-indigo-500 uppercase tracking-wide flex items-center gap-1">
                    <Crown size={10} /> {t("aiCeo.suggestedQuestionsBiznesLabel")}
                  </p>
                  {BIZNES_SUGGESTED_QUESTIONS.map(({ key, icon: Icon, textKey }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSuggestedQuestionClick(t(textKey))}
                      disabled={askLoading}
                      className="w-full flex items-center gap-2 text-left bg-indigo-50/60 dark:bg-indigo-500/10 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 rounded-xl px-3 py-2.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 active:scale-[0.98] transition-transform disabled:opacity-50"
                    >
                      <Icon size={13} className="shrink-0" />
                      <span className="flex-1 leading-relaxed">{t(textKey)}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Z-Pro sotuvchisiga (aiCeoEnabled bo'lsa-da, "biznes"
                  emas) chuqurroq imkoniyat borligi haqida qisqa, bitta
                  qatorli eslatma - bosilganda tariflar sahifasiga
                  o'tkazadi. */}
              {!isBiznes && !askAnswer && (
                <button
                  type="button"
                  onClick={() => navigate("/seller/tariffs")}
                  className="w-full flex items-center gap-2 text-left bg-amber-50 dark:bg-amber-500/10 rounded-xl px-3 py-2.5 text-[11px] font-bold text-amber-700 dark:text-amber-400 active:scale-[0.98] transition-transform"
                >
                  <Crown size={13} className="shrink-0" />
                  <span className="flex-1 leading-relaxed">{t("aiCeo.suggestedQuestionsBiznesUpsell")}</span>
                  <ChevronRight size={12} className="shrink-0" />
                </button>
              )}

              {!askAnswer && (
                <form onSubmit={handleAskSubmit} className="space-y-2">
                  <textarea
                    value={askQuestion}
                    onChange={(e) => setAskQuestion(e.target.value)}
                    placeholder={t("aiCeo.askAiCeoPlaceholder")}
                    maxLength={300}
                    rows={2}
                    disabled={askLoading}
                    className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F4F5F9] dark:bg-slate-800 p-3 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={askLoading || !askQuestion.trim()}
                    className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    {askLoading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> {t("aiCeo.askAiCeoLoading")}
                      </>
                    ) : (
                      t("aiCeo.askAiCeoButton")
                    )}
                  </button>
                </form>
              )}

              {askError && <p className="text-[11px] text-rose-500 dark:text-rose-400 font-semibold">{askError}</p>}

              {askAnswer && (
                <div className="space-y-2.5">
                  <div className="bg-[#F4F5F9] dark:bg-slate-800/60 rounded-xl p-3">
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">{askQuestion}</p>
                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">{askAnswer}</p>
                  </div>
                  <button type="button" onClick={handleAskReset} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 underline">
                    {t("aiCeo.askAiCeoAskAnother")}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Bitta katta "yoqish" tugmasi bosilganda, moliyaviy xavfsiz,
            faqat matn/xabar darajasidagi uchta sozlamani (kunlik xulosa
            va avtomatik qaytarish/sevimlilar xabari) birdaniga, aqlli
            standart qiymat bilan yoqadi/o'chiradi — quyidagi
            "Kengaytirilgan sozlamalar" har bir narsani baribir alohida,
            nozik sozlash imkonini saqlab qoladi. Pul bilan bog'liq
            avtomatik chegirma (`aiCeoAutoDiscountEnabled`) qasddan bu
            tugmaga qo'shilmagan — u har doim alohida, ongli ravishda
            Kengaytirilgan bo'limda yoqiladi. */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-4 text-white shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Bot size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black">{t("aiCeo.masterToggleTitle")}</p>
              <p className="text-[10px] font-medium text-white/70 mt-0.5 leading-relaxed">{t("aiCeo.masterToggleDesc")}</p>
            </div>
            <button
              type="button"
              onClick={handleMasterToggle}
              disabled={savingMaster}
              aria-label={t("aiCeo.masterToggleTitle")}
              className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${savingMaster ? "opacity-60" : ""} ${allCoreEnabled ? "bg-white/90 justify-end" : "bg-white/20 justify-start"}`}
            >
              <span className={`w-5 h-5 rounded-full shadow-sm ${allCoreEnabled ? "bg-indigo-600" : "bg-white"}`} />
            </button>
          </div>

          <div className="pt-3 border-t border-white/15 space-y-2">
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-white/70" />
              <p className="text-[11px] font-bold text-white/70">{t("aiCeo.processTimeTitle")}</p>
            </div>
            <CustomSelect value={draftHour} onChange={handleHourChange} options={hourOptions} disabled={savingHour} />
          </div>
        </div>

        {/* Joriy 5 ta mayda sozlama standart holatda yopiq — sotuvchi
            ularni ko'rish uchun ataylab ochishi kerak. Hech biri olib
            tashlanmagan, faqat "sodda" ko'rinishdan chetga surilgan. */}
        <div ref={advancedSectionRef} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden scroll-mt-20">
          <button
            type="button"
            onClick={() => setAdvancedOpen((prev) => !prev)}
            className="w-full flex items-center justify-between gap-2 p-4"
          >
            <div className="text-left">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{t("aiCeo.advancedSettingsTitle")}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{t("aiCeo.advancedSettingsSubtitle")}</p>
            </div>
            <ChevronDown size={16} className={`text-slate-400 dark:text-slate-500 shrink-0 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
          </button>

          {advancedOpen && (
            <div className="px-4 pb-4 space-y-3">
              <div className="pt-3 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{t("aiCeo.dashboardCardTitle")}</span>
                <button
                  type="button"
                  onClick={handleToggle}
                  disabled={saving}
                  aria-label={t("aiCeo.dashboardCardTitle")}
                  className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${saving ? "opacity-60" : ""} ${enabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              {/* Standart holatda o'chiq (opt-in). Bu, boshqa
                  sozlamalardan farqli, matnni AI yozadi va sotuvchi
                  tasdiqisiz yuboradi — shuning uchun tavsif orqali aniq
                  tushuntiriladi, nima o'zgarishini yashirmasdan. */}
              <div className="pt-3 border-t border-slate-50 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex-1">{t("aiCeo.autoWinBackTitle")}</span>
                  <button
                    type="button"
                    onClick={handleAutoWinBackToggle}
                    disabled={savingAutoWinBack}
                    aria-label={t("aiCeo.autoWinBackTitle")}
                    className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${savingAutoWinBack ? "opacity-60" : ""} ${autoWinBackEnabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("aiCeo.autoWinBackDesc")}</p>
              </div>

              {/* Xuddi shu avtonom ijro mantig'i, sevimlilar eslatmasi
                  uchun. */}
              <div className="pt-3 border-t border-slate-50 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex-1">{t("aiCeo.autoFavoriteTitle")}</span>
                  <button
                    type="button"
                    onClick={handleAutoFavoriteToggle}
                    disabled={savingAutoFavorite}
                    aria-label={t("aiCeo.autoFavoriteTitle")}
                    className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${savingAutoFavorite ? "opacity-60" : ""} ${autoFavoriteEnabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("aiCeo.autoFavoriteDesc")}</p>
              </div>

              {/* "Avtonom qaytarish xabari"ning kuchaytirilgan varianti —
                  shuning uchun `autoWinBackEnabled` yoqilmagan bo'lsa,
                  tugma o'chirilgan (kulrang) va bosilmaydi, bog'liqlik
                  aniq ko'rinadi uchun. */}
              <div className="pt-3 border-t border-slate-50 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-bold flex-1 ${autoWinBackEnabled ? "text-slate-700 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"}`}>{t("aiCeo.autoDiscountTitle")}</span>
                  <button
                    type="button"
                    onClick={handleAutoDiscountToggle}
                    disabled={savingAutoDiscount || !autoWinBackEnabled}
                    aria-label={t("aiCeo.autoDiscountTitle")}
                    className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${(savingAutoDiscount || !autoWinBackEnabled) ? "opacity-50" : ""} ${autoDiscountEnabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                  {autoWinBackEnabled ? t("aiCeo.autoDiscountDesc") : t("aiCeo.autoDiscountRequiresWinBackNote")}
                </p>
                {autoDiscountEnabled && autoWinBackEnabled && (
                  <div className="pt-1.5">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1">{t("aiCeo.autoDiscountPercentLabel")}</p>
                    <CustomSelect value={discountPercent} onChange={handleDiscountPercentChange} options={discountPercentOptions} disabled={savingDiscountPercent} />
                  </div>
                )}
              </div>

              {/* Telegram orqali "1-tugmali tasdiqlash": Mini App'ni
                  ochmasdan, AI CEO tavsiyasini to'g'ridan-to'g'ri
                  Telegram chatida bitta tugma bilan tasdiqlash mumkin. */}
              <div className="pt-3 border-t border-slate-50 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex-1">{t("aiCeo.telegramApprovalTitle")}</span>
                  <button
                    type="button"
                    onClick={handleTelegramApprovalToggle}
                    disabled={savingTelegramApproval}
                    aria-label={t("aiCeo.telegramApprovalTitle")}
                    className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${savingTelegramApproval ? "opacity-60" : ""} ${telegramApprovalEnabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("aiCeo.telegramApprovalDesc")}</p>
              </div>

              {/* YANGI (#116): mahsulot qo'shilganda avtomatik story
                  rasm generatsiyasi - standart holatda o'chiq. */}
              <div className="pt-3 border-t border-slate-50 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex-1">{t("aiCeo.autoStoryImageTitle")}</span>
                  <button
                    type="button"
                    onClick={handleAutoStoryImageToggle}
                    disabled={savingAutoStoryImage}
                    aria-label={t("aiCeo.autoStoryImageTitle")}
                    className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${savingAutoStoryImage ? "opacity-60" : ""} ${autoStoryImageEnabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("aiCeo.autoStoryImageDesc")}</p>
              </div>

              {/* MENEJERGA ogohlantirishlar (2026-09 punkt-royxati, 5-band)
                  - ikkalasi ham xaridorga emas, SOTUVCHINING O'ZIGA
                  yuboriladi, standart holatda o'chiq. */}
              <div className="pt-3 border-t border-slate-50 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex-1">{t("aiCeo.lowStockAlertTitle")}</span>
                  <button
                    type="button"
                    onClick={handleLowStockAlertToggle}
                    disabled={savingLowStockAlert}
                    aria-label={t("aiCeo.lowStockAlertTitle")}
                    className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${savingLowStockAlert ? "opacity-60" : ""} ${lowStockAlertEnabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("aiCeo.lowStockAlertDesc")}</p>
              </div>

              <div className="pt-3 border-t border-slate-50 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex-1">{t("aiCeo.staleOrderAlertTitle")}</span>
                  <button
                    type="button"
                    onClick={handleStaleOrderAlertToggle}
                    disabled={savingStaleOrderAlert}
                    aria-label={t("aiCeo.staleOrderAlertTitle")}
                    className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${savingStaleOrderAlert ? "opacity-60" : ""} ${staleOrderAlertEnabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("aiCeo.staleOrderAlertDesc")}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCapabilities && <CapabilitiesModal onClose={() => setShowCapabilities(false)} t={t} />}
    </div>
  );
};

export default AiCeoInfoPage;
