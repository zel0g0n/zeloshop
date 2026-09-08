import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ShieldAlert, Lightbulb, TrendingUp, TrendingDown, Wallet,
  ShoppingCart, Percent, Users, Target, HandCoins, Trophy, AlertTriangle, UserRoundCog,
  Megaphone, UserPlus, Repeat, Loader2, ImageOff, Send,
} from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import updateSeller from "@/services/sellers/updateSeller";
import KpiCard from "./KpiCard";
import { useOrderRollups } from "@/hooks/seller/useOrderRollups";
import { useAnalyticsOrders } from "@/hooks/seller/useAnalyticsOrders";
import { useAnalyticsProducts } from "@/hooks/seller/useAnalyticsProducts";
import useCrmOrders from "@/hooks/seller/useCrmOrders";
import { useExpenses } from "@/hooks/seller/useExpenses";
import { useCampaigns } from "@/hooks/seller/useCampaigns";
import { getStaffList } from "@/services/staff/getStaffList";
import { getVisitorCount } from "@/services/analytics/getVisitorCount";
import { getEffectiveTariffPlan } from "@/utils/tariffLimits";
import BiznesBadge from "@/components/ui/BiznesBadge";
import { filterOrdersInRange, computeOrderSummary } from "@/utils/orderAnalytics";
import { buildProductPeriodStats, getTopProducts } from "@/utils/productAnalytics";
import { computeCustomerSegments } from "@/utils/customerSegments";
import { computeCac } from "@/utils/cac";
import { computeStaffPerformance } from "@/utils/staffPerformanceStats";
import { computeCampaignStats, getBestCampaign } from "@/utils/campaignStats";
import {
  computeProductDeclineInsights, computeReorderDueCustomers, computeNewCustomerTrend,
} from "@/utils/businessInsights";

const DAY_MS = 24 * 60 * 60 * 1000;
const money = (n) => `${Math.round(n).toLocaleString()} so'm`;

// P&L/Mahsulot analitikasi bilan BIR XIL "kunlarga asoslangan, sobit
// uzunlikdagi" davr tanlovi (kalendar oyidan farqli o'laroq) — bu
// yerda ATAYLAB shunday tanlangan: "joriy davr"ni "oldingi (bir xil
// uzunlikdagi) davr" bilan solishtirish (tendentsiya ko'rsatkichlari,
// "mijoz jalb qilish" tendentsiyasi) kalendar oyi chegaralari bilan
// ancha murakkablashardi (oylar uzunligi turlicha).
const PERIODS = [
  { key: "week", labelKey: "period7", days: 7 },
  { key: "month", labelKey: "period30", days: 30 },
  { key: "quarter", labelKey: "period90", days: 90 },
];

/**
 * "BIZNES BUYRUQ MARKAZI" — Z-Biznes tarifiga xos, sotuvchi
 * biznesining barcha muhim ko'rsatkichlarini (daromad, foyda,
 * xarajat, buyurtmalar, o'rtacha chek, konversiya, qayta xarid
 * darajasi, CAC, LTV, top/eng past mahsulotlar, eng yaxshi xodim,
 * eng yaxshi marketing kampaniyasi, mijoz jalb qilish, retention) BIR
 * EKRANDA, proaktiv xulosa jumlalari bilan birga ko'rsatadigan
 * sahifa (2026-09 punkt-royxati, 3-band).
 *
 * ARXITEKTURA QARORI: bu sahifa - PnLDashboard/ProductAnalytics/CrmHub
 * kabi, mavjud, ALLAQACHON ishlayotgan HOOK/UTIL'larni qayta
 * ishlatib, hisob-kitobni BRAUZERDA (client-side) bajaradigan
 * KOMPOZITSIYA sahifasi - alohida, yangi server-tomon agregator
 * funksiya YARATILMAGAN (bu, loyihada allaqachon o'rnatilgan naqsh
 * bilan izchil, va "ortiqcha muhandislik qilma" qoidasiga mos).
 *
 * XULOSA JUMLALARI HAQIDA HALOLLIK: pastdagi "Muhim xulosalar" bo'limi
 * HAQIQIY sun'iy intellekt BASHORATI EMAS - bular DETERMINISTIK, sof
 * arifmetik tendentsiya hisob-kitoblari (davr-bilan-davrni solishtirish,
 * mijozning o'z tarixidagi o'rtacha xarid oralig'i). Batafsil izoh:
 * `src/utils/businessInsights.js`.
 */
const BusinessCommandCenterPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId, store, patchStore } = useSession();

  const isBiznes = getEffectiveTariffPlan(store) === "biznes";

  // HAFTALIK HISOBOT (2026-09, "katta bizneslar uchun" ro'yxati,
  // 2-guruh: "Buyruq Markazi hisobotlarini jadval bo'yicha avtomatik
  // yuborish") — haqiqiy ijro `functions/weeklyBusinessReport.js`dagi
  // haftalik cron'da, bu yerda FAQAT yoqish/o'chirish tugmasi.
  // Standart bo'yicha YOQILGAN (`weeklyReportEnabled !== false`) —
  // pul/chegirma bilan bog'liq emas, faqat ma'lumot xabari.
  const [weeklyReportEnabled, setWeeklyReportEnabled] = useState(store?.weeklyReportEnabled !== false);
  useEffect(() => {
    if (!store) return;
    setWeeklyReportEnabled(store.weeklyReportEnabled !== false);
  }, [store]);
  const handleWeeklyReportToggle = useCallback(async () => {
    const next = !weeklyReportEnabled;
    setWeeklyReportEnabled(next);
    if (sellerId) {
      try {
        await updateSeller(sellerId, { weeklyReportEnabled: next });
        patchStore({ weeklyReportEnabled: next });
      } catch {
        setWeeklyReportEnabled(!next); // Yozish muvaffaqiyatsiz bo'lsa - eski holatga qaytaramiz.
      }
    }
  }, [weeklyReportEnabled, sellerId, patchStore]);

  const [periodKey, setPeriodKey] = useState("month");
  const period = PERIODS.find((p) => p.key === periodKey) || PERIODS[1];

  const [mountedAtMs] = useState(() => Date.now());
  const rangeEnd = mountedAtMs;
  const rangeStart = rangeEnd - period.days * DAY_MS;
  const previousRangeStart = rangeStart - period.days * DAY_MS;

  // Tendentsiya solishtirishlari uchun (joriy + oldingi davr) - eng
  // uzun davr (90 kun) uchun ham yetarli bo'lishi kerak, shuning uchun
  // har doim 2 barobar (180 kun) + zaxira orqaga qaraladi.
  const sinceMs = useMemo(() => mountedAtMs - 2 * 90 * DAY_MS, [mountedAtMs]);

  const { days: rollupDays, loading: rollupsLoading } = useOrderRollups(sellerId, sinceMs);
  const { orders: allOrders, loading: ordersLoading } = useAnalyticsOrders(sellerId);
  const { products, loading: productsLoading } = useAnalyticsProducts(sellerId);
  const { customers: crmCustomers, loading: customersLoading } = useCrmOrders(sellerId);
  const { expenses, loading: expensesLoading } = useExpenses(sellerId);
  const { campaigns, loading: campaignsLoading } = useCampaigns(sellerId);

  const [staffList, setStaffList] = useState([]);
  useEffect(() => {
    if (!sellerId || !isBiznes) return undefined;
    const unsubscribe = getStaffList(sellerId, setStaffList, () => setStaffList([]));
    return () => unsubscribe?.();
  }, [sellerId, isBiznes]);

  // Davr-bo'yicha KONVERSIYA (buyurtma/tashrif) uchun - server
  // tomonidagi `visits` kolleksiyasidan (mijoz SDK'i o'qiy olmaydi).
  const [visitorCount, setVisitorCount] = useState(null);
  const [visitorCountLoading, setVisitorCountLoading] = useState(true);
  useEffect(() => {
    if (!sellerId || !isBiznes) return;
    let cancelled = false;
    setVisitorCountLoading(true);
    getVisitorCount(sellerId, period.days)
      .then((count) => { if (!cancelled) setVisitorCount(count); })
      .catch(() => { if (!cancelled) setVisitorCount(null); })
      .finally(() => { if (!cancelled) setVisitorCountLoading(false); });
    return () => { cancelled = true; };
  }, [sellerId, isBiznes, period.days]);

  const periodOrders = useMemo(() => filterOrdersInRange(allOrders, rangeStart, rangeEnd), [allOrders, rangeStart, rangeEnd]);
  const orderSummary = useMemo(() => computeOrderSummary(periodOrders), [periodOrders]);

  const periodDays = useMemo(
    () => rollupDays.filter((d) => d.dateMs >= rangeStart && d.dateMs < rangeEnd),
    [rollupDays, rangeStart, rangeEnd]
  );
  const totalRevenue = useMemo(() => periodDays.reduce((sum, d) => sum + (Number(d.revenue) || 0), 0), [periodDays]);
  const totalCogs = useMemo(() => periodDays.reduce((sum, d) => sum + (Number(d.cogs) || 0), 0), [periodDays]);

  const periodExpenses = useMemo(
    () => expenses.filter((e) => {
      const ms = Number(e.createdAtMs) || 0;
      return ms >= rangeStart && ms < rangeEnd;
    }),
    [expenses, rangeStart, rangeEnd]
  );
  const totalExpenses = useMemo(() => periodExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0), [periodExpenses]);
  const totalMarketingSpend = useMemo(
    () => periodExpenses.filter((e) => e.category === "marketing").reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [periodExpenses]
  );
  const netProfit = totalRevenue - totalCogs - totalExpenses;

  const conversionRate = visitorCount > 0 ? (orderSummary.deliveredCount / visitorCount) * 100 : null;

  const { customers: segmentedCustomers, averageLtv, retentionRate } = useMemo(
    () => computeCustomerSegments(crmCustomers),
    [crmCustomers]
  );
  const { cac } = useMemo(
    () => computeCac(crmCustomers, rangeStart, rangeEnd, totalMarketingSpend),
    [crmCustomers, rangeStart, rangeEnd, totalMarketingSpend]
  );

  const currentProductStats = useMemo(
    () => buildProductPeriodStats(products, allOrders, rangeStart, rangeEnd),
    [products, allOrders, rangeStart, rangeEnd]
  );
  const previousProductStats = useMemo(
    () => buildProductPeriodStats(products, allOrders, previousRangeStart, rangeStart),
    [products, allOrders, previousRangeStart, rangeStart]
  );
  const topProducts = useMemo(() => getTopProducts(currentProductStats, "revenue", 5), [currentProductStats]);
  const worstProducts = useMemo(
    () => currentProductStats
      .filter((p) => p.stock > 0)
      .sort((a, b) => a.revenue - b.revenue)
      .slice(0, 5),
    [currentProductStats]
  );

  const staffStats = useMemo(
    () => staffList
      .map((member) => ({ ...member, ...computeStaffPerformance(periodOrders, member.id) }))
      .filter((member) => member.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5),
    [staffList, periodOrders]
  );

  const campaignsWithSentAtMs = useMemo(() => campaigns.filter((c) => c.sentAtMs >= rangeStart && c.sentAtMs <= rangeEnd), [campaigns, rangeStart, rangeEnd]);
  const campaignStats = useMemo(() => computeCampaignStats(campaignsWithSentAtMs, allOrders), [campaignsWithSentAtMs, allOrders]);
  const bestCampaign = useMemo(() => getBestCampaign(campaignStats), [campaignStats]);

  const newCustomerTrend = useMemo(
    () => computeNewCustomerTrend(rollupDays, rangeStart, rangeEnd),
    [rollupDays, rangeStart, rangeEnd]
  );
  const reorderDueCustomers = useMemo(() => computeReorderDueCustomers(segmentedCustomers), [segmentedCustomers]);
  const productDeclines = useMemo(
    () => computeProductDeclineInsights(currentProductStats, previousProductStats, { limit: 2 }),
    [currentProductStats, previousProductStats]
  );

  const insights = useMemo(() => {
    const list = [];
    productDeclines.forEach((d) => {
      list.push({
        id: `decline-${d.id}`,
        icon: TrendingDown,
        tone: "rose",
        text: t("commandCenter.insightProductDecline", { name: d.name, days: period.days, percent: Math.abs(d.changePercent) }),
      });
    });
    if (reorderDueCustomers.length > 0) {
      list.push({
        id: "reorder-due",
        icon: Repeat,
        tone: "indigo",
        text: t("commandCenter.insightReorderDue", { count: reorderDueCustomers.length }),
      });
    }
    if (newCustomerTrend.changePercent !== null && Math.abs(newCustomerTrend.changePercent) >= 15) {
      const up = newCustomerTrend.changePercent > 0;
      list.push({
        id: "acquisition-trend",
        icon: up ? TrendingUp : TrendingDown,
        tone: up ? "emerald" : "amber",
        text: t(up ? "commandCenter.insightAcquisitionUp" : "commandCenter.insightAcquisitionDown", {
          percent: Math.abs(newCustomerTrend.changePercent),
          days: period.days,
        }),
      });
    }
    return list;
  }, [productDeclines, reorderDueCustomers, newCustomerTrend, period.days, t]);

  const loading = rollupsLoading || ordersLoading || productsLoading || customersLoading || expensesLoading || campaignsLoading;

  if (!isBiznes) {
    return (
      <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-36 transition-colors duration-300">
        <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-base font-black text-slate-800 dark:text-white">{t("commandCenter.title")}</h1>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("commandCenter.subtitle")}</p>
          </div>
        </div>
        <div className="p-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex items-start gap-2.5">
            <ShieldAlert size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t("commandCenter.requiresBiznes")}</p>
              <button
                type="button"
                onClick={() => navigate("/seller/tariffs")}
                className="mt-3 h-10 px-4 rounded-xl bg-indigo-600 text-white text-xs font-bold"
              >
                {t("commandCenter.upgradeButton")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-36 transition-colors duration-300">
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-1.5">
            {t("commandCenter.title")} <BiznesBadge size="xs" />
          </h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("commandCenter.subtitle")}</p>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="bg-slate-200/60 dark:bg-slate-800 p-1 rounded-xl grid grid-cols-3 text-center text-xs font-black text-slate-500 dark:text-slate-400">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriodKey(p.key)}
              className={`py-2 rounded-lg transition-colors ${periodKey === p.key ? "bg-white dark:bg-slate-900 text-[#5346E0] dark:text-[#8b85f5] shadow-xs" : "hover:text-slate-800 dark:hover:text-slate-200"}`}
            >
              {t(`commandCenter.${p.labelKey}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3">
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 shrink-0 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
            <Send size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-black text-slate-700 dark:text-white">{t("commandCenter.weeklyReportTitle")}</h4>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("commandCenter.weeklyReportDesc")}</p>
          </div>
          <button
            type="button"
            onClick={handleWeeklyReportToggle}
            className={`shrink-0 w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${weeklyReportEnabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
          >
            <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 dark:text-slate-500">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Muhim xulosalar - batafsil izoh: `src/utils/businessInsights.js` (HALOLLIK CHEGARASI). */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-2.5">
            <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
              <Lightbulb size={13} />
              <h3 className="text-xs font-black uppercase tracking-wider">{t("commandCenter.insightsTitle")}</h3>
            </div>
            {insights.length === 0 ? (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("commandCenter.noInsights")}</p>
            ) : (
              <div className="space-y-2">
                {insights.map((insight) => {
                  const Icon = insight.icon;
                  const toneClass = {
                    rose: "bg-rose-50 dark:bg-rose-500/10 text-rose-500",
                    amber: "bg-amber-50 dark:bg-amber-500/10 text-amber-500",
                    emerald: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                    indigo: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500",
                  }[insight.tone];
                  return (
                    <div key={insight.id} className="flex items-start gap-2.5 bg-[#F4F5F9] dark:bg-slate-800 rounded-xl p-2.5">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${toneClass}`}>
                        <Icon size={13} />
                      </span>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">{insight.text}</p>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-[9px] text-slate-300 dark:text-slate-600 leading-relaxed pt-1">{t("commandCenter.insightsDisclaimer")}</p>
          </div>

          {/* KPI panjarasi */}
          <div className="grid grid-cols-2 gap-2.5">
            <KpiCard icon={Wallet} iconColorClass="text-emerald-500" label={t("commandCenter.kpiRevenue")} value={money(totalRevenue)} />
            <KpiCard icon={TrendingUp} iconColorClass={netProfit >= 0 ? "text-emerald-500" : "text-rose-500"} label={t("commandCenter.kpiProfit")} value={money(netProfit)} />
            <KpiCard icon={HandCoins} iconColorClass="text-amber-500" label={t("commandCenter.kpiExpenses")} value={money(totalExpenses)} />
            <KpiCard icon={ShoppingCart} iconColorClass="text-indigo-500" label={t("commandCenter.kpiOrders")} value={`${orderSummary.deliveredCount}`} subtext={`${t("commandCenter.kpiOrdersOfTotal", { total: orderSummary.totalOrders })}`} />
            <KpiCard icon={Wallet} iconColorClass="text-indigo-500" label={t("commandCenter.kpiAov")} value={money(orderSummary.aov)} />
            <KpiCard
              icon={Percent}
              iconColorClass="text-indigo-500"
              label={t("commandCenter.kpiConversion")}
              value={visitorCountLoading ? "…" : (conversionRate !== null ? `${conversionRate.toFixed(1)}%` : t("commandCenter.noData"))}
            />
            <KpiCard icon={Repeat} iconColorClass="text-indigo-500" label={t("commandCenter.kpiRetention")} value={`${retentionRate.toFixed(1)}%`} />
            <KpiCard icon={Target} iconColorClass="text-indigo-500" label={t("commandCenter.kpiCac")} value={cac !== null ? money(cac) : t("commandCenter.noData")} />
            <KpiCard icon={Users} iconColorClass="text-indigo-500" label={t("commandCenter.kpiLtv")} value={money(averageLtv)} />
            <KpiCard
              icon={UserPlus}
              iconColorClass="text-emerald-500"
              label={t("commandCenter.kpiNewCustomers")}
              value={`${newCustomerTrend.currentPeriodCount}`}
              subtext={newCustomerTrend.changePercent !== null ? `${newCustomerTrend.changePercent > 0 ? "+" : ""}${newCustomerTrend.changePercent}%` : undefined}
              subtextColorClass={newCustomerTrend.changePercent !== null ? (newCustomerTrend.changePercent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500") : undefined}
            />
          </div>

          {/* Top / eng past mahsulotlar */}
          <ProductListCard
            titleKey="commandCenter.topProductsTitle"
            icon={Trophy}
            products={topProducts}
            emptyKey="commandCenter.noProductSales"
            t={t}
          />
          <ProductListCard
            titleKey="commandCenter.worstProductsTitle"
            icon={AlertTriangle}
            products={worstProducts}
            emptyKey="commandCenter.noProductSales"
            t={t}
          />

          {/* Eng yaxshi xodimlar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-2.5">
            <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
              <UserRoundCog size={13} />
              <h3 className="text-xs font-black uppercase tracking-wider">{t("commandCenter.staffTitle")}</h3>
            </div>
            {staffStats.length === 0 ? (
              <p className="text-[11px] text-slate-400 dark:text-slate-500">{t("commandCenter.noStaffData")}</p>
            ) : (
              <div className="space-y-2">
                {staffStats.map((member, i) => (
                  <div key={member.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 text-[10px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                      <span className="text-xs font-bold text-slate-800 dark:text-white truncate">{member.fullName || member.phone || t("commandCenter.unnamedStaff")}</span>
                    </div>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 shrink-0">{money(member.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Eng yaxshi marketing kampaniyasi */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-2">
            <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
              <Megaphone size={13} />
              <h3 className="text-xs font-black uppercase tracking-wider">{t("commandCenter.campaignTitle")}</h3>
            </div>
            {bestCampaign ? (
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{bestCampaign.title}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("commandCenter.campaignAttributedOrders", { count: bestCampaign.attributedOrders })}</p>
                </div>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 shrink-0">{money(bestCampaign.attributedRevenue)}</span>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("commandCenter.noCampaignData")}</p>
            )}
          </div>

          <p className="text-[9px] text-slate-300 dark:text-slate-600 text-center leading-relaxed px-4">{t("commandCenter.pageDisclaimer")}</p>
        </div>
      )}
    </div>
  );
};

const ProductListCard = ({ titleKey, icon: Icon, products, emptyKey, t }) => (
  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-2.5">
    <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
      <Icon size={13} />
      <h3 className="text-xs font-black uppercase tracking-wider">{t(titleKey)}</h3>
    </div>
    {products.length === 0 ? (
      <p className="text-[11px] text-slate-400 dark:text-slate-500">{t(emptyKey)}</p>
    ) : (
      <div className="space-y-2">
        {products.map((p) => (
          <div key={p.id} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden flex items-center justify-center">
              {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" loading="lazy" /> : <ImageOff size={12} className="text-slate-300 dark:text-slate-600" />}
            </div>
            <span className="flex-1 min-w-0 text-xs font-bold text-slate-800 dark:text-white truncate">{p.name}</span>
            <span className="text-xs font-black text-slate-700 dark:text-slate-200 shrink-0">{money(p.revenue)}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default BusinessCommandCenterPage;
