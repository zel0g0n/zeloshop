import { useMemo, useState, useCallback, useRef, useEffect, memo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Download, Trophy, ShoppingBag, Percent, TrendingDown,
  Users, Clock, MapPin, XCircle, Sunrise, Sun, Sunset, Moon,
  UserX, Sparkles, Copy, Check, Loader2, Send,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useSession } from "@/context/SessionContext";
import { useAnalyticsOrders } from "@/hooks/seller/useAnalyticsOrders";
import {
  filterOrdersInRange, computeStatusBreakdown, computeOrderSummary,
  buildDailyRevenueSeries, getTopCustomers, getCancellationReasons,
  getDeliveryZoneBreakdown, getLapsedCustomers, getDayPartBreakdown,
} from "@/utils/orderAnalytics";
import { ORDER_STATUS_TABS } from "@/constants/orderStatus";
import { DELIVERY_TIER_KEYS } from "@/constants/deliveryTiers";
import { exportToCsv } from "@/utils/csvExport";
import { generateWinBackMessage } from "@/services/ai/aiCeoInsights";
import { sendCrmNotification } from "@/services/crm/sendNotification";
import { useLanguage } from "@/context/LanguageContext";

const DAY_MS = 24 * 60 * 60 * 1000;
const money = (n) => `${Math.round(n).toLocaleString()} so'm`;

// ProductAnalytics.jsx/ProfitDeepDive.jsx bilan BIR XIL davr tanlash
// naqshi - loyihada bu uchinchi joyda ham qo'lda takrorlanadi (har
// bir "deep dive" sahifa buni o'zining ichida saqlaydi, ULASHILGAN
// emas - mavjud kod bazasidagi o'rnatilgan pretsedent).
const TIME_FILTER_DAYS = [
  { key: "week", labelKey: "filterWeek", days: 7 },
  { key: "month", labelKey: "filterMonth", days: 30 },
  { key: "quarter", labelKey: "filterQuarter", days: 90 },
  { key: "year", labelKey: "filterYear", days: 365 },
];

const DAY_PART_ICONS = { morning: Sunrise, afternoon: Sun, evening: Sunset, night: Moon };
const STATUS_BAR_COLORS = {
  pending: "#f59e0b", new: "#a855f7", processing: "#3b82f6",
  shipped: "#f97316", delivered: "#10b981", cancel: "#f43f5e",
};

const CustomerThumb = memo(({ name }) => (
  <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-500/15 shrink-0 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-black">
    {(name || "?").charAt(0).toUpperCase()}
  </div>
));
CustomerThumb.displayName = "CustomerThumb";

