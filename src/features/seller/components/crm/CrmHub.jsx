import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import {
  ArrowLeft, Star, Gem, Moon, AlertTriangle, Clock, Sparkles, RefreshCw as ReturningIcon,
  UploadCloud, Trash2, Link2, Loader2, TrendingUp, Users, RefreshCw, Ticket, Bot, Wand2, Send, Percent, Flame, ListFilter, Target, X,
} from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useCustomerSegments } from "@/hooks/seller/useCustomerSegments";
import useCustomerIntelligence from "@/hooks/seller/useCustomerIntelligence";
import { useCoupons } from "@/hooks/seller/useCoupons";
import { useUploadImage } from "@/hooks/storage/useUploadStorage";
import { sendCrmNotification } from "@/services/crm/sendNotification";
import { generateCrmCampaign } from "@/services/ai/aiCeoInsights";
import Toast from "@/components/ui/Toast";
import CustomSelect from "@/components/ui/CustomSelect";
import StoreLinkPicker from "@/features/seller/components/shared/StoreLinkPicker";
import { useLanguage } from "@/context/LanguageContext";
import { getEffectiveTariffPlan } from "@/utils/tariffLimits";
import { filterClassifiedCustomers } from "@/utils/customerIntelligence";
import BiznesBadge from "@/components/ui/BiznesBadge";
import CustomerIntelligencePanel from "@/features/seller/components/crm/CustomerIntelligencePanel";

const SEGMENT_ICONS = {
  all: Users, vip: Star, high_value: Gem, sleeping: Moon, churn_risk: AlertTriangle,
  at_risk: Clock, new: Sparkles, returning: ReturningIcon,
};
const TAG_ICONS = { discount_hunter: Percent, high_intent: Flame };

