import { useState, useMemo, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Eye, EyeOff, Share2, Sparkles, Package, Megaphone, Flame, Bot,
  Wallet, TrendingUp, ArchiveX,
} from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import useGetOrdersData from "@/hooks/seller/useRecentOrders";
import useGetProductsData from "@/hooks/seller/useGetSellerProducts";
import { useOrderRollups } from "@/hooks/seller/useOrderRollups";
import { usePendingOrdersCount } from "@/hooks/seller/usePendingOrdersCount";
import { buildShopLink } from "@/utils/shareLink";
import { getRangeStart, getCalendarMonthRange } from "@/utils/dateRange";
import { computeDashboardStatsFromRollups } from "@/utils/dashboardStats";
import { getVisitorCount } from "@/services/analytics/getVisitorCount";
import { backfillSellerRollups } from "@/services/analytics/backfillRollups";
import { backfillTariffCounters } from "@/services/tariffs/backfillTariffCounters";
import TimeframeTabs from "./TimeframeTabs";
import MonthPickerSheet from "@/components/ui/MonthPickerSheet";
import KpiCard from "./KpiCard";
import RecentOrdersList from "./RecentOrdersList";
import ShareStoreModal from "./ShareStoreModal";
import OnboardingChecklist from "./OnboardingChecklist";
import DashboardSkeleton from "./DashboardSkeleton";
import Toast from "@/components/ui/Toast";

const TIMEFRAME_DAYS = { Bugun: 1, Hafta: 7, Oy: 30 };

