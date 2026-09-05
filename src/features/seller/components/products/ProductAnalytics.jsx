import { useMemo, useState, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Download, Trophy, Package, Layers, AlertTriangle,
  Clock, Star, ImageOff, Sparkles, Loader2,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useSession } from "@/context/SessionContext";
import { useAnalyticsOrders } from "@/hooks/seller/useAnalyticsOrders";
import { useAnalyticsProducts } from "@/hooks/seller/useAnalyticsProducts";
import {
  buildProductPeriodStats, getTopProducts, getCategoryBreakdown,
  getDeadStock, getLowStockAlerts, computeSummaryInsights,
} from "@/utils/productAnalytics";
import { exportToCsv } from "@/utils/csvExport";
import { generateAnalyticsInsight } from "@/services/ai/aiCeoInsights";
import { useLanguage } from "@/context/LanguageContext";
import { getCalendarMonthRange } from "@/utils/dateRange";
import MonthPickerSheet from "@/components/ui/MonthPickerSheet";

const DAY_MS = 24 * 60 * 60 * 1000;
const money = (n) => `${Math.round(n).toLocaleString()} so'm`;

// P&L'ning ProfitDeepDive.jsx sahifasidagi bilan AYNAN BIR XIL davr
// tanlash naqshi - loyihada bu ikkinchi joyda ham qo'lda takrorlanadi
// (mavjud kod bazasidagi o'rnatilgan pretsedent - ProfitDeepDive ham
// buni ULASHILGAN emas, o'zining ichida saqlaydi).
const TIME_FILTER_DAYS = [
  { key: "week", labelKey: "filterWeek", days: 7 },
  { key: "month", labelKey: "filterMonth", days: 30 },
  { key: "quarter", labelKey: "filterQuarter", days: 90 },
  { key: "year", labelKey: "filterYear", days: 365 },
];

// Kategoriya chizig'i uchun cheklangan, loyihada ALLAQACHON
// ishlatilgan ranglar palitrasi (yangi rang qo'shilmadi).
const CATEGORY_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#3b82f6", "#a855f7"];

const RANK_METRICS = [
  { key: "revenue", labelKey: "metricRevenue" },
  { key: "unitsSold", labelKey: "metricUnits" },
  { key: "profit", labelKey: "metricProfit" },
];

const ProductThumb = memo(({ image, name }) => (
  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden flex items-center justify-center">
    {image ? (
      <img src={image} alt={name} className="w-full h-full object-cover" loading="lazy" />
    ) : (
      <ImageOff size={14} className="text-slate-300 dark:text-slate-600" />
    )}
  </div>
));
ProductThumb.displayName = "ProductThumb";

