import { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Bot, TrendingUp, TrendingDown, Package, Instagram, Users, Check, Clock,
  Info, Settings, X, Tag, RotateCcw, ShoppingCart, Heart, Send, Loader2, RefreshCw,
  ChevronRight, Star, MessageCircle, Zap, Sparkles, HelpCircle, Target,
  FileWarning, ImageOff, Crown, Megaphone, Flame,
} from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { formatTimeSaved } from "@/utils/formatTimeSaved";
import { generateDailyAiCeoReport, askAiCeo } from "@/services/ai/aiCeoInsights";
import { useLanguage } from "@/context/LanguageContext";
import { getEffectiveTariffPlan } from "@/utils/tariffLimits";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import BiznesBadge from "@/components/ui/BiznesBadge";

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
  const { store } = useSession();
  // "AI Business Manager" (Z-Biznes) tavsiya etilgan savol tugmalari
  // FAQAT samarali tarifi "biznes" bo'lgan sotuvchiga ko'rsatiladi -
  // gatelashning HAQIQIY joyi backend'da (`handleAskAiCeo`dagi
  // `getEffectiveTariffPlan`), bu yerdagi tekshiruv faqat UI'ni mos
  // ravishda ko'rsatish/yashirish uchun.
  const isBiznes = getEffectiveTariffPlan(store) === "biznes";
  const [showCapabilities, setShowCapabilities] = useState(false);

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
        {/* "AI CEO'ni to'liq yoqish" katta tugmasi VA "Kengaytirilgan
            sozlamalar" (oldin shu sahifaning O'ZIDA, pastda edi) endi
            ALOHIDA sahifaga (`AiCeoSettingsPage.jsx`) ko'chirilgan -
            shu tugma o'sha yerga olib boradi. */}
        <button
          type="button"
          onClick={() => navigate("/seller/ai-ceo/settings")}
          className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 active:scale-95 transition-transform shrink-0"
          aria-label={t("aiCeo.advancedSettingsTitle")}
        >
          <Settings size={15} />
        </button>
        {/* "AI CEO nima qila oladi" ma'lumoti shu kichik tugma orqali
            alohida modalda ochiladi. Rangi loyihada ishlatilgan
            YASHIL (emerald) - avval indigo edi, sozlamalar tugmasi
            qo'shilgach ikkalasi bir xil ko'k rangda "chalkashib"
            qolmasligi uchun. */}
        <button
          type="button"
          onClick={() => setShowCapabilities(true)}
          className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center active:scale-95 transition-transform shrink-0"
          aria-label={t("aiCeo.infoPageTitle")}
        >
          <Info size={16} />
        </button>
      </div>

      <div className="p-4 space-y-4 pb-36">

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
                  <BiznesBadge label={t("aiCeo.suggestedQuestionsBiznesLabel")} />

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

      </div>

      {showCapabilities && <CapabilitiesModal onClose={() => setShowCapabilities(false)} t={t} />}
    </div>
  );
};

export default AiCeoInfoPage;
