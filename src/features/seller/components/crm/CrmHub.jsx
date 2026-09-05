import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Search, Star, AlertTriangle, RefreshCw, Users, Sparkles, ChevronRight,
  X, Phone, MessageCircle, Send, UploadCloud, Trash2, Link2, Loader2,
  TrendingUp, Ticket, Bot, Wand2,
} from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useCustomerSegments } from "@/hooks/seller/useCustomerSegments";
import { useCoupons } from "@/hooks/seller/useCoupons";
import { useUploadImage } from "@/hooks/storage/useUploadStorage";
import { sendCrmNotification } from "@/services/crm/sendNotification";
import { getCustomerNote, saveCustomerNote } from "@/services/crm/customerNotes";
import { getCustomerOrderHistory } from "@/services/orders/getOrderData";
import { generateCrmCampaign } from "@/services/ai/aiCeoInsights";
import Toast from "@/components/ui/Toast";
import CustomSelect from "@/components/ui/CustomSelect";
import StoreLinkPicker from "@/features/seller/components/shared/StoreLinkPicker";
import { GridSkeleton } from "@/components/ui/Skeleton";
import { useLanguage } from "@/context/LanguageContext";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import CustomerIntelligencePanel from "@/features/seller/components/crm/CustomerIntelligencePanel";

const SEGMENT_ICONS = { all: Users, vip: Star, churn: AlertTriangle, regular: RefreshCw, new: Sparkles };