// Executive dashboard — ixcham, tez yuklanadigan ko'rinish.
//
// Rang kombinatsiyasi loyihaning boshqa barcha sahifalari (Mahsulotlar,
// Buyurtmalar, Sozlamalar) bilan bir xil — theme-aware (och/to'q rejimga
// moslashuvchan) — bu sahifalar orasida vizual izchillikni ta'minlaydi.
//
// Bu sahifada og'ir grafik (Canvas/Chart.js) ishlatilmaydi — bunday
// vizualizatsiya Moliya/P&L bo'limiga tegishli, bu yerda esa faqat eng
// muhim 4 ta KPI (ixcham kartochkalar) ko'rsatiladi.
//
// Konversiya ko'rsatkichi tashriflarni kuzatuvchi tizimga asoslanadi
// (`visits` kolleksiyasi, server tomonida — mijoz SDK'i uchun yopiq).
// "Bugun" uchun ma'lumot `verifyTelegramAuth` javobida allaqachon tayyor
// keladi; "Hafta"/"Oy" uchun esa `getVisitorCount` Cloud Function
// alohida so'raladi (davr o'zgarganda).
const Dashboard = () => {
  const navigate = useNavigate();
  const { sellerId, store, dashboardSummary, patchStore } = useSession();
  const { t } = useLanguage();
  const [timeframe, setTimeframe] = useState("Bugun");
  // "Oy" tabi bosilganda ochiladigan oy-tanlash paneli — 0 = joriy oy
  // (standart), sotuvchi tanlagan sari o'tgan oylarga o'tadi (2026-09
  // punkt-royxati, 1-band).
  const [selectedMonthsAgo, setSelectedMonthsAgo] = useState(0);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const handleTimeframeChange = useCallback((tf) => {
    setTimeframe(tf);
    if (tf === "Oy") setShowMonthPicker(true);
  }, []);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [visitorCount, setVisitorCount] = useState(null);

  const { orders = [], loading: ordersLoading } = useGetOrdersData(sellerId);
  const { products = [], loading: productsLoading } = useGetProductsData(sellerId);

  // KPI statistikasi (savdo/foyda) xom `useRecentOrders` ro'yxatidan
  // emas, server tomonida oldindan hisoblangan kunlik yig'ma
  // yozuvlardan (`useOrderRollups`) hisoblanadi — bu, buyurtmalar hajmi
  // o'sganda ham sahifa tezligini va Firestore xarajatini o'zgarishsiz
  // saqlaydi. `orders` (yuqorida) faqat "So'nggi buyurtmalar" ro'yxatini
  // ko'rsatish uchun ishlatiladi, statistika uchun emas. `sinceMs` mount
  // vaqtida bir marta hisoblanadi (60 kun — "Oy" tabining o'zi va uning
  // solishtirish davrini qamrab olish uchun yetarli), shu orqali tab
  // almashtirilganda qayta so'ralmaydi.
  //
  // `Date.now()` render vaqtida to'g'ridan-to'g'ri chaqirilmaydi (React
  // Compiler'ning "impure" qoidasiga zid bo'lardi) — buning o'rniga
  // "hozirgi vaqt" bir marta, komponent birinchi render qilinganda,
  // `useState`ning dangasa (lazy) boshlang'ich qiymati orqali olinadi.
  const [mountedAtMs] = useState(() => Date.now());
  // MUHIM TUZATISH: OLDIN 60 kun edi - bu, oy-tanlash paneli orqali
  // 2 oydan ko'proq orqaga (masalan 3-4 oy oldingi) tanlanganda,
  // kerakli kunlik yig'ma yozuvlar hali YUKLANMAGAN bo'lib qolishiga
  // olib kelardi. Endi 370 kun (~12 oy) - `MonthPickerSheet`ning
  // to'liq 12 oylik ro'yxatini qamrab oladi.
  const sinceMs = useMemo(() => mountedAtMs - 370 * 24 * 60 * 60 * 1000, [mountedAtMs]);
  const { days: rollupDays, loading: rollupsLoading } = useOrderRollups(sellerId, sinceMs);
  const { pendingCount } = usePendingOrdersCount(sellerId);

  const isClientDataLoading = ordersLoading || productsLoading || rollupsLoading;

  const canShowServerSummary = Boolean(dashboardSummary) && timeframe === "Bugun" && isClientDataLoading;
  const isLoading = isClientDataLoading && !canShowServerSummary;

  const stats = useMemo(() => {
    // "Oy" tanlanganda — HAQIQIY KALENDAR OYI chegaralari (tanlangan
    // oy, `MonthPickerSheet` orqali) ishlatiladi, "avvalgi davr"
    // sifatida esa undan OLDINGI kalendar oyi (aniq taqqoslash uchun -
    // masalan iyul tanlansa, iyun bilan solishtiriladi). "Bugun"/
    // "Hafta" uchun eski, oddiy trailing-window mantiq o'zgarishsiz
    // qoladi.
    if (timeframe === "Oy") {
      const { start: rangeStart, end: rangeEnd } = getCalendarMonthRange(selectedMonthsAgo);
      const { start: prevRangeStart } = getCalendarMonthRange(selectedMonthsAgo + 1);
      return { ...computeDashboardStatsFromRollups(rollupDays, products, rangeStart, prevRangeStart, rangeEnd), pendingCount };
    }
    const rangeStart = getRangeStart(timeframe);
    const rangeLength = mountedAtMs - rangeStart;
    const prevRangeStart = rangeStart - rangeLength;
    return { ...computeDashboardStatsFromRollups(rollupDays, products, rangeStart, prevRangeStart), pendingCount };
  }, [rollupDays, products, timeframe, selectedMonthsAgo, pendingCount, mountedAtMs]);

  // "Bugun" uchun tashriflar soni — auth javobida allaqachon bor.
  // "Hafta"/"Oy" uchun — alohida, server'dan so'raladi.
  useEffect(() => {
    if (timeframe === "Bugun") {
      setVisitorCount(dashboardSummary?.visitorCount ?? null);
      return;
    }
    if (!sellerId) return;

    let cancelled = false;
    setVisitorCount(null);
    getVisitorCount(sellerId, TIMEFRAME_DAYS[timeframe])
      .then((count) => { if (!cancelled) setVisitorCount(count); })
      .catch((err) => {
        console.error("Tashriflar sonini olishda xatolik:", err);
        if (!cancelled) setVisitorCount(null);
      });

    return () => { cancelled = true; };
  }, [timeframe, sellerId, dashboardSummary?.visitorCount]);

  // Bir martalik, ko'rinmas migratsiya: server-side rollup tizimi
  // (batafsil izoh: `functions/orderRollups.js`) qurilishidan oldin
  // yaratilgan sotuvchilar uchun, mavjud buyurtma tarixini orqaga
  // hisoblab to'ldiradi — shu orqali eski sotuvchilarning
  // Dashboard/P&L/CRM ma'lumotlari birdan yo'qolib qolmaydi. Faqat bir
  // marta (`store.rollupsBackfilledAt` hali yo'q bo'lsa) ishga tushadi —
  // sotuvchi buni ko'rmaydi, oddiy fon jarayoni. Xato bo'lsa ham jim
  // o'tkaziladi — Dashboard'ning qolgan qismi (rollup so'ralganda hali
  // bo'sh bo'lishi mumkin, lekin xato bermaydi) ishlayverishi kerak.
  useEffect(() => {
    // Faqat `rollupsBackfilledAt` bayrog'ining o'ziga bog'liq qilingan
    // (butun `store` ob'ektiga emas) — aks holda, do'kon boshqa sabab
    // bilan (masalan mahsulot soni yangilanganda) patch qilinganda ham
    // bu effekt qayta ishga tushib, keraksiz takroriy chaqiruvlarga olib
    // kelardi.
    if (!sellerId || !store || store.rollupsBackfilledAt) return;
    let cancelled = false;
    backfillSellerRollups(sellerId)
      .then(() => {
        if (!cancelled) patchStore({ rollupsBackfilledAt: Date.now() });
      })
      .catch((err) => {
        console.error("Rollup migratsiyasida xatolik:", err);
      });
    return () => { cancelled = true; };
  }, [sellerId, Boolean(store), store?.rollupsBackfilledAt, patchStore]);

  // Bir martalik, ko'rinmas migratsiya (yuqoridagi rollup migratsiyasi
  // bilan AYNAN BIR XIL naqsh): Z-Tariflar limit hisoblagichlarini
  // (`activeDiscountCount`/`couponCount`) shu funksiya qurilishidan
  // OLDIN yaratilgan aksiya/promokod yozuvlari uchun "orqaga hisoblab"
  // to'ldiradi - aks holda `firestore.rules`dagi limit tekshiruvi
  // ESKI (allaqachon mavjud) yozuvlarni hisobga olmagan bo'lardi.
  useEffect(() => {
    if (!sellerId || !store || store.tariffCountersBackfilledAt) return;
    let cancelled = false;
    backfillTariffCounters(sellerId)
      .then(() => {
        if (!cancelled) patchStore({ tariffCountersBackfilledAt: Date.now() });
      })
      .catch((err) => {
        console.error("Tarif hisoblagichlari migratsiyasida xatolik:", err);
      });
    return () => { cancelled = true; };
  }, [sellerId, Boolean(store), store?.tariffCountersBackfilledAt, patchStore]);

  const conversionRate = useMemo(() => {
    if (visitorCount === null || visitorCount === 0) return null;
    const ordersCount = canShowServerSummary ? dashboardSummary.ordersCount : stats.ordersCount;
    return Math.round((ordersCount / visitorCount) * 1000) / 10;
  }, [visitorCount, canShowServerSummary, dashboardSummary, stats]);

  const effectiveStats = canShowServerSummary
    ? {
        totalSales: dashboardSummary.totalSales,
        growthPercent: null,
        netProfit: dashboardSummary.netProfit,
        profitMargin: dashboardSummary.profitMargin,
        ordersCount: dashboardSummary.ordersCount,
        pendingCount: dashboardSummary.pendingCount,
        activeProductsCount: dashboardSummary.activeProductsCount,
        lowStockCount: dashboardSummary.lowStockCount,
        averageOrderValue: dashboardSummary.ordersCount > 0
          ? Math.round(dashboardSummary.totalSales / dashboardSummary.ordersCount)
          : 0,
      }
    : stats;
  const effectiveOrders = canShowServerSummary ? dashboardSummary.recentOrders : orders;

  const handleQuickShare = useCallback(async () => {
    const link = buildShopLink(sellerId);
    try {
      await navigator.clipboard.writeText(link);
      setToastMessage(t("sellerDashboard.linkCopied"));
    } catch {
      setShowShareModal(true);
    }
  }, [sellerId, t]);

  const hide = (value) => (isPrivate ? "•••" : value);

  return (
    <div className="h-screen flex flex-col bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased transition-colors duration-300">

      {/* Sticky yuqori qism — `backdrop-blur` olib tashlandi
          (qimmat GPU xarajati), oddiy, qattiq fon bilan almashtirildi. */}
      <div className="shrink-0 sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 shadow-xs">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base font-black text-slate-800 dark:text-white tracking-tight truncate">
              {store?.storeName || t("sellerDashboard.defaultTitle")}
            </span>
            <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[9px] font-black px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-500/20 shrink-0">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
              <span>LIVE</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* AI CEO uchun kichik, diqqatni tortuvchi (pulsatsiyalanuvchi
                nuqta bilan) ikonka ko'rsatiladi, Ko'z/Ulashish tugmalari
                bilan bir qatorda — katta, to'liq kenglikdagi karta
                ekranni ortiqcha egallamasligi uchun ataylab
                ishlatilmagan. */}
            {store?.aiCeoEnabled === true && (
              <button
                type="button"
                onClick={() => navigate("/seller/ai-ceo")}
                className="relative w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center active:scale-90 transition-transform"
                aria-label={t("aiCeo.dashboardCardTitle")}
              >
                <Bot size={14} />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsPrivate((v) => !v)}
              className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center active:scale-90 transition-transform"
              aria-label={isPrivate ? t("sellerDashboard.show") : t("sellerDashboard.hide")}
            >
              {isPrivate ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <button
              type="button"
              onClick={handleQuickShare}
              className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center active:scale-90 transition-transform"
              aria-label={t("sellerDashboard.shareAria")}
            >
              <Share2 size={14} />
            </button>
          </div>
        </div>

        <div className="px-5 pb-3">
          <TimeframeTabs timeframe={timeframe} onChange={handleTimeframeChange} />
          {timeframe === "Oy" && selectedMonthsAgo > 0 && (
            <button
              type="button"
              onClick={() => setShowMonthPicker(true)}
              className="mt-1.5 text-[10px] font-bold text-indigo-500 dark:text-indigo-400 underline underline-offset-2"
            >
              {t("common.monthNamesShort")[getCalendarMonthRange(selectedMonthsAgo).month]} {getCalendarMonthRange(selectedMonthsAgo).year}
            </button>
          )}
        </div>
      </div>

      {showMonthPicker && (
        <MonthPickerSheet
          selectedMonthsAgo={selectedMonthsAgo}
          onSelect={setSelectedMonthsAgo}
          onClose={() => setShowMonthPicker(false)}
        />
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <div className="p-4 space-y-4 pb-36 animate-fade-in">

            <OnboardingChecklist
              sellerId={sellerId}
              store={store}
              dashboardSummary={dashboardSummary}
              onOpenShareModal={() => setShowShareModal(true)}
            />

            {/* 2x2 KOMPAKT KPI KATAKLARI */}
            <div className="grid grid-cols-2 gap-2.5">
              <KpiCard
                icon={Wallet}
                iconColorClass="text-[#5346E0] dark:text-[#8b85f5]"
                label={t("sellerDashboard.totalSales")}
                value={hide(`${effectiveStats.totalSales.toLocaleString()} so'm`)}
                subtext={!isPrivate ? t("sellerDashboard.netProfitTemplate", { amount: effectiveStats.netProfit.toLocaleString(), margin: effectiveStats.profitMargin }) : null}
              />
              <KpiCard
                icon={Package}
                iconColorClass="text-blue-500 dark:text-blue-400"
                label={t("sellerDashboard.orders")}
                value={`${effectiveStats.ordersCount} ta`}
                subtext={effectiveStats.pendingCount > 0 ? t("sellerDashboard.pending", { count: effectiveStats.pendingCount }) : t("sellerDashboard.allReviewed")}
                subtextColorClass={effectiveStats.pendingCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}
              />
              <KpiCard
                icon={TrendingUp}
                iconColorClass="text-violet-500 dark:text-violet-400"
                label={t("sellerDashboard.conversion")}
                value={conversionRate !== null ? `${conversionRate}%` : (visitorCount === null ? "..." : "—")}
                subtext={visitorCount !== null ? t("sellerDashboard.visits", { count: visitorCount }) : t("sellerDashboard.calculating")}
              />
              <KpiCard
                icon={effectiveStats.lowStockCount > 0 ? ArchiveX : Package}
                iconColorClass={effectiveStats.lowStockCount > 0 ? "text-rose-500 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}
                label={t("sellerDashboard.stock")}
                value={t("sellerDashboard.active", { count: effectiveStats.activeProductsCount })}
                subtext={effectiveStats.lowStockCount > 0 ? t("sellerDashboard.lowStock", { count: effectiveStats.lowStockCount }) : t("sellerDashboard.safeLevel")}
                subtextColorClass={effectiveStats.lowStockCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}
              />
            </div>

            {/* TEZKOR AMALLAR */}
            <div className="flex gap-2 overflow-x-auto">
              {/* OLDIN: bu yerda "Yangi Tovar" (oddiy, qo'lda to'ldiriladigan
                  forma) tezkor amal sifatida birinchi o'rinda turardi.
                  Foydalanuvchi so'roviga ko'ra endi shu o'rinda AI yordamida
                  tezkor qo'shish (`QuickAddAICard.jsx`) urg'ulanadi - manzil
                  bir xil (`/seller/add-product`), chunki o'sha sahifaning
                  ENG YUQORISIDA aynan shu AI bloki joylashgan (AI CEO
                  yoqilgan sotuvchilar uchun); AI CEO yoqilmagan sotuvchi
                  uchun esa xuddi shu sahifadagi oddiy forma baribir
                  ishlayveradi - hech narsa yo'qolmaydi, faqat urg'u
                  o'zgardi. */}
              <Link
                to="/seller/add-product"
                className="shrink-0 bg-[#5346E0] text-white rounded-xl px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform"
              >
                <Sparkles size={14} />
                {t("sellerDashboard.addWithAi")}
              </Link>
              <Link
                to="/seller/orders"
                className="shrink-0 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform"
              >
                <Package size={14} />
                {t("sellerDashboard.ordersLink")}
              </Link>
              <Link
                to="/seller/create-promotion"
                className="shrink-0 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform"
              >
                <Flame size={14} />
                {t("sellerDashboard.createPromotion")}
              </Link>
              <Link
                to="/seller/marketing"
                className="shrink-0 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform"
              >
                <Megaphone size={14} />
                {t("sellerDashboard.createCoupon")}
              </Link>
            </div>

            <RecentOrdersList orders={effectiveOrders} />
          </div>
        )}
      </div>

      {showShareModal && (
        <ShareStoreModal sellerId={sellerId} storeName={store?.storeName} onClose={() => setShowShareModal(false)} />
      )}

      {toastMessage && (
        <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
      )}
    </div>
  );
};

export default Dashboard;