// Retention asosidagi CRM markazi va Telegram orqali broadcast marketing
// vositasi.
//
// Mijozlar ro'yxati, segmentatsiya va Retention Rate — barchasi haqiqiy
// buyurtma ma'lumotidan hisoblanadi. Telegram username saqlanmaydi (faqat
// ID), shuning uchun mijoz bilan bog'lanish uchun `tg://user?id=` chuqur
// havolasi ishlatiladi — bu username bo'lmagan holatda ham ishlaydigan
// ishonchli usul. Broadcast xabarlari haqiqiy Telegram Bot API orqali
// yuboriladi, simulyatsiya emas.
//
// 2026-09 UX TUZATISHI (foydalanuvchi so'rovi): OLDIN bu sahifada Z-Pro
// (`useCustomerSegments`) qidiruv+tab+ro'yxati VA `CustomerIntelligencePanel`
// (Z-Biznes) o'zining alohida ro'yxati BIR SAHIFADA ketma-ket, ikki marta
// ko'rsatilardi. Endi mijozlar RO'YXATI/QIDIRUV/TAFSILOT — FAQAT
// `CustomerIntelligencePanel`da (yagona joy); bu sahifa esa faqat YUQORI
// KO'RSATKICHLAR (Jami mijozlar/LTV/Retention — bularning hisob-kitobi
// `useCustomerSegments`dan, tarifdan qat'i nazar to'g'ri) va XABAR
// YUBORISH TERMINALINI o'z ichiga oladi.
//
// Bu sahifa boshqa barcha sotuvchi sahifalari kabi yorug'/qorong'i
// mavzuga moslashuvchan.
const CrmHub = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const { sellerId, store } = useSession();
  const { customers, counts, averageLtv, retentionRate, loading, isApproximate } = useCustomerSegments();
  const isBiznes = getEffectiveTariffPlan(store) === "biznes";
  // "Mijozlar Razvedkasi" (Z-Biznes) ma'lumoti ENDI shu yerda, ota
  // komponentda, BIR MARTA olinadi — pastdagi `CustomerIntelligencePanel`
  // (ro'yxat/qidiruv uchun) VA quyidagi "Xabar yuborish terminali"
  // (Biznes auditoriya tanlovi uchun, 3-band) IKKALASI ham shu BIR XIL
  // natijani ishlatadi, ikki marta server so'rovi yubormaslik uchun.
  const intelligence = useCustomerIntelligence(isBiznes);
  // AI CEO faqat premium ("aiCeoEnabled") sotuvchilar uchun ko'rinadi —
  // bu Z-Pro va Z-Biznesning ikkalasida ham bo'lishi mumkin bo'lgan,
  // tarifdan MUSTAQIL bayroq (masalan tarif sinovi orqali yoqilgan).
  const aiCeoEnabled = store?.aiCeoEnabled === true;
  const { coupons } = useCoupons(sellerId);
  const { uploadImage, loading: uploadingBanner, progress: uploadProgress } = useUploadImage();
  const activeCoupons = useMemo(
    () => coupons.filter((c) => c.isActive && (!c.expiresAt || new Date(c.expiresAt).getTime() >= Date.now())),
    [coupons]
  );

  const AUDIENCE_OPTIONS = [
    { value: "all", label: t("crmHub.audienceAll") },
    { value: "vip", label: t("crmHub.audienceVip") },
    { value: "churn", label: t("crmHub.audienceChurn") },
  ];
  const SEGMENT_SELECT_OPTIONS = ["all", "vip", "high_value", "sleeping", "churn_risk", "at_risk", "new", "returning"].map((key) => ({
    value: key,
    label: `${t(`customerIntelligence.segment.${key}`)} (${intelligence.data ? (key === "all" ? intelligence.data.counts.all : intelligence.data.counts[key] || 0) : 0})`,
    icon: SEGMENT_ICONS[key],
  }));
  const TAG_SELECT_OPTIONS = [
    { value: "none", label: t("customerIntelligence.tagNone"), icon: ListFilter },
    ...["discount_hunter", "high_intent"].map((key) => ({
      value: key,
      label: `${t(`customerIntelligence.tag.${key}`)} (${intelligence.data?.tagCounts?.[key] || 0})`,
      icon: TAG_ICONS[key],
    })),
  ];

  // Bugungi rejalar markazidan (`AiCeoInfoPage.jsx`) `?audience=vip`
  // yoki `?audience=churn` bilan kelingan bo'lsa, forma o'sha auditoriya
  // bilan ochiladi — bu havola Z-Pro VA Z-Biznes sotuvchisiga BIR XIL
  // ishlaydi (kunlik AI CEO hisoboti tarifdan mustaqil). Z-Biznes uchun
  // "churn" -> "churn_risk" segmentiga mos keladi (yangi 7-segment
  // tasnifidagi ekvivalenti).
  const [audience, setAudience] = useState(() => {
    const fromUrl = searchParams.get("audience");
    return fromUrl === "vip" || fromUrl === "churn" ? fromUrl : "all";
  });
  const [audienceSegment, setAudienceSegment] = useState(() => {
    const fromUrl = searchParams.get("audience");
    if (fromUrl === "vip") return "vip";
    if (fromUrl === "churn") return "churn_risk";
    return "all";
  });
  const [audienceTag, setAudienceTag] = useState("none");

  // MAXSUS (ANIQ) AUDITORIYA — Biznes Buyruq Markazidagi xulosalardan
  // ("qayta xarid vaqti kelgan mijozlar" kabi) "Xabar yubor" tugmasi
  // bosilganda shu yerga navigatsiya HOLATI (`location.state`) orqali
  // keladi (2026-09, foydalanuvchi so'rovi bo'yicha qo'shilgan haqiqiy
  // "buyruq"). Bu — na Z-Pro'ning 3 tugmali, na Z-Biznesning segment/
  // belgi tanlovi bilan mos kelmaydigan, ANIQ hisoblangan `clientId`
  // ro'yxati (masalan mijozning o'z tarixidagi xarid oralig'iga
  // asoslangan heuristika) — shuning uchun uni soxta ravishda biror
  // nomlangan segmentga "moslashtirib qo'yish" (HALOLLIK qoidasiga zid
  // bo'lardi) o'rniga, alohida, aniq belgilangan auditoriya sifatida
  // saqlaymiz va u faol bo'lganda segment/belgi tanlovlarini vaqtincha
  // almashtiradi (pastda "Bekor qilish" bilan tozalanadi).
  const [customAudience, setCustomAudience] = useState(() => {
    const incoming = location.state?.customAudience;
    if (incoming && Array.isArray(incoming.clientIds) && incoming.clientIds.length > 0) {
      return {
        clientIds: incoming.clientIds,
        label: incoming.label || "",
        initialTitle: incoming.initialTitle || "",
        initialMessage: incoming.initialMessage || "",
      };
    }
    return null;
  });

  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [title, setTitle] = useState(() => customAudience?.initialTitle || "");
  const [message, setMessage] = useState(() => customAudience?.initialMessage || "");
  const [couponCode, setCouponCode] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendToast, setSendToast] = useState(null);
  const [sendError, setSendError] = useState(null);
  const fileInputRef = useRef(null);

  // AI CEO CRM segment kampaniyasi holati (AI yozgan matn va "nega bu
  // taktika samarali" izohi) yuqoridagi forma maydonlariga to'g'ridan-
  // to'g'ri joylanadi — alohida "AI oynasi" emas, mavjud yuborish
  // formasining o'zi ishlatiladi.
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);
  const [aiSuggestError, setAiSuggestError] = useState(null);
  const [aiReasoning, setAiReasoning] = useState(null);

  const audienceTargetIds = useMemo(() => {
    if (customAudience) return customAudience.clientIds;
    if (isBiznes) {
      return filterClassifiedCustomers(intelligence.data?.customers, {
        segment: audienceSegment,
        tag: audienceTag === "none" ? null : audienceTag,
      }).map((c) => c.clientId);
    }
    if (audience === "all") return customers.map((c) => c.clientId);
    return customers.filter((c) => c.segment === audience).map((c) => c.clientId);
  }, [customAudience, isBiznes, intelligence.data, audienceSegment, audienceTag, audience, customers]);

  // AI CEO — Z-Biznesda YANGI 7-segment+2-belgi tasnifidagi HAR QANDAY
  // aniq tanlov (segment YOKI belgi, "barchasi" bo'lmagan) uchun ishlaydi
  // (barchasi uchun `functions/aiCeo.js`dagi `CRM_SEGMENT_TACTICS`da
  // taktika bor). Belgi tanlangan bo'lsa, u SEGMENTdan ko'ra ANIQROQ
  // xulq-atvor signali bo'lgani uchun ustuvor olinadi. Z-Pro'da esa
  // avvalgidek FAQAT vip/churn uchun.
  const effectiveAiSegment = isBiznes ? (audienceTag !== "none" ? audienceTag : audienceSegment) : audience;
  // Maxsus auditoriya nomlangan segment/belgi EMAS — `CRM_SEGMENT_TACTICS`
  // (AI taktikasi) faqat nomlangan kalitlar uchun mavjud, shuning uchun
  // maxsus auditoriya faol bo'lganda AI tavsiyasi ATAYLAB o'chiriladi
  // (sotuvchi bu holatda matnni o'zi yozadi yoki yuqoridan kelgan
  // andozani tahrirlaydi).
  const canUseAiSuggestion = aiCeoEnabled && !customAudience && effectiveAiSegment !== "all";

  const handleAiSuggest = useCallback(async () => {
    if (!canUseAiSuggestion) return;
    setAiSuggestLoading(true);
    setAiSuggestError(null);
    setAiReasoning(null);
    try {
      const result = await generateCrmCampaign({
        segment: effectiveAiSegment,
        segmentCount: audienceTargetIds.length,
        storeName: store?.storeName,
      });
      setTitle(result.title || "");
      setMessage(result.message || "");
      setAiReasoning(result.reasoning || null);
    } catch (err) {
      setAiSuggestError(err.message || t("crmHub.aiSuggestError"));
    } finally {
      setAiSuggestLoading(false);
    }
  }, [canUseAiSuggestion, effectiveAiSegment, audienceTargetIds.length, store, t]);

  // `?autoAi=1` parametri bilan kelingan bo'lsa ("Bugungi rejalar"
  // markazidan bitta tugma bilan), tegishli mijozlar ma'lumoti
  // yuklangandan keyin (aniq sonini bilish uchun) AI tavsiyasi
  // avtomatik, bir marta ishga tushadi — sotuvchi bu yerga kelib yana
  // bitta tugma bosishi shart emas. Z-Biznesda "tegishli ma'lumot" —
  // `intelligence` (Mijozlar Razvedkasi), Z-Pro'da — yuqoridagi
  // `useCustomerSegments`.
  const relevantDataLoading = isBiznes ? (intelligence.loading && !intelligence.data) : loading;
  const autoAiTriggeredRef = useRef(false);
  useEffect(() => {
    if (autoAiTriggeredRef.current) return;
    if (relevantDataLoading) return;
    if (searchParams.get("autoAi") !== "1") return;
    if (!canUseAiSuggestion) return;
    autoAiTriggeredRef.current = true;
    // URL orqali kelgan bir martalik avtomatik ishga tushirish (yuqoridagi
    // `autoAiTriggeredRef` orqali qayta ishga tushishdan himoyalangan) —
    // `handleAiSuggest` haqiqiy tarmoq so'rovini boshlaydigan funksiya,
    // oddiy holat sinxronizatsiyasi emas.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleAiSuggest();
  }, [relevantDataLoading, canUseAiSuggestion, searchParams, handleAiSuggest]);

  const handleBannerSelect = useCallback((file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSendError(t("crmHub.imageOnlyError"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSendError(t("crmHub.imageSizeError"));
      return;
    }
    setSendError(null);
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  }, []);

  const handleRemoveBanner = useCallback((e) => {
    e.stopPropagation();
    setBannerFile(null);
    setBannerPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleSend = useCallback(async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setSendError(t("crmHub.titleMessageRequired"));
      return;
    }
    if (audienceTargetIds.length === 0) {
      setSendError(t("crmHub.noAudienceCustomers"));
      return;
    }

    setSending(true);
    setSendError(null);
    try {
      // Bannerni FAQAT yuborish bosqichida yuklaymiz — foydalanuvchi
      // rasmni tanlab, keyin fikridan qaytsa, keraksiz yuklashning
      // oldini oladi.
      let bannerImageUrl = null;
      if (bannerFile) {
        bannerImageUrl = await uploadImage(bannerFile, `crm-banners/${sellerId}`);
      }

      const result = await sendCrmNotification({
        sellerId,
        targetClientIds: audienceTargetIds,
        title,
        message,
        bannerImageUrl,
        buttonText: buttonText.trim() || null,
        buttonUrl: buttonUrl.trim() || null,
        couponCode: couponCode || null,
      });
      setSendToast(t("crmHub.sendSuccess", { count: result.clientsSent }));
      setTitle("");
      setMessage("");
      setBannerFile(null);
      setBannerPreview(null);
      setButtonText("");
      setButtonUrl("");
      setCouponCode("");
    } catch (err) {
      setSendError(err.message || t("crmHub.sendError"));
    } finally {
      setSending(false);
    }
  }, [title, message, bannerFile, buttonText, buttonUrl, couponCode, audienceTargetIds, sellerId, uploadImage]);

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-36">

      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-950/95 px-4 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-400 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
            {t("crmHub.title")} {isBiznes && <BiznesBadge size="xs" />}
          </h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("crmHub.subtitle")}</p>
        </div>
      </div>

      <div className="p-4 space-y-5">

        {/* TOP CRM METRICS */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-3">
            <Users size={14} className="text-indigo-400 mb-1.5" />
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("crmHub.totalCustomers")}</p>
            <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{counts.all} ta</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-3">
            <TrendingUp size={14} className="text-emerald-400 mb-1.5" />
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("crmHub.avgLtv")}</p>
            <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5 truncate">{averageLtv.toLocaleString()} so'm</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-3">
            <RefreshCw size={14} className="text-violet-400 mb-1.5" />
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("crmHub.retention")}</p>
            <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{retentionRate}%</p>
          </div>
        </div>

        {/* HALOL ogohlantirish: statistikaning yuqoridagi sonlari
            juda ko'p mijozli sotuvchida (5000+) TAXMINIY ekanini
            ko'rsatadi — batafsil izoh `useCrmOrders.jsx`da. */}
        {isApproximate && (
          <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/30 rounded-xl px-3 py-2">
            {t("crmHub.approximateNotice")}
          </div>
        )}

        {/* MIJOZLAR RO'YXATI/QIDIRUV/TAFSILOT — YAGONA joy (2026-09 UX
            tuzatishi: avval bu yerda IKKINCHI, dublikat ro'yxat ham bor
            edi — olib tashlandi, batafsil izoh yuqorida). Biznes
            bo'lmagan tarifda panel o'zi "yangilang" devorini ko'rsatadi. */}
        <CustomerIntelligencePanel
          data={intelligence.data}
          loading={intelligence.loading}
          error={intelligence.error}
          refetch={intelligence.refetch}
          isBiznes={isBiznes}
        />

        {/* TELEGRAM BROADCAST TERMINAL */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3.5">
          <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("crmHub.broadcastTitle")}</h3>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("crmHub.audienceLabel")}</label>
            {/* MAXSUS AUDITORIYA (masalan Buyruq Markazidan "qayta xarid
                vaqti kelgan mijozlar" kabi aniq hisoblangan ro'yxat)
                faol bo'lsa — oddiy segment/belgi tanlovi o'rniga shu
                chip ko'rsatiladi, "Bekor qilish" bilan oddiy tanlovga
                qaytish mumkin. */}
            {customAudience ? (
              <div className="flex items-center justify-between gap-2 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl px-3 py-2.5">
                <div className="min-w-0 flex items-center gap-2">
                  <Target size={14} className="text-indigo-500 shrink-0" />
                  <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 truncate">{customAudience.label}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomAudience(null)}
                  className="shrink-0 w-6 h-6 rounded-lg bg-white/70 dark:bg-slate-900/50 text-indigo-500 dark:text-indigo-400 flex items-center justify-center active:scale-95 transition-transform"
                  aria-label={t("crmHub.customAudienceClear")}
                >
                  <X size={13} />
                </button>
              </div>
            ) : isBiznes ? (
              /* Z-Biznes: to'liq 7-segment+2-belgi auditoriya tanlovi
                 (2026-09, foydalanuvchi so'rovi: "Mijozlarga xabar
                 yuborish qismini Biznes tarifga moslashtir") — ikkala
                 filtr BIRGALIKDA ishlaydi (masalan "VIP + chegirma
                 ovchisi"). */
              <div className="grid grid-cols-2 gap-1.5">
                <CustomSelect value={audienceSegment} onChange={setAudienceSegment} options={SEGMENT_SELECT_OPTIONS} />
                <CustomSelect value={audienceTag} onChange={setAudienceTag} options={TAG_SELECT_OPTIONS} />
              </div>
            ) : (
              /* Z-Pro: avvalgi 3 tugmali oddiy tanlov, o'zgarishsiz. */
              <div className="grid grid-cols-3 gap-1.5">
                {AUDIENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAudience(opt.value)}
                    className={`h-10 rounded-xl text-[10px] font-bold transition-colors px-1 ${
                      audience === opt.value ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "bg-[#F4F5F9] dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              {t("crmHub.audienceCountHint", { count: audienceTargetIds.length })}
            </p>
          </div>

          <form onSubmit={handleSend} className="space-y-2.5">

            {/* AI CEO "senior sotuv menejeri" tavsiyasi. Faqat premium
                ("aiCeoEnabled") sotuvchilar ko'radi. Bosilganda, tanlangan
                segment/belgi uchun Gemini orqali tayyor sarlavha va xabar
                yaratiladi hamda pastdagi (mavjud) maydonlarga to'g'ridan-
                to'g'ri joylanadi — sotuvchi ko'rib chiqadi, xohlasa
                tahrirlaydi va o'zi pastdagi "Yuborish" tugmasini bosadi.
                AI hech qachon o'zi xabar yubormaydi. */}
            {aiCeoEnabled && !customAudience && (
              <div className="bg-indigo-50/60 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Bot size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="text-[11px] font-black text-indigo-700 dark:text-indigo-300 truncate">{t("crmHub.aiSuggestTitle")}</span>
                  </div>
                  <button
                    type="button"
                    disabled={!canUseAiSuggestion || aiSuggestLoading || sending}
                    onClick={handleAiSuggest}
                    className="shrink-0 h-8 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11px] font-bold rounded-lg flex items-center gap-1.5 active:scale-95 transition-transform"
                  >
                    {aiSuggestLoading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                    {t("crmHub.aiSuggestButton")}
                  </button>
                </div>
                {effectiveAiSegment === "all" && (
                  <p className="text-[10px] text-indigo-500/80 dark:text-indigo-400/70">
                    {isBiznes ? t("crmHub.aiSuggestSelectSegmentHintBiznes") : t("crmHub.aiSuggestSelectSegmentHint")}
                  </p>
                )}
                {aiSuggestError && <p className="text-[10px] text-rose-500 font-semibold">{aiSuggestError}</p>}
                {aiReasoning && (
                  <p className="text-[10px] text-indigo-600/90 dark:text-indigo-300/80 leading-relaxed">
                    <span className="font-bold">{t("crmHub.aiSuggestReasoningLabel")}:</span> {aiReasoning}
                  </p>
                )}
              </div>
            )}

            {/* Banner rasm fayl yuklash orqali tanlanadi (URL matn maydoni
                emas), sudrab tashlash (drag & drop) qo'llab-quvvatlanadi. */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">{t("crmHub.bannerLabel")}</label>
              {bannerPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800">
                  <img src={bannerPreview} alt={t("crmHub.bannerLabel")} className="w-full h-32 object-cover" />
                  <button
                    type="button"
                    onClick={handleRemoveBanner}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ) : (
                <label
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleBannerSelect(e.dataTransfer.files?.[0]); }}
                  className="flex flex-col items-center justify-center gap-1.5 h-24 border border-dashed border-slate-100 dark:border-slate-800 rounded-xl cursor-pointer text-slate-400 dark:text-slate-500 hover:border-indigo-500/50 transition-colors"
                >
                  <UploadCloud size={20} />
                  <span className="text-[10px] font-semibold text-center px-4">
                    {t("crmHub.bannerDropzone")}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    disabled={sending}
                    onChange={(e) => handleBannerSelect(e.target.files?.[0])}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <input
              type="text"
              disabled={sending}
              placeholder={t("crmHub.titlePlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-10 px-3 bg-[#F4F5F9] dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
            />

            <textarea
              rows="3"
              disabled={sending}
              placeholder={t("crmHub.messagePlaceholder")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-3 bg-[#F4F5F9] dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-60"
            />
            {/* HAQIQIY shaxsiylashtirish (mock EMAS) — `automationRules.js`dagi
                avtomatlashtirish qoidalarida ishlatilgan BIR XIL `{ism}`
                naqshi (2026-09, foydalanuvchi so'rovi: "haqiqiy
                productlarda ishlatiladigan top funksiyalardan qo'sh"). */}
            <p className="text-[10px] text-slate-400 dark:text-slate-500 -mt-1">{t("crmHub.personalizeHint")}</p>

            {activeCoupons.length > 0 && (
              <CustomSelect
                disabled={sending}
                value={couponCode}
                onChange={setCouponCode}
                placeholder={t("crmHub.couponSelectDefault")}
                options={activeCoupons.map((c) => ({ value: c.code, label: c.code }))}
              />
            )}

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                disabled={sending}
                placeholder={t("crmHub.buttonTextPlaceholder")}
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                className="h-10 px-3 bg-[#F4F5F9] dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
              />
              <button
                type="button"
                disabled={sending}
                onClick={() => setShowLinkPicker(true)}
                className="w-full h-10 pl-8 pr-2 bg-[#F4F5F9] dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-xs font-medium disabled:opacity-60 relative text-left"
              >
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 dark:text-slate-500">
                  <Link2 size={13} />
                </span>
                <span className={`truncate block ${buttonUrl ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"}`}>
                  {buttonUrl ? t("crmHub.linkSelected") : t("crmHub.buttonUrlPlaceholder")}
                </span>
              </button>
            </div>

            {/* TELEGRAM LIVE PREVIEW */}
            {(title || message || bannerPreview) && (
              <div className="pt-1">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">{t("crmHub.previewLabel")}</p>
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden max-w-[280px]">
                  {bannerPreview && (
                    <img src={bannerPreview} alt="" className="w-full h-32 object-cover" />
                  )}
                  <div className="p-3 space-y-1.5">
                    {title && <p className="text-xs font-black text-slate-900 dark:text-white">{title}</p>}
                    {message && <p className="text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{message}</p>}
                    {couponCode && (
                      <p className="text-[11px] text-indigo-300 flex items-center gap-1">
                        <Ticket size={11} /> {t("crmHub.couponLabel")} <code>{couponCode}</code>
                      </p>
                    )}
                    {buttonText && buttonUrl && (
                      <div className="mt-1.5 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center text-[11px] font-bold text-indigo-300">
                        {buttonText}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {sendError && <p className="text-[11px] text-rose-400 font-semibold">{sendError}</p>}

            <button
              type="submit"
              disabled={sending}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {sending ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  {uploadingBanner ? t("crmHub.uploadingImage", { percent: uploadProgress }) : t("crmHub.sending")}
                </>
              ) : (
                <>
                  <Send size={15} />
                  {t("crmHub.sendButton")}
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {sendToast && <Toast message={sendToast} onDone={() => setSendToast(null)} />}
      {showLinkPicker && (
        <StoreLinkPicker onSelect={(option) => setButtonUrl(option.externalUrl)} onClose={() => setShowLinkPicker(false)} />
      )}
    </div>
  );
};

export default CrmHub;