const BADGE_STYLE = {
  vip: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  churn: "bg-rose-500/15 text-rose-400 border border-rose-500/30",
  regular: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  new: "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30",
};

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
// Bu sahifa boshqa barcha sotuvchi sahifalari kabi yorug'/qorong'i
// mavzuga moslashuvchan.
const CrmHub = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const { sellerId, store } = useSession();
  const { customers, counts, averageLtv, retentionRate, loading, isApproximate } = useCustomerSegments();
  // AI CEO faqat premium ("aiCeoEnabled") sotuvchilar uchun ko'rinadi va
  // faqat aniq taktikasi bor segmentlar (VIP, "uxlab qolgan mijozlar")
  // uchun ishlaydi — "Barchasi" auditoriyasi uchun yagona to'g'ri taktika
  // yo'q, shuning uchun bu holatda taklif qilinmaydi.
  const aiCeoEnabled = store?.aiCeoEnabled === true;
  const { coupons } = useCoupons(sellerId);
  const { uploadImage, loading: uploadingBanner, progress: uploadProgress } = useUploadImage();
  const activeCoupons = useMemo(
    () => coupons.filter((c) => c.isActive && (!c.expiresAt || new Date(c.expiresAt).getTime() >= Date.now())),
    [coupons]
  );

  const SEGMENT_META = {
    all: { label: t("crmHub.segmentAll"), icon: SEGMENT_ICONS.all },
    vip: { label: t("crmHub.segmentVip"), icon: SEGMENT_ICONS.vip },
    churn: { label: t("crmHub.segmentChurn"), icon: SEGMENT_ICONS.churn },
    regular: { label: t("crmHub.segmentRegular"), icon: SEGMENT_ICONS.regular },
    new: { label: t("crmHub.segmentNew"), icon: SEGMENT_ICONS.new },
  };
  const BADGE_LABEL = { vip: t("crmHub.badgeVip"), churn: t("crmHub.badgeChurn"), regular: t("crmHub.badgeRegular"), new: t("crmHub.badgeNew") };
  const AUDIENCE_OPTIONS = [
    { value: "all", label: t("crmHub.audienceAll") },
    { value: "vip", label: t("crmHub.audienceVip") },
    { value: "churn", label: t("crmHub.audienceChurn") },
  ];

  const [searchQuery, setSearchQuery] = useState("");
  const [activeSegment, setActiveSegment] = useState("all");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerNote, setCustomerNote] = useState("");

  useEscapeToClose(() => setSelectedCustomer(null), Boolean(selectedCustomer));
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteToast, setNoteToast] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [customerOrdersLoading, setCustomerOrdersLoading] = useState(false);

  // Agar URL'da `?audience=vip` (yoki "churn") parametri bo'lsa, forma
  // o'sha segment bilan ochiladi — sotuvchi qayta tanlashi shart emas.
  const [audience, setAudience] = useState(() => {
    const fromUrl = searchParams.get("audience");
    return fromUrl === "vip" || fromUrl === "churn" ? fromUrl : "all";
  });
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
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

  // Mijoz kartochkasi bosilganda, o'sha mijoz haqidagi saqlangan
  // izohni serverdan yuklaydi (barcha mijozlarning izohini oldindan
  // yuklab olish o'rniga — bu, ko'p mijozli do'konlar uchun
  // samaraliroq).
  useEffect(() => {
    if (!selectedCustomer || !sellerId) return;
    let cancelled = false;
    setNoteLoading(true);
    getCustomerNote(sellerId, selectedCustomer.clientId)
      .then((note) => { if (!cancelled) setCustomerNote(note); })
      .catch(() => { if (!cancelled) setCustomerNote(""); })
      .finally(() => { if (!cancelled) setNoteLoading(false); });
    return () => { cancelled = true; };
  }, [selectedCustomer, sellerId]);

  // Mijozning to'liq xarid tarixi ro'yxat bilan birga (barcha mijozlar
  // uchun oldindan) yuklanmaydi — mijoz yig'ma yozuvi
  // (`useCustomerSegments`) faqat jamlangan sonlarni (LTV, buyurtmalar
  // soni) o'z ichiga oladi. Shuning uchun, xuddi izohlar (Notes) kabi,
  // kartochka bosilganda faqat o'sha bitta mijoz uchun, talab bo'yicha
  // yuklanadi.
  useEffect(() => {
    if (!selectedCustomer || !sellerId) {
      setCustomerOrders([]);
      setCustomerOrdersLoading(false);
      return;
    }
    setCustomerOrdersLoading(true);
    const unsubscribe = getCustomerOrderHistory(
      sellerId,
      selectedCustomer.clientId,
      (orders) => {
        setCustomerOrders(orders);
        setCustomerOrdersLoading(false);
      },
      () => {
        setCustomerOrders([]);
        setCustomerOrdersLoading(false);
      }
    );
    return () => unsubscribe();
  }, [selectedCustomer, sellerId]);

  const handleSaveNote = useCallback(async () => {
    if (!selectedCustomer) return;
    setNoteSaving(true);
    try {
      await saveCustomerNote(sellerId, selectedCustomer.clientId, customerNote);
      setNoteToast(t("crmHub.noteSaved"));
    } catch {
      setNoteToast(t("crmHub.noteSaveFailed"));
    } finally {
      setNoteSaving(false);
    }
  }, [sellerId, selectedCustomer, customerNote]);

  const visibleCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return customers.filter((c) => {
      const matchesSegment = activeSegment === "all" || c.segment === activeSegment;
      if (!matchesSegment) return false;
      if (!query) return true;
      return (
        c.fullName.toLowerCase().includes(query) ||
        (c.phone || "").toLowerCase().includes(query)
      );
    });
  }, [customers, activeSegment, searchQuery]);

  const audienceTargetIds = useMemo(() => {
    if (audience === "all") return customers.map((c) => c.clientId);
    return customers.filter((c) => c.segment === audience).map((c) => c.clientId);
  }, [customers, audience]);

  // AI CEO faqat "vip"/"churn" auditoriyasi tanlanganda ishlatilishi
  // mumkin — bularning har biri uchun aniq, isbotlangan taktika mavjud
  // (qarang: `functions/aiCeo.js`dagi `CRM_SEGMENT_TACTICS`).
  const canUseAiSuggestion = aiCeoEnabled && (audience === "vip" || audience === "churn");

  const handleAiSuggest = useCallback(async () => {
    if (!canUseAiSuggestion) return;
    setAiSuggestLoading(true);
    setAiSuggestError(null);
    setAiReasoning(null);
    try {
      const result = await generateCrmCampaign({
        segment: audience,
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
  }, [canUseAiSuggestion, audience, audienceTargetIds.length, store, t]);

  // `?autoAi=1` parametri bilan kelingan bo'lsa ("Bugungi rejalar"
  // markazidan bitta tugma bilan), mijozlar ro'yxati yuklangandan keyin
  // (aniq sonini bilish uchun) AI tavsiyasi avtomatik, bir marta ishga
  // tushadi — sotuvchi bu yerga kelib yana bitta tugma bosishi shart
  // emas.
  const autoAiTriggeredRef = useRef(false);
  useEffect(() => {
    if (autoAiTriggeredRef.current) return;
    if (loading) return;
    if (searchParams.get("autoAi") !== "1") return;
    if (!canUseAiSuggestion) return;
    autoAiTriggeredRef.current = true;
    // URL orqali kelgan bir martalik avtomatik ishga tushirish (yuqoridagi
    // `autoAiTriggeredRef` orqali qayta ishga tushishdan himoyalangan) —
    // `handleAiSuggest` haqiqiy tarmoq so'rovini boshlaydigan funksiya,
    // oddiy holat sinxronizatsiyasi emas.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleAiSuggest();
  }, [loading, canUseAiSuggestion, searchParams, handleAiSuggest]);

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
          <h1 className="text-base font-black text-slate-900 dark:text-white">{t("crmHub.title")}</h1>
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

        {/* MIJOZLAR RAZVEDKASI (Z-Biznes, 9-band) — Z-Pro'ning yuqoridagi
            4-segmentli oddiy CRM'idan ATAYLAB alohida, qo'shimcha panel
            (batafsil izoh: `CustomerIntelligencePanel.jsx`). Biznes
            tarifi bo'lmagan sotuvchiga upsell ko'rinishini o'zi ko'rsatadi. */}
        <CustomerIntelligencePanel />

        {/* SEARCH & SEGMENTATION */}
        <div className="space-y-2.5">
          <div className="relative">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 dark:text-slate-500">
              <Search size={15} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("crmHub.searchPlaceholder")}
              className="w-full h-11 pl-9 pr-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {Object.entries(SEGMENT_META).map(([key, meta]) => {
              const Icon = meta.icon;
              const isActive = activeSegment === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveSegment(key)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800"
                  }`}
                >
                  <Icon size={13} />
                  <span className="text-[11px] font-bold whitespace-nowrap">{meta.label} ({counts[key]})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* CUSTOMER LIST */}
        <div className="space-y-2">
          {loading && <GridSkeleton count={3} />}

          {!loading && visibleCustomers.length === 0 && (
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-8">{t("crmHub.noCustomers")}</p>
          )}

          {!loading && visibleCustomers.map((c) => {
            const initial = (c.fullName || "?").trim().charAt(0).toUpperCase();
            return (
              <div
                key={c.clientId}
                onClick={() => setSelectedCustomer(c)}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-3 shadow-md hover:border-indigo-500/50 transition cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/15 text-indigo-400 font-black text-sm flex items-center justify-center shrink-0">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{c.fullName}</p>
                      {c.segment !== "all" && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${BADGE_STYLE[c.segment]}`}>
                          {BADGE_LABEL[c.segment]}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {c.orderCount} {t("crmHub.orderCountSuffix")} · {c.daysSinceLastOrder} {t("crmHub.daysAgoSuffix")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-black text-emerald-400">{c.ltv.toLocaleString()} so'm</span>
                  <ChevronRight size={16} className="text-slate-400 dark:text-slate-500" />
                </div>
              </div>
            );
          })}
        </div>

        {/* TELEGRAM BROADCAST TERMINAL */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3.5">
          <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("crmHub.broadcastTitle")}</h3>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("crmHub.audienceLabel")}</label>
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
          </div>

          <form onSubmit={handleSend} className="space-y-2.5">

            {/* AI CEO "senior sotuv menejeri" tavsiyasi. Faqat premium
                ("aiCeoEnabled") sotuvchilar ko'radi. Bosilganda, tanlangan
                segment uchun Gemini orqali tayyor sarlavha va xabar
                yaratiladi hamda pastdagi (mavjud) maydonlarga to'g'ridan-
                to'g'ri joylanadi — sotuvchi ko'rib chiqadi, xohlasa
                tahrirlaydi va o'zi pastdagi "Yuborish" tugmasini bosadi.
                AI hech qachon o'zi xabar yubormaydi. */}
            {aiCeoEnabled && (
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
                {audience === "all" && (
                  <p className="text-[10px] text-indigo-500/80 dark:text-indigo-400/70">{t("crmHub.aiSuggestSelectSegmentHint")}</p>
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

      {/* CUSTOMER DETAIL MODAL */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedCustomer(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 rounded-t-3xl p-4 pb-8 max-h-[85vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-indigo-500/15 text-indigo-400 font-black text-base flex items-center justify-center">
                  {(selectedCustomer.fullName || "?").trim().charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{selectedCustomer.fullName}</p>
                  {selectedCustomer.segment !== "regular" && (
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${BADGE_STYLE[selectedCustomer.segment]}`}>
                      {BADGE_LABEL[selectedCustomer.segment]}
                    </span>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => setSelectedCustomer(null)} className="p-1.5 text-slate-500 dark:text-slate-400">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {selectedCustomer.phone && (
                <a href={`tel:${selectedCustomer.phone}`} className="h-10 bg-[#F4F5F9] dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <Phone size={13} /> {t("crmHub.callBtn")}
                </a>
              )}
              <a href={`tg://user?id=${selectedCustomer.clientId}`} className="h-10 bg-[#F4F5F9] dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                <MessageCircle size={13} /> {t("crmHub.telegramBtn")}
              </a>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-[#F4F5F9] dark:bg-slate-800 rounded-xl p-3">
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">{t("crmHub.totalSpent")}</p>
                <p className="text-sm font-black text-emerald-400">{selectedCustomer.ltv.toLocaleString()} so'm</p>
              </div>
              <div className="bg-[#F4F5F9] dark:bg-slate-800 rounded-xl p-3">
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">{t("crmHub.ordersLabel")}</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">{selectedCustomer.orderCount} ta</p>
              </div>
            </div>

            {/* ADMIN IZOHI (Notes) */}
            <div className="mb-4">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">{t("crmHub.noteLabel")}</label>
              <textarea
                rows="2"
                disabled={noteLoading}
                placeholder={noteLoading ? t("crmHub.noteLoadingPlaceholder") : t("crmHub.notePlaceholder")}
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                className="w-full p-2.5 bg-[#F4F5F9] dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-60"
              />
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={noteSaving || noteLoading}
                className="mt-1.5 text-[10px] font-bold text-indigo-400 disabled:opacity-50"
              >
                {noteSaving ? t("crmHub.noteSaving") : t("crmHub.noteSaveBtn")}
              </button>
            </div>

            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">{t("crmHub.purchaseHistory")}</h4>
            <div className="space-y-2">
              {customerOrdersLoading && <GridSkeleton count={2} />}
              {!customerOrdersLoading && customerOrders.length === 0 && (
                <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-4">{t("crmHub.noOrdersYet")}</p>
              )}
              {!customerOrdersLoading && customerOrders.map((o) => (
                <div key={o.id} className="bg-[#F4F5F9] dark:bg-slate-800 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">#{o.id.slice(0, 6)}</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{Number(o.totalAmount || 0).toLocaleString()} so'm</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{o.createdAt ? new Date(o.createdAt).toLocaleDateString("uz-UZ") : ""}</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 capitalize">{t(`orderStatus.${o.status}`)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {sendToast && <Toast message={sendToast} onDone={() => setSendToast(null)} />}
      {noteToast && <Toast message={noteToast} onDone={() => setNoteToast(null)} duration={1500} />}
      {showLinkPicker && (
        <StoreLinkPicker onSelect={(option) => setButtonUrl(option.externalUrl)} onClose={() => setShowLinkPicker(false)} />
      )}
    </div>
  );
};

export default CrmHub;
