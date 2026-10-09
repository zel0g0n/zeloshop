import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Eye, EyeOff, Share2, Sparkles, Package, Megaphone, Flame, Bot, Wallet, TrendingUp, TrendingDown,
  PiggyBank, ClipboardList, MousePointerClick, ArchiveX, ArrowUpRight, Minus,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { getOrderStatusInfo, ORDER_STATUS_TABS } from "@/constants/orderStatus";
import { getCalendarMonthRange } from "@/utils/dateRange";
import {
  getChartRange, buildDailySeries, countOrdersByStatus, topProductsBySold, lowStockProducts,
  formatMoney, STATUS_COLORS,
} from "@/utils/dashboardCharts";
import SalesAreaChart from "./SalesAreaChart";
import StatusDonut from "./StatusDonut";
import Sparkline from "./Sparkline";
import OnboardingChecklist from "../OnboardingChecklist";

const TIMEFRAMES = [
  { id: "Bugun", key: "timeframe.today" },
  { id: "Hafta", key: "timeframe.week" },
  { id: "Oy", key: "timeframe.month" },
];

const card = "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl";

const formatTime = (ms) => (ms ? new Date(ms).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" }) : "");

const Delta = ({ percent, noGrowthLabel }) => {
  if (percent == null) {
    return <span title={noGrowthLabel} className="inline-flex items-center text-slate-300 dark:text-slate-600"><Minus size={14} /></span>;
  }
  const up = percent >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full ${up ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"}`}>
      <Icon size={12} />{up ? "+" : ""}{percent}%
    </span>
  );
};

const Kpi = ({ icon: Icon, tint, label, value, unit, sub, subClass, sub2, trend, spark, sparkColor, sparkLabel }) => (
  <div className={`${card} p-5 flex flex-col shadow-xs`}>
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${tint}`}><Icon size={17} /></span>
        {label}
      </span>
      {trend}
    </div>
    <p className="mt-4 flex items-baseline gap-1.5">
      <span className="text-[28px] leading-none font-black tracking-tight text-slate-900 dark:text-white tabular-nums">{value}</span>
      {unit && <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{unit}</span>}
    </p>
    <p className={`mt-2 text-xs font-semibold truncate ${subClass || "text-slate-400 dark:text-slate-500"}`}>{sub}</p>
    {sub2 && <p className="mt-1 text-xs font-semibold truncate text-slate-400 dark:text-slate-500">{sub2}</p>}
    <div className="mt-auto pt-4">
      {spark ? <Sparkline values={spark} color={sparkColor} label={sparkLabel} /> : <div className="h-9" />}
    </div>
  </div>
);

const SectionHead = ({ title, sub, action }) => (
  <div className="flex items-start justify-between gap-3 mb-4">
    <div>
      <h3 className="text-sm font-black text-slate-800 dark:text-white">{title}</h3>
      {sub && <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
    {action}
  </div>
);

/**
 * Kompyuter (lg+) uchun Dashboard: KPI + sparkline, savdo/foyda grafigi,
 * buyurtmalar holati donut'i, so'nggi buyurtmalar jadvali, top mahsulotlar
 * va zaxirasi kam mahsulotlar. Ma'lumot `Dashboard.jsx`dan tayyor keladi.
 */
const DesktopDashboard = ({
  sellerId, store, dashboardSummary, isStart, timeframe, onTimeframeChange, selectedMonthsAgo, onOpenMonthPicker,
  isPrivate, onTogglePrivate, onShare, onOpenShareModal, stats, conversionRate, visitorCount,
  orders, products, rollupDays, nowMs, onOpenAiCeo,
}) => {
  const { t } = useLanguage();
  const hide = (v) => (isPrivate ? "•••" : v);

  const range = useMemo(
    () => getChartRange(timeframe, nowMs, selectedMonthsAgo > 0 ? getCalendarMonthRange(selectedMonthsAgo) : null, selectedMonthsAgo),
    [timeframe, nowMs, selectedMonthsAgo]
  );
  const series = useMemo(() => buildDailySeries(rollupDays, range.startMs, range.endMs), [rollupDays, range]);
  const revenueSeries = useMemo(() => series.map((d) => d.revenue), [series]);
  const profitSeries = useMemo(() => series.map((d) => d.profit), [series]);
  const orderSeries = useMemo(() => series.map((d) => d.orders), [series]);
  const newCustomerSeries = useMemo(() => series.map((d) => d.newCustomers), [series]);
  const newCustomersTotal = newCustomerSeries.reduce((a, b) => a + b, 0);

  const periodOrders = useMemo(
    () => (orders || []).filter((o) => Number(o.createdAt) >= range.startMs && Number(o.createdAt) < range.endMs),
    [orders, range]
  );
  const statusCounts = useMemo(() => countOrdersByStatus(periodOrders, ORDER_STATUS_TABS), [periodOrders]);
  const donutSegments = statusCounts.map((s) => ({ key: s.status, count: s.count, color: STATUS_COLORS[s.status] }));
  const top = useMemo(() => topProductsBySold(products, 5), [products]);
  const low = useMemo(() => lowStockProducts(products, 5), [products]);
  const maxSold = top[0]?.soldNum || 1;

  const rangeLabel =
    timeframe === "Oy"
      ? `${t("common.monthNamesShort")[getCalendarMonthRange(selectedMonthsAgo).month]} ${getCalendarMonthRange(selectedMonthsAgo).year}`
      : t("desktop.last7");
  const totalPeriod = series.reduce((s, d) => s + d.revenue, 0);
  const profitPeriod = series.reduce((s, d) => s + d.profit, 0);
  const recent = (orders || []).slice(0, 8);
  const storeName = store?.storeName || t("sellerDashboard.defaultTitle");
  const todayParts = new Date(nowMs + 5 * 3600000);
  const todayLabel = `${todayParts.getUTCDate()} ${t("common.monthNamesShort")[todayParts.getUTCMonth()]} ${todayParts.getUTCFullYear()}`;

  return (
    <div className="space-y-6 animate-fade-in pb-6">
      {/* Sarlavha qatori */}
      <div className="flex items-end justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white truncate">
              {t("desktop.welcome")}
            </h2>
            <span className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-500/20 shrink-0">
              <span className="relative flex w-1.5 h-1.5"><span className="absolute inline-flex w-full h-full rounded-full bg-emerald-500 opacity-60 animate-ping" /><span className="relative w-1.5 h-1.5 rounded-full bg-emerald-500" /></span>
              LIVE
            </span>
          </div>
          <p className="text-sm font-medium text-slate-400 dark:text-slate-500 mt-1">
            {storeName} · {todayLabel}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center p-1 rounded-xl bg-slate-200/60 dark:bg-slate-800" role="tablist">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.id}
                type="button"
                role="tab"
                aria-selected={timeframe === tf.id}
                onClick={() => onTimeframeChange(tf.id)}
                className={`h-9 px-4 rounded-lg text-xs font-black transition-colors ${
                  timeframe === tf.id ? "bg-white dark:bg-slate-900 text-[#5346E0] dark:text-[#8b85f5] shadow-xs" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {t(tf.key)}
              </button>
            ))}
          </div>
          {timeframe === "Oy" && (
            <button type="button" onClick={onOpenMonthPicker} className="h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800">
              {rangeLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onTogglePrivate}
            aria-label={isPrivate ? t("sellerDashboard.show") : t("sellerDashboard.hide")}
            title={isPrivate ? t("sellerDashboard.show") : t("desktop.hideAmounts")}
            className="w-11 h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center hover:bg-white dark:hover:bg-slate-800 transition-colors"
          >
            {isPrivate ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button
            type="button"
            onClick={onShare}
            className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2 hover:bg-white dark:hover:bg-slate-800 transition-colors"
          >
            <Share2 size={15} />{t("desktop.shareLink")}
          </button>
          {store?.aiCeoEnabled === true && (
            <button type="button" onClick={onOpenAiCeo} aria-label={t("aiCeo.dashboardCardTitle")} className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center hover:bg-emerald-100 transition-colors">
              <Bot size={18} />
            </button>
          )}
          {!isStart && (
            <Link to="/seller/add-product" className="h-11 px-5 rounded-xl bg-[#5346E0] hover:bg-[#4338CA] text-white text-xs font-black flex items-center gap-2 shadow-[0_8px_20px_rgba(83,70,224,0.25)] transition-colors">
              <Sparkles size={15} />{t("sellerDashboard.addWithAi")}
            </Link>
          )}
        </div>
      </div>

      <OnboardingChecklist sellerId={sellerId} store={store} dashboardSummary={dashboardSummary} onOpenShareModal={onOpenShareModal} />

      {/* KPI */}
      <div className="grid grid-cols-4 gap-5">
        <Kpi
          icon={Wallet}
          tint="bg-[#5346E0]/10 text-[#5346E0] dark:text-[#8b85f5]"
          label={t("sellerDashboard.totalSales")}
          value={hide(formatMoney(stats.totalSales))}
          unit={!isPrivate ? "so'm" : null}
          sub={t("desktop.avgOrder", { amount: hide(formatMoney(stats.averageOrderValue)) })}
          trend={<Delta percent={stats.growthPercent} noGrowthLabel={t("desktop.noGrowth")} />}
          spark={revenueSeries}
          sparkColor="#5346E0"
          sparkLabel={t("desktop.revenue")}
        />
        <Kpi
          icon={PiggyBank}
          tint="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          label={t("desktop.netProfit")}
          value={hide(formatMoney(stats.netProfit))}
          unit={!isPrivate ? "so'm" : null}
          sub={t("desktop.margin", { percent: stats.profitMargin })}
          subClass="text-emerald-600 dark:text-emerald-400"
          spark={profitSeries}
          sparkColor="#10b981"
          sparkLabel={t("desktop.profit")}
        />
        <Kpi
          icon={ClipboardList}
          tint="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          label={t("sellerDashboard.orders")}
          value={stats.ordersCount}
          unit={t("desktop.ordersUnit")}
          sub={stats.pendingCount > 0 ? t("sellerDashboard.pending", { count: stats.pendingCount }) : t("sellerDashboard.allReviewed")}
          subClass={stats.pendingCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}
          spark={orderSeries}
          sparkColor="#3b82f6"
          sparkLabel={t("sellerDashboard.orders")}
        />
        <Kpi
          icon={MousePointerClick}
          tint="bg-violet-500/10 text-violet-600 dark:text-violet-400"
          label={t("sellerDashboard.conversion")}
          value={conversionRate !== null ? `${conversionRate}%` : visitorCount === null ? "..." : "—"}
          sub={visitorCount !== null ? t("sellerDashboard.visits", { count: visitorCount }) : t("sellerDashboard.calculating")}
          sub2={t("desktop.newCustomers", { count: newCustomersTotal })}
          spark={newCustomerSeries}
          sparkColor="#8b5cf6"
          sparkLabel={t("desktop.newCustomers", { count: newCustomersTotal })}
        />
      </div>

      {/* Grafik + donut */}
      <div className="grid grid-cols-12 gap-5">
        <section className={`${card} col-span-8 p-6 shadow-xs flex flex-col`}>
          <SectionHead
            title={t("desktop.salesTrend")}
            sub={rangeLabel}
            action={
              <div className="flex items-center gap-5 text-xs font-bold">
                <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400"><i className="w-2.5 h-2.5 rounded-full bg-[#5346E0]" />{t("desktop.revenue")}
                  <b className="text-slate-900 dark:text-white tabular-nums">{hide(formatMoney(totalPeriod))}</b></span>
                <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400"><i className="w-2.5 h-2.5 rounded-full bg-emerald-500" />{t("desktop.profit")}
                  <b className="text-slate-900 dark:text-white tabular-nums">{hide(formatMoney(profitPeriod))}</b></span>
              </div>
            }
          />
          <div className="flex-1 min-h-[280px]">
            <SalesAreaChart series={series} hidden={isPrivate} labels={{ revenue: t("desktop.revenue"), profit: t("desktop.profit"), orders: t("sellerDashboard.orders") }} />
          </div>
        </section>

        <section className={`${card} col-span-4 p-6 shadow-xs`}>
          <SectionHead title={t("desktop.ordersByStatus")} sub={rangeLabel} />
          <div className="flex flex-col items-center gap-5">
            <StatusDonut segments={donutSegments} total={periodOrders.length} centerLabel={t("desktop.centerOrders")} />
            <ul className="w-full space-y-2.5">
              {statusCounts.map((s) => (
                <li key={s.status} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2.5 font-semibold text-slate-600 dark:text-slate-300">
                    <i className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[s.status] }} />
                    {t(`orderStatus.${getOrderStatusInfo(s.status).key}`)}
                  </span>
                  <span className="font-black text-slate-800 dark:text-white tabular-nums">{s.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      {/* Jadval + ro'yxatlar */}
      <div className="grid grid-cols-12 gap-5">
        <section className={`${card} col-span-7 shadow-xs overflow-hidden`}>
          <div className="px-6 pt-6">
            <SectionHead
              title={t("sellerDashboard.recentOrders")}
              action={<Link to="/seller/orders" className="text-xs font-black text-[#5346E0] dark:text-[#8b85f5] flex items-center gap-1 hover:underline">{t("sellerDashboard.viewAll").replace(">", "").trim()}<ArrowUpRight size={13} /></Link>}
            />
          </div>
          {recent.length === 0 ? (
            <p className="px-6 pb-10 pt-4 text-sm text-center text-slate-400">{t("sellerDashboard.noOrders")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 border-y border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
                  <th className="text-left font-bold px-6 py-2.5">{t("desktop.colOrder")}</th>
                  <th className="text-left font-bold px-3 py-2.5">{t("desktop.colCustomer")}</th>
                  <th className="text-right font-bold px-3 py-2.5">{t("desktop.colAmount")}</th>
                  <th className="text-left font-bold px-3 py-2.5">{t("desktop.colStatus")}</th>
                  <th className="text-right font-bold px-6 py-2.5">{t("desktop.colTime")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {recent.map((o, i) => {
                  const info = getOrderStatusInfo(o.status);
                  return (
                    <tr key={o.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-3.5 font-black text-slate-800 dark:text-white tabular-nums">#{o.orderNumber ?? (orders.length - i)}</td>
                      <td className="px-3 py-3.5 font-medium text-slate-600 dark:text-slate-300 max-w-[180px] truncate">{o.customer?.fullName || t("sellerDashboard.unknownCustomer")}</td>
                      <td className="px-3 py-3.5 text-right font-black text-slate-800 dark:text-white tabular-nums whitespace-nowrap">{hide(formatMoney(o.totalAmount))} <span className="text-[10px] font-bold text-slate-400">so'm</span></td>
                      <td className="px-3 py-3.5"><span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md inline-block ${info.color}`}>{t(`orderStatus.${info.key}`)}</span></td>
                      <td className="px-6 py-3.5 text-right text-xs font-semibold text-slate-400 tabular-nums">{formatTime(o.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <div className="col-span-5 space-y-5">
          <section className={`${card} p-6 shadow-xs`}>
            <SectionHead title={t("desktop.topProducts")} action={<Flame size={16} className="text-orange-500" />} />
            {top.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">{t("desktop.noSalesYet")}</p>
            ) : (
              <ol className="space-y-3.5">
                {top.map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    {p.images?.[0] || p.image ? (
                      <img src={p.images?.[0] || p.image} alt="" className="w-10 h-10 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 shrink-0" />
                    ) : (
                      <span className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center shrink-0"><Package size={16} /></span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="flex items-center justify-between gap-3 text-xs font-bold text-slate-700 dark:text-slate-200">
                        <span className="truncate">{p.name || p.title}</span>
                        <span className="tabular-nums text-slate-500 dark:text-slate-400 shrink-0">{p.soldNum} {t("sellerProducts.soldSuffix")}</span>
                      </p>
                      <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#5346E0] to-indigo-400" style={{ width: `${Math.max((p.soldNum / maxSold) * 100, 6)}%` }} />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className={`${card} p-6 shadow-xs`}>
            <SectionHead title={t("desktop.lowStockTitle")} action={low.length > 0 ? <ArchiveX size={16} className="text-rose-500" /> : null} />
            {low.length === 0 ? (
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 py-2">{t("sellerDashboard.safeLevel")}</p>
            ) : (
              <ul className="divide-y divide-slate-50 dark:divide-slate-800">
                {low.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2.5 text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-200 truncate pr-3">{p.name || p.title}</span>
                    <span className={`shrink-0 px-2.5 py-1 rounded-md font-black tabular-nums ${Number(p.stock) <= 0 ? "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"}`}>
                      {Number(p.stock) <= 0 ? t("desktop.outOfStock") : t("desktop.leftCount", { count: Number(p.stock) })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {!isStart && (
        <div className="flex items-center gap-3 text-xs font-bold">
          <span className="text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px]">{t("desktop.quickActions")}</span>
          <Link to="/seller/create-promotion" className={`${card} h-10 px-4 flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:border-[#5346E0]/40 transition-colors`}><Flame size={14} />{t("sellerDashboard.createPromotion")}</Link>
          <Link to="/seller/marketing" className={`${card} h-10 px-4 flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:border-[#5346E0]/40 transition-colors`}><Megaphone size={14} />{t("sellerDashboard.createCoupon")}</Link>
          <Link to="/seller/crm" className={`${card} h-10 px-4 flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:border-[#5346E0]/40 transition-colors`}><TrendingUp size={14} />{t("sellerSidebar.customers")}</Link>
        </div>
      )}
    </div>
  );
};

export default DesktopDashboard;