// Reyting qatorlari alohida, memo qilingan komponentga ajratilgan -
// ProductAnalytics.jsx'dagi RankRow bilan bir xil sabab: davr
// filtri o'zgarganda faqat RO'YXAT qayta chizilsin, butun sahifa emas.
const CustomerRow = memo(({ rank, customer, maxSpent, t }) => {
  const widthPct = maxSpent > 0 ? Math.max(6, (customer.totalSpent / maxSpent) * 100) : 0;
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-4 text-[11px] font-black text-slate-300 dark:text-slate-600 text-center shrink-0">{rank}</span>
      <CustomerThumb name={customer.fullName} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{customer.fullName || t("orderAnalytics.unknownCustomer")}</p>
        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-1 overflow-hidden">
          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${widthPct}%` }} />
        </div>
      </div>
      <div className="text-right shrink-0">
        <span className="block text-xs font-black text-slate-700 dark:text-slate-200">{money(customer.totalSpent)}</span>
        <span className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500">{customer.ordersCount} {t("orderAnalytics.ordersSuffix")}</span>
      </div>
    </div>
  );
});
CustomerRow.displayName = "CustomerRow";

// AI CEO 4-BOSQICH: har bir "uxlab qolgan" mijoz qatori - MUSTAQIL
// holatga ega (o'zining AI xabar qoralamasi) - bittasi uchun xabar
// yaratish boshqalarni qayta chizishga sabab bo'lmaydi.
const LapsedCustomerRow = memo(({ customer, storeName, sellerId, aiEnabled, t }) => {
  const [message, setMessage] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // MUHIM TUZATISH: agar foydalanuvchi so'rov davom etayotganda
  // sahifadan chiqib ketsa (yoki ro'yxat qayta hisoblanib, bu qator
  // ekrandan yo'qolsa), komponent YO'Q QILINGANDAN keyin holatni
  // yangilashning oldini oladi - `useSocialPost.jsx`/`useAIDescription.jsx`
  // bilan BIR XIL, allaqachon o'rnatilgan naqsh (avval bu yerda
  // yo'q edi - o'z-o'zini tekshiruv orqali topilgan nomuvofiqlik).
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await generateWinBackMessage({
        customerName: customer.fullName,
        daysSinceLastOrder: customer.daysSinceLastOrder,
        lastProductName: customer.lastProductName,
        storeName,
      });
      if (isMountedRef.current) setMessage(result);
    } catch (err) {
      if (isMountedRef.current) setError(err.message || t("aiCeo.winBackError"));
    } finally {
      if (isMountedRef.current) setGenerating(false);
    }
  }, [customer, storeName, t]);

  const handleSend = useCallback(async () => {
    if (!message) return;
    setSending(true);
    setError(null);
    try {
      await sendCrmNotification({
        sellerId,
        targetClientIds: [customer.clientId],
        title: t("aiCeo.winBackNotificationTitle"),
        message,
      });
      if (isMountedRef.current) setSent(true);
    } catch (err) {
      if (isMountedRef.current) setError(err.message || t("aiCeo.winBackSendError"));
    } finally {
      if (isMountedRef.current) setSending(false);
    }
  }, [message, sellerId, customer.clientId, t]);

  const handleCopy = useCallback(async () => {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API mavjud bo'lmasa - jim qolamiz.
    }
  }, [message]);

  return (
    <div className="bg-amber-50/60 dark:bg-amber-500/10 rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2.5">
        <CustomerThumb name={customer.fullName} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{customer.fullName || t("orderAnalytics.unknownCustomer")}</p>
          <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
            {t("aiCeo.daysSinceOrder", { days: customer.daysSinceLastOrder })}
          </p>
        </div>
        {aiEnabled && !message && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="shrink-0 h-8 px-2.5 rounded-lg bg-indigo-600 text-white text-[10px] font-bold flex items-center gap-1 disabled:opacity-60"
          >
            {generating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            {t("aiCeo.draftMessageButton")}
          </button>
        )}
      </div>
      {message && (
        <div className="bg-white dark:bg-slate-900 rounded-lg p-2.5 space-y-1.5">
          {sent ? (
            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Check size={12} /> {t("aiCeo.winBackSent")}
            </p>
          ) : (
            <>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="w-full bg-transparent text-[11px] text-slate-700 dark:text-slate-200 leading-relaxed focus:outline-none resize-none"
              />
              <div className="flex items-center gap-3 pt-0.5">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1"
                >
                  {copied ? <Check size={10} /> : <Copy size={10} />}
                  {copied ? t("referral.copied") : t("referral.copy")}
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 disabled:opacity-60"
                >
                  {sending ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                  {sending ? t("aiCeo.winBackSending") : t("aiCeo.winBackSendButton")}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {error && <p className="text-[10px] text-rose-500 font-semibold">{error}</p>}
    </div>
  );
});
LapsedCustomerRow.displayName = "LapsedCustomerRow";

// PRODUCTION-LEVEL BUYURTMALAR ANALITIKASI — ProductAnalytics.jsx/
// P&L Dashboard bilan BIR XIL vizual til va arxitektura darajasida.
//
// MUHIM TUZATISH (haqiqiy production xatosi, o'z-o'zini tekshiruv
// orqali topilgan): OLDIN bu yerda `useFilterOrders` (Buyurtmalar
// BOSHQARUV sahifasi ishlatadigan, 150 ta bilan CHEGARALANGAN hook)
// ishlatilardi - 150+ buyurtmasi bor do'kon uchun, uzoq davr
// (masalan "Yil") tanlansa, daromad/statistika HAQIQIYSIDAN KAMROQ
// ko'rsatilardi, "uxlab qolgan mijozlar" esa ba'zilarini butunlay
// ko'rmasligi mumkin edi. Endi `useAnalyticsOrders` - alohida,
// SAHIFALASHSIZ (faqat xavfsizlik uchun yuqori chegara bilan
// cheklangan) server so'rovi - ishlatiladi. Bu, oddiy Buyurtmalar
// sahifasiga qaraganda KO'PROQ Firestore xarajatiga olib keladi -
// lekin bu, noto'g'ri biznes ma'lumotidan ko'ra arzonroq almashinuv.
const OrderAnalytics = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId, store } = useSession();
  const TIME_FILTERS = useMemo(() => TIME_FILTER_DAYS.map((f) => ({ ...f, label: t(`productAnalytics.${f.labelKey}`) })), [t]);

  const { orders = [], loading } = useAnalyticsOrders(sellerId);

  const [activeFilter, setActiveFilter] = useState("month");
  const activeDays = TIME_FILTER_DAYS.find((f) => f.key === activeFilter)?.days || 30;
  const now = Date.now();
  const rangeStart = now - activeDays * DAY_MS;

  const periodOrders = useMemo(() => filterOrdersInRange(orders, rangeStart, now), [orders, rangeStart, now]);
  const summary = useMemo(() => computeOrderSummary(periodOrders), [periodOrders]);
  const statusBreakdown = useMemo(() => computeStatusBreakdown(periodOrders, ORDER_STATUS_TABS), [periodOrders]);
  const dailySeries = useMemo(() => buildDailyRevenueSeries(periodOrders, rangeStart, now), [periodOrders, rangeStart, now]);
  const topCustomers = useMemo(() => getTopCustomers(periodOrders, 5), [periodOrders]);
  const cancellationReasons = useMemo(() => getCancellationReasons(periodOrders), [periodOrders]);
  const zoneBreakdown = useMemo(() => getDeliveryZoneBreakdown(periodOrders), [periodOrders]);
  const dayPartBreakdown = useMemo(() => getDayPartBreakdown(periodOrders), [periodOrders]);
  // MUHIM: "uxlab qolgan mijozlar" ATAYLAB `periodOrders`dan emas,
  // `orders` (BUTUN tarix)dan hisoblanadi - yuqoridagi davr filtridan
  // mustaqil (`getLapsedCustomers`ning o'z izohiga qarang).
  const lapsedCustomers = useMemo(() => getLapsedCustomers(orders, 30, now), [orders, now]);

  const maxCustomerSpent = topCustomers[0]?.totalSpent || 0;
  const maxDayPartCount = Math.max(1, ...dayPartBreakdown.map((p) => p.count));

  const chartData = useMemo(
    () => dailySeries.map((d) => ({ ...d, label: new Date(d.date).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" }) })),
    [dailySeries]
  );

  const zoneLabel = useCallback(
    (tier) => (DELIVERY_TIER_KEYS.includes(tier) ? t(`logistics.tier_${tier}_label`) : tier),
    [t]
  );

  const handleExport = useCallback(() => {
    const rows = [
      [t("orderAnalytics.csvTitle"), `${t("productAnalytics.csvPeriod")} ${TIME_FILTERS.find((f) => f.key === activeFilter)?.label || ""}`, new Date().toLocaleDateString("uz-UZ")],
      [],
      [t("orderAnalytics.csvStatus"), t("orderAnalytics.csvCount"), t("orderAnalytics.csvPercent")],
      ...statusBreakdown.map((s) => [t(`orderStatus.${s.status}`), s.count, `${s.percent.toFixed(1)}%`]),
      [],
      [t("orderAnalytics.csvSummaryTitle")],
      [t("orderAnalytics.totalOrdersLabel"), summary.totalOrders],
      [t("orderAnalytics.deliveredRevenueLabel"), Math.round(summary.deliveredRevenue)],
      [t("orderAnalytics.aovLabel"), Math.round(summary.aov)],
      [t("orderAnalytics.cancelRateLabel"), `${summary.cancelRate.toFixed(1)}%`],
    ];
    exportToCsv(`buyurtmalar-analitikasi-${activeFilter}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }, [statusBreakdown, summary, activeFilter, TIME_FILTERS, t]);

  const isLoading = loading;

  return (
    <div className="h-screen overflow-y-auto bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased transition-colors duration-300">

      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-transform shrink-0"
          >
            <ArrowLeft size={17} />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-black text-slate-800 dark:text-white truncate">{t("orderAnalytics.pageTitle")}</h1>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">{t("orderAnalytics.subtitle")}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={periodOrders.length === 0}
          className="shrink-0 w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40"
          aria-label={t("productAnalytics.exportAria")}
        >
          <Download size={16} />
        </button>
      </div>

      <div className="p-4 space-y-4 pb-36">

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {TIME_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                activeFilter === f.key
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">{t("productAnalytics.loading")}</div>
        ) : periodOrders.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-center px-6">
            <ShoppingBag size={28} className="text-slate-300 dark:text-slate-600" />
            <p className="text-xs text-slate-400 dark:text-slate-500">{t("orderAnalytics.noOrdersInPeriod")}</p>
          </div>
        ) : (
          <>
            {/* HERO — davrning yetkazilgan daromadi */}
            <div className="rounded-[28px] p-5 text-white shadow-lg shadow-indigo-600/20 relative overflow-hidden bg-gradient-to-br from-indigo-600 to-indigo-700">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-white/80 uppercase tracking-wider">
                <Trophy size={12} /> {t("orderAnalytics.heroLabel")}
              </span>
              <p className="text-2xl font-black tracking-tight mt-2">{money(summary.deliveredRevenue)}</p>
              <p className="text-[11px] font-semibold text-white/70 mt-0.5">
                {summary.deliveredCount} {t("orderAnalytics.deliveredOrdersSuffix")}
              </p>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-white/15 rounded-2xl p-3">
                  <span className="text-[10px] font-bold uppercase text-white/80">{t("orderAnalytics.aovLabel")}</span>
                  <p className="text-base font-black mt-1">{money(summary.aov)}</p>
                </div>
                <div className="bg-white/15 rounded-2xl p-3">
                  <span className="text-[10px] font-bold uppercase text-white/80">{t("orderAnalytics.totalOrdersLabel")}</span>
                  <p className="text-base font-black mt-1">{summary.totalOrders}</p>
                </div>
              </div>
            </div>

            {/* QISQA XULOSA — 3 ta ko'rsatkich */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-xl">
                <ShoppingBag size={14} className="text-indigo-500 mb-1.5" />
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("orderAnalytics.totalOrdersLabel")}</p>
                <p className="text-sm font-black text-slate-800 dark:text-white mt-0.5">{summary.totalOrders}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-xl">
                <Percent size={14} className="text-emerald-500 mb-1.5" />
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("orderAnalytics.aovLabel")}</p>
                <p className="text-sm font-black text-slate-800 dark:text-white mt-0.5">{money(summary.aov)}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-xl">
                <TrendingDown size={14} className={summary.cancelRate > 15 ? "text-rose-500 mb-1.5" : "text-amber-500 mb-1.5"} />
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("orderAnalytics.cancelRateLabel")}</p>
                <p className="text-sm font-black text-slate-800 dark:text-white mt-0.5">{summary.cancelRate.toFixed(1)}%</p>
              </div>
            </div>

            {/* DAROMAD DINAMIKASI (grafik) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
              <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("orderAnalytics.revenueTrendTitle")}</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="orderRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-100 dark:text-slate-800" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    className="text-slate-400 dark:text-slate-500"
                    axisLine={false}
                    tickLine={false}
                    interval={Math.max(0, Math.ceil(chartData.length / 7) - 1)}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    className="text-slate-400 dark:text-slate-500"
                    axisLine={false}
                    tickLine={false}
                    width={56}
                    tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}mln` : `${Math.round(v / 1000)}k`)}
                  />
                  <Tooltip
                    formatter={(value) => [money(value), t("orderAnalytics.deliveredRevenueLabel")]}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12, fontWeight: 600 }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#orderRevenueGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* HOLAT BO'YICHA TAQSIMOT */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2.5">
              <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("orderAnalytics.statusBreakdownTitle")}</h3>
              {statusBreakdown.map((s) => (
                <div key={s.status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t(`orderStatus.${s.status}`)}</span>
                    <span className="text-xs font-black text-slate-800 dark:text-white">{s.count} <span className="text-slate-400 dark:text-slate-500 font-semibold">({s.percent.toFixed(0)}%)</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${s.percent}%`, backgroundColor: STATUS_BAR_COLORS[s.status] }} />
                  </div>
                </div>
              ))}
            </div>

            {/* ENG KO'P XARID QILGAN MIJOZLAR */}
            {topCustomers.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
                <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Users size={13} /> {t("orderAnalytics.topCustomersTitle")}
                </h3>
                <div className="space-y-3">
                  {topCustomers.map((c, i) => (
                    <CustomerRow key={c.clientId} rank={i + 1} customer={c} maxSpent={maxCustomerSpent} t={t} />
                  ))}
                </div>
              </div>
            )}

            {/* KUNNING QAYSI QISMIDA KO'P BUYURTMA TUSHADI */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
              <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={13} /> {t("orderAnalytics.dayPartTitle")}
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {dayPartBreakdown.map((p) => {
                  const Icon = DAY_PART_ICONS[p.key];
                  const isPeak = p.count === maxDayPartCount && p.count > 0;
                  return (
                    <div
                      key={p.key}
                      className={`rounded-xl p-2.5 text-center ${isPeak ? "bg-indigo-50 dark:bg-indigo-500/10 ring-1 ring-indigo-200 dark:ring-indigo-500/30" : "bg-slate-50 dark:bg-slate-800/60"}`}
                    >
                      <Icon size={15} className={`mx-auto mb-1 ${isPeak ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}`} />
                      <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">{t(`orderAnalytics.dayPart.${p.key}`)}</p>
                      <p className={`text-sm font-black mt-0.5 ${isPeak ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-slate-200"}`}>{p.count}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* HUDUDLAR BO'YICHA TAQSIMOT */}
            {zoneBreakdown.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2.5">
                <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin size={13} /> {t("orderAnalytics.zoneBreakdownTitle")}
                </h3>
                {zoneBreakdown.map((z) => (
                  <div key={z.tier}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">{zoneLabel(z.tier)}</span>
                      <span className="text-xs font-black text-slate-800 dark:text-white shrink-0 ml-2">{z.count} <span className="text-slate-400 dark:text-slate-500 font-semibold">({z.percent.toFixed(0)}%)</span></span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${z.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* BEKOR QILISH SABABLARI */}
            {cancellationReasons.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
                <div className="flex items-center gap-1.5 text-rose-500">
                  <XCircle size={13} />
                  <h3 className="text-xs font-black uppercase tracking-wider">{t("orderAnalytics.cancellationReasonsTitle")}</h3>
                </div>
                <div className="space-y-1.5 pt-1">
                  {cancellationReasons.slice(0, 6).map((r) => (
                    <div key={r.reason} className="flex items-center justify-between bg-rose-50/60 dark:bg-rose-500/10 rounded-xl px-3 py-2">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{r.reason}</span>
                      <span className="text-xs font-black text-rose-500 shrink-0 ml-2">{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* UXLAB QOLGAN MIJOZLAR (30+ kun buyurtma bermagan) */}
            {lapsedCustomers.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2.5">
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <UserX size={13} />
                  <h3 className="text-xs font-black uppercase tracking-wider">{t("aiCeo.lapsedCustomersTitle")}</h3>
                </div>
                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{t("aiCeo.lapsedCustomersSubtitle")}</p>
                <div className="space-y-2 pt-1">
                  {lapsedCustomers.slice(0, 8).map((c) => (
                    <LapsedCustomerRow
                      key={c.clientId}
                      customer={c}
                      storeName={store?.storeName}
                      sellerId={sellerId}
                      aiEnabled={store?.aiCeoEnabled === true}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OrderAnalytics;
