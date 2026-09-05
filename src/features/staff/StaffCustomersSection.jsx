import { useState, useMemo, useCallback, useRef } from "react";
import {
  Search, Star, AlertTriangle, RefreshCw, Users, Sparkles,
  Send, UploadCloud, Trash2, Link2, Loader2,
} from "lucide-react";
import { useStaffSession } from "@/context/StaffSessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { useStaffCustomerSegments } from "@/hooks/staff/useStaffCustomerSegments";
import { useCoupons } from "@/hooks/seller/useCoupons";
import { useUploadImage } from "@/hooks/storage/useUploadStorage";
import { sendCrmNotification } from "@/services/crm/sendNotification";
import Toast from "@/components/ui/Toast";
import CustomSelect from "@/components/ui/CustomSelect";
import StoreLinkPicker from "@/features/seller/components/shared/StoreLinkPicker";
import { GridSkeleton } from "@/components/ui/Skeleton";

const SEGMENT_ICONS = { all: Users, vip: Star, churn: AlertTriangle, regular: RefreshCw, new: Sparkles };
const BADGE_STYLE = {
  vip: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  churn: "bg-rose-500/15 text-rose-400 border border-rose-500/30",
  regular: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  new: "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30",
};

/**
 * Xodim Mini App'i — "Mijozlar" (CRM) bo'limi. Faqat `permissions.
 * manageCustomers` ruxsatiga ega xodimga ko'rsatiladi (masalan
 * "Marketing menejeri"/"Sotuv menejeri" roli, 2026-09 punkt-royxati,
 * 2-band "Advanced Team & RBAC" — foydalanuvchining ANIQ so'ragan
 * misoli: "Marketing menejeri mahsulotlarni ko'radi, kampaniya
 * yaratadi, CRM'ni ko'radi").
 *
 * `src/features/seller/components/crm/CrmHub.jsx`ning ATAYLAB
 * QISQARTIRILGAN versiyasi — bir xil HAQIQIY manbalardan (mijozlar
 * segmentatsiyasi, broadcast) foydalanadi, lekin QUYIDAGILAR ATAYLAB
 * YO'Q: (1) mijoz eslatmalari (`customerNotes`) va xarid tarixi
 * modali — bular UCHUN kerak bo'ladigan `customerNotes`/`orders`
 * o'qish ruxsati xodimga (agar `manageOrders`ga ega bo'lmasa) HALI
 * berilmagan (`firestore.rules`); (2) AI CEO tavsiyasi — bu funksiya
 * ro'yxatida xodim UCHUN UMUMAN mavjud emas.
 */
const StaffCustomersSection = () => {
  const { t } = useLanguage();
  const { sellerId } = useStaffSession();
  const { customers, counts, averageLtv, retentionRate, loading, isApproximate } = useStaffCustomerSegments(sellerId);
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
  const [audience, setAudience] = useState("all");
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

  const visibleCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return customers.filter((c) => {
      const matchesSegment = activeSegment === "all" || c.segment === activeSegment;
      if (!matchesSegment) return false;
      if (!query) return true;
      return c.fullName.toLowerCase().includes(query) || (c.phone || "").toLowerCase().includes(query);
    });
  }, [customers, activeSegment, searchQuery]);

  const audienceTargetIds = useMemo(() => {
    if (audience === "all") return customers.map((c) => c.clientId);
    return customers.filter((c) => c.segment === audience).map((c) => c.clientId);
  }, [customers, audience]);

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
  }, [t]);

  const handleRemoveBanner = useCallback((e) => {
    e.stopPropagation();
    setBannerFile(null);
    setBannerPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // MUHIM: `sellerId` bu yerda `useStaffSession()`dan keladi — HAQIQIY
  // sotuvchi ID'si (xodimning O'Z ID'si emas). `sendCrmNotification`
  // Cloud Function darajasida ham xodimning `manageCustomers`
  // ruxsatini QAYTA tekshiradi (`resolveActingSellerContext`) — bu
  // yerdagi tekshiruv (bo'lim FAQAT ruxsat bo'lsa ko'rinadi) faqat UX
  // uchun, HAQIQIY xavfsizlik backendda.
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
  }, [title, message, bannerFile, buttonText, buttonUrl, couponCode, audienceTargetIds, sellerId, uploadImage, t]);

  return (
    <div className="p-4 space-y-5 pb-24">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-3">
          <Users size={14} className="text-indigo-400 mb-1.5" />
          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("crmHub.totalCustomers")}</p>
          <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{counts.all} ta</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-3">
          <RefreshCw size={14} className="text-violet-400 mb-1.5" />
          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("crmHub.avgLtv")}</p>
          <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5 truncate">{averageLtv.toLocaleString()} so'm</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-3">
          <RefreshCw size={14} className="text-emerald-400 mb-1.5" />
          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("crmHub.retention")}</p>
          <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{retentionRate}%</p>
        </div>
      </div>

      {isApproximate && (
        <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/30 rounded-xl px-3 py-2">
          {t("crmHub.approximateNotice")}
        </div>
      )}

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
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-3 shadow-md flex items-center justify-between gap-3"
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
              <span className="text-xs font-black text-emerald-400 shrink-0">{c.ltv.toLocaleString()} so'm</span>
            </div>
          );
        })}
      </div>

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
                <span className="text-[10px] font-semibold text-center px-4">{t("crmHub.bannerDropzone")}</span>
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
                <Send size={15} /> {t("crmHub.sendButton")}
              </>
            )}
          </button>
        </form>
      </div>

      {sendToast && <Toast message={sendToast} onDone={() => setSendToast(null)} />}
      {showLinkPicker && (
        <StoreLinkPicker onSelect={(option) => setButtonUrl(option.externalUrl)} onClose={() => setShowLinkPicker(false)} />
      )}
    </div>
  );
};

export default StaffCustomersSection;