// Reyting qatorlari alohida, memo qilingan komponentga ajratilgan -
// bu, foydalanuvchi metrikani almashtirganda (masalan "Dona"dan
// "Tushum"ga) faqat RO'YXAT qayta chizilishini ta'minlaydi, butun
// sahifa emas.
const RankRow = memo(({ rank, product, metric, maxValue, t }) => {
  const value = product[metric];
  const widthPct = maxValue > 0 ? Math.max(6, (value / maxValue) * 100) : 0;
  const displayValue = metric === "unitsSold" ? `${value} ${t("productAnalytics.unitsSuffix")}` : money(value);

  return (
    <div className="flex items-center gap-2.5">
      <span className="w-4 text-[11px] font-black text-slate-300 dark:text-slate-600 text-center shrink-0">{rank}</span>
      <ProductThumb image={product.image} name={product.name} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{product.name}</p>
        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-1 overflow-hidden">
          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${widthPct}%` }} />
        </div>
      </div>
      <span className="text-xs font-black text-slate-700 dark:text-slate-200 shrink-0">{displayValue}</span>
    </div>
  );
});
RankRow.displayName = "RankRow";

const DeadStockRow = memo(({ product, t }) => (
  <div className="flex items-center gap-2.5 bg-rose-50/60 dark:bg-rose-500/10 rounded-xl p-2.5">
    <ProductThumb image={product.image} name={product.name} />
    <div className="flex-1 min-w-0">
      <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{product.name}</p>
      <p className="text-[10px] font-semibold text-rose-500">
        {product.daysSinceLastSale === null
          ? t("productAnalytics.neverSold")
          : t("productAnalytics.daysSinceLastSale", { days: product.daysSinceLastSale })}
      </p>
    </div>
    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
      {t("productAnalytics.stockLeft", { count: product.stock })}
    </span>
  </div>
));
DeadStockRow.displayName = "DeadStockRow";

const LowStockRow = memo(({ product, t }) => (
  <div className="flex items-center gap-2.5 bg-amber-50/60 dark:bg-amber-500/10 rounded-xl p-2.5">
    <ProductThumb image={product.image} name={product.name} />
    <div className="flex-1 min-w-0">
      <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{product.name}</p>
      <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
        {t("productAnalytics.daysUntilStockout", { days: product.daysUntilStockout })}
      </p>
    </div>
    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
      {t("productAnalytics.stockLeft", { count: product.stock })}
    </span>
  </div>
));
LowStockRow.displayName = "LowStockRow";

// PRODUCTION-LEVEL MAHSULOTLAR ANALITIKASI — P&L Dashboard/
// ProfitDeepDive bilan BIR XIL vizual til va arxitektura darajasida.
//
// MUHIM TUZATISH (haqiqiy production xatosi, o'z-o'zini tekshiruv
// orqali topilgan): OLDIN bu yerda `useFilterOrders`/`useGetSellerProducts`
// (Buyurtmalar/Mahsulotlar BOSHQARUV sahifalari ishlatadigan, mos
// ravishda 150/100 talik CHEGARALANGAN hooklar) ishlatilardi -
// katta do'kon uchun, uzoq davr tanlansa, daromad HAQIQIYSIDAN
// KAMROQ, "o'lik mahsulot" esa noto'g'ri "hech qachon sotilmagan"
// deb ko'rsatilishi mumkin edi (haqiqiy oxirgi sotuv 150-chegaradan
// tashqarida qolib ketgani uchun). Endi `useAnalyticsOrders`/
// `useAnalyticsProducts` - alohida, SAHIFALASHSIZ (faqat xavfsizlik
// uchun yuqori chegara bilan cheklangan) server so'rovlari
// ishlatiladi - bu, oddiy boshqaruv sahifalariga qaraganda KO'PROQ
// Firestore xarajatiga olib keladi, lekin noto'g'ri biznes
// ma'lumotidan ko'ra arzonroq, oqlangan almashinuv. Barcha og'ir
// hisob-kitoblar sof funksiyalarga (`utils/productAnalytics.js`)
// ajratilgan va `useMemo` bilan o'ralgan.
//
// MUHIM DIZAYN QARORI ("tez tugayotgan mahsulotlar" bo'limi uchun):
// ombor tugash tezligi HAR DOIM so'nggi 30 kunlik HAQIQIY sotuv
// tezligidan hisoblanadi - foydalanuvchi yuqorida "Yil" kabi UZOQ
// davrni tanlagan bo'lsa ham. Aks holda, uzoq davr tanlanganda
// o'rtacha tezlik sun'iy ravishda pasayib, "3 kunda tugaydi" degan
// shoshilinch holat ko'rinmay qolishi mumkin edi.
const ProductAnalytics = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId, store } = useSession();
  const TIME_FILTERS = useMemo(() => TIME_FILTER_DAYS.map((f) => ({ ...f, label: t(`productAnalytics.${f.labelKey}`) })), [t]);

  const { orders = [], loading: ordersLoading } = useAnalyticsOrders(sellerId);
  const { products = [], loading: productsLoading } = useAnalyticsProducts(sellerId);
  const isLoading = ordersLoading || productsLoading;

  const [activeFilter, setActiveFilter] = useState("month");
  const [rankMetric, setRankMetric] = useState("revenue");
  // "Oy" filtiri uchun tanlangan aniq oy (0 = joriy oy) - 2026-09
  // punkt-royxati, 1-band.
  const [selectedMonthsAgo, setSelectedMonthsAgo] = useState(0);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const handleFilterClick = (key) => {
    setActiveFilter(key);
    if (key === "month") setShowMonthPicker(true);
  };

  const activeDays = TIME_FILTER_DAYS.find((f) => f.key === activeFilter)?.days || 30;
  const now = Date.now();
  const monthRange = useMemo(() => getCalendarMonthRange(selectedMonthsAgo), [selectedMonthsAgo]);

  const stats = useMemo(() => {
    // "Oy" — OLDIN trailing-30-kun edi (2026-09 punkt-royxati, 1-band
    // bo'yicha xato deb topilgan). Endi HAQIQIY kalendar oyi.
    if (activeFilter === "month") {
      const rangeEnd = selectedMonthsAgo === 0 ? now : monthRange.end;
      return buildProductPeriodStats(products, orders, monthRange.start, rangeEnd, now);
    }
    const rangeStart = now - activeDays * DAY_MS;
    return buildProductPeriodStats(products, orders, rangeStart, now, now);
  }, [products, orders, activeFilter, activeDays, monthRange, selectedMonthsAgo, now]);

  // Tez tugayotgan mahsulot ogohlantirishi uchun - qat'iy 30 kunlik
  // oyna, yuqoridagi filtrdan MUSTAQIL (izoh: yuqoriga qarang).
  const recentStats = useMemo(() => {
    const rangeStart = now - 30 * DAY_MS;
    return buildProductPeriodStats(products, orders, rangeStart, now, now);
  }, [products, orders, now]);

  const topProducts = useMemo(() => getTopProducts(stats, rankMetric, 5), [stats, rankMetric]);
  const categoryBreakdown = useMemo(() => getCategoryBreakdown(stats), [stats]);
  const deadStock = useMemo(() => getDeadStock(stats, 30), [stats]);
  const lowStockAlerts = useMemo(() => getLowStockAlerts(recentStats, 30, 7), [recentStats]);
  const insights = useMemo(() => computeSummaryInsights(stats, deadStock), [stats, deadStock]);
  const topProduct = topProducts[0] || null;

  // AI CEO 4-BOSQICH: sahifada ALLAQACHON hisoblangan (yangi
  // Firestore so'rovisiz) o'lik/tez tugayotgan mahsulot ro'yxatlarini
  // AI sharhiga aylantiradi - FAQAT tugma bosilganda (avtomatik
  // emas), xarajatni nazorat ostida ushlab turadi.
  const [aiInsight, setAiInsight] = useState(null);
  const [aiInsightLoading, setAiInsightLoading] = useState(false);
  const [aiInsightError, setAiInsightError] = useState(null);

  const handleGenerateInsight = useCallback(async () => {
    setAiInsightLoading(true);
    setAiInsightError(null);
    try {
      const result = await generateAnalyticsInsight({
        deadStockNames: deadStock.map((p) => p.name),
        lowStockNames: lowStockAlerts.map((p) => p.name),
        topProductName: topProduct?.name || null,
        totalRevenue: insights.totalRevenue,
      });
      setAiInsight(result);
    } catch (err) {
      setAiInsightError(err.message || t("aiCeo.insightError"));
    } finally {
      setAiInsightLoading(false);
    }
  }, [deadStock, lowStockAlerts, topProduct, insights.totalRevenue, t]);

  const maxRankValue = topProduct ? topProduct[rankMetric] : 0;

  const chartData = useMemo(
    () => topProducts.map((p) => ({
      name: p.name.length > 14 ? `${p.name.slice(0, 14)}…` : p.name,
      fullName: p.name,
      value: p[rankMetric],
    })),
    [topProducts, rankMetric]
  );

  const handleExport = useCallback(() => {
    const rows = [
      [t("productAnalytics.csvTitle"), `${t("productAnalytics.csvPeriod")} ${TIME_FILTERS.find((f) => f.key === activeFilter)?.label || ""}`, new Date().toLocaleDateString("uz-UZ")],
      [],
      [
        t("productAnalytics.csvName"), t("productAnalytics.csvCategory"), t("productAnalytics.csvUnits"),
        t("productAnalytics.csvRevenue"), t("productAnalytics.csvProfit"), t("productAnalytics.csvStock"),
        t("productAnalytics.csvDaysSinceLastSale"),
      ],
      ...stats
        .slice()
        .sort((a, b) => b.revenue - a.revenue)
        .map((p) => [p.name, p.category, p.unitsSold, Math.round(p.revenue), Math.round(p.profit), p.stock, p.daysSinceLastSale ?? t("productAnalytics.neverSoldShort")]),
    ];
    exportToCsv(`mahsulotlar-analitikasi-${activeFilter}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }, [stats, activeFilter, TIME_FILTERS, t]);

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
            <h1 className="text-sm font-black text-slate-800 dark:text-white truncate">{t("productAnalytics.pageTitle")}</h1>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">{t("productAnalytics.subtitle")}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={stats.length === 0}
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
              onClick={() => handleFilterClick(f.key)}
              className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                activeFilter === f.key
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800"
              }`}
            >
              {f.key === "month" && activeFilter === "month" && selectedMonthsAgo > 0
                ? `${t("common.monthNamesShort")[monthRange.month]} ${monthRange.year}`
                : f.label}
            </button>
          ))}
        </div>

        {showMonthPicker && (
          <MonthPickerSheet
            selectedMonthsAgo={selectedMonthsAgo}
            onSelect={setSelectedMonthsAgo}
            onClose={() => setShowMonthPicker(false)}
          />
        )}

        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">{t("productAnalytics.loading")}</div>
        ) : stats.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-center px-6">
            <Package size={28} className="text-slate-300 dark:text-slate-600" />
            <p className="text-xs text-slate-400 dark:text-slate-500">{t("productAnalytics.noProducts")}</p>
          </div>
        ) : (
          <>
            {/* HERO — davrning eng yaxshi sotuvchi mahsuloti */}
            {topProduct ? (
              <div className="rounded-[28px] p-5 text-white shadow-lg shadow-indigo-600/20 relative overflow-hidden bg-gradient-to-br from-indigo-600 to-indigo-700">
                <div className="flex items-start justify-between">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-white/80 uppercase tracking-wider">
                    <Trophy size={12} /> {t("productAnalytics.bestSellerLabel")}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <div className="w-14 h-14 rounded-2xl bg-white/15 shrink-0 overflow-hidden flex items-center justify-center">
                    {topProduct.image ? (
                      <img src={topProduct.image} alt={topProduct.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package size={20} className="text-white/70" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-black tracking-tight truncate">{topProduct.name}</h2>
                    <p className="text-[11px] font-semibold text-white/70">{topProduct.category}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-white/15 rounded-2xl p-3">
                    <span className="text-[10px] font-bold uppercase text-white/80">{t("productAnalytics.revenueLabel")}</span>
                    <p className="text-base font-black mt-1">{money(topProduct.revenue)}</p>
                  </div>
                  <div className="bg-white/15 rounded-2xl p-3">
                    <span className="text-[10px] font-bold uppercase text-white/80">{t("productAnalytics.unitsSoldLabel")}</span>
                    <p className="text-base font-black mt-1">{topProduct.unitsSold} {t("productAnalytics.unitsSuffix")}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 text-center">
                <p className="text-xs text-slate-400 dark:text-slate-500">{t("productAnalytics.noSalesInPeriod")}</p>
              </div>
            )}

            {/* QISQA XULOSA — 3 ta ko'rsatkich */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-xl">
                <Layers size={14} className="text-indigo-500 mb-1.5" />
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("productAnalytics.totalProductsLabel")}</p>
                <p className="text-sm font-black text-slate-800 dark:text-white mt-0.5">{insights.totalProducts}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-xl">
                <Package size={14} className="text-emerald-500 mb-1.5" />
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("productAnalytics.unitsSoldLabel")}</p>
                <p className="text-sm font-black text-slate-800 dark:text-white mt-0.5">{insights.totalUnitsSold}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-xl">
                <Star size={14} className="text-amber-500 mb-1.5" />
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("productAnalytics.topCategoryLabel")}</p>
                <p className="text-xs font-black text-slate-800 dark:text-white mt-0.5 truncate">{insights.topCategory || "—"}</p>
              </div>
            </div>

            {/* TOP MAHSULOTLAR — grafik + reyting */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("productAnalytics.topProductsTitle")}</h3>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                  {RANK_METRICS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setRankMetric(m.key)}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
                        rankMetric === m.key ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs" : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {t(`productAnalytics.${m.labelKey}`)}
                    </button>
                  ))}
                </div>
              </div>

              {topProducts.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">{t("productAnalytics.noRankingData")}</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={Math.max(120, topProducts.length * 34)}>
                    <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-100 dark:text-slate-800" horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 10, fill: "currentColor" }}
                        className="text-slate-500 dark:text-slate-400"
                        axisLine={false}
                        tickLine={false}
                        width={90}
                      />
                      <Tooltip
                        formatter={(value) => [rankMetric === "unitsSold" ? `${value} ${t("productAnalytics.unitsSuffix")}` : money(value), ""]}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""}
                        contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12, fontWeight: 600 }}
                      />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]} maxBarSize={18}>
                        {chartData.map((_, i) => <Cell key={i} fill="#6366f1" fillOpacity={1 - i * 0.12} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="space-y-3 pt-1">
                    {topProducts.map((p, i) => (
                      <RankRow key={p.id} rank={i + 1} product={p} metric={rankMetric} maxValue={maxRankValue} t={t} />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* KATEGORIYALAR BO'YICHA TAQSIMOT */}
            {categoryBreakdown.length > 0 && categoryBreakdown.some((c) => c.revenue > 0) && (
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2.5">
                <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("productAnalytics.categoryBreakdownTitle")}</h3>
                {categoryBreakdown.filter((c) => c.revenue > 0).slice(0, 6).map((c, i) => (
                  <div key={c.category}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">{c.category}</span>
                      <span className="text-xs font-black text-slate-800 dark:text-white shrink-0 ml-2">{c.percentOfRevenue.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${c.percentOfRevenue}%`, backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TEZ TUGAYOTGAN MAHSULOTLAR */}
            {lowStockAlerts.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={13} />
                  <h3 className="text-xs font-black uppercase tracking-wider">{t("productAnalytics.lowStockTitle")}</h3>
                </div>
                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{t("productAnalytics.lowStockSubtitle")}</p>
                <div className="space-y-1.5 pt-1">
                  {lowStockAlerts.slice(0, 8).map((p) => <LowStockRow key={p.id} product={p} t={t} />)}
                </div>
              </div>
            )}

            {/* O'LIK MAHSULOTLAR */}
            {deadStock.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
                <div className="flex items-center gap-1.5 text-rose-500">
                  <Clock size={13} />
                  <h3 className="text-xs font-black uppercase tracking-wider">{t("productAnalytics.deadStockTitle")}</h3>
                </div>
                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{t("productAnalytics.deadStockSubtitle")}</p>
                <div className="space-y-1.5 pt-1">
                  {deadStock.slice(0, 8).map((p) => <DeadStockRow key={p.id} product={p} t={t} />)}
                </div>
                {deadStock.length > 8 && (
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 text-center pt-1">
                    {t("productAnalytics.andMore", { count: deadStock.length - 8 })}
                  </p>
                )}
              </div>
            )}

            {/* AI CEO — SHARH VA TAVSIYA (faqat premium mijozlarga) */}
            {store?.aiCeoEnabled === true && (deadStock.length > 0 || lowStockAlerts.length > 0 || topProduct) && (
              <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-4 text-white shadow-sm space-y-3">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={13} />
                  <h3 className="text-xs font-black uppercase tracking-wider">{t("aiCeo.insightTitle")}</h3>
                </div>
                {aiInsight ? (
                  <p className="text-xs font-medium leading-relaxed text-white/90">{aiInsight}</p>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerateInsight}
                    disabled={aiInsightLoading}
                    className="w-full h-10 rounded-xl bg-white/15 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {aiInsightLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    {aiInsightLoading ? t("aiCeo.insightGenerating") : t("aiCeo.insightGenerateButton")}
                  </button>
                )}
                {aiInsightError && <p className="text-[11px] font-semibold text-rose-200">{aiInsightError}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProductAnalytics;
