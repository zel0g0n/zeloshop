import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, TrendingUp, TrendingDown, Trophy, Wallet } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useSession } from "@/context/SessionContext";
import { useTheme } from "@/context/ThemeContext";
import { useOrderRollups } from "@/hooks/seller/useOrderRollups";
import { buildDailyProfitSeriesFromRollups, computeSeriesInsights } from "@/utils/profitTimeSeries";
import { exportToCsv } from "@/utils/csvExport";
import { useLanguage } from "@/context/LanguageContext";
import { getCalendarMonthRange } from "@/utils/dateRange";
import MonthPickerSheet from "@/components/ui/MonthPickerSheet";

const money = (n) => `${Math.round(n).toLocaleString()} so'm`;

// Har bir vaqt filtri qancha kunlik tarixni qamrab olishini
// belgilaydi. "Barcha vaqt" — juda uzoq (10 yil) qilib olindi, bu
// amalda "cheklovsiz" degani, lekin ayni paytda Date matematikasi
// hech qachon buzilmasligini kafolatlaydi.
// Sarlavhalar KOMPONENT ICHIDA hisoblanadi (`t()` chaqirish uchun);
// bu yerda faqat kalit va kunlar soni saqlanadi.
const TIME_FILTER_DAYS = [
  { key: "today", labelKey: "filterToday", days: 1 },
  { key: "week", labelKey: "filterWeek", days: 7 },
  { key: "month", labelKey: "filterMonth", days: 30 },
  { key: "year", labelKey: "filterYear", days: 365 },
  { key: "all", labelKey: "filterAllTime", days: 3650 },
];

// PROGRESSIVE DISCLOSURE — CHUQUR TAHLIL SAHIFASI.
//
// P&L Monitoring'dagi "Sof Foyda" kartasi bosilganda shu yerga
// yo'naltiriladi. Bu sahifa — kunlik daromad/foyda grafigi va
// statistik tahlilga bag'ishlangan, asosiy P&L sahifasini
// "og'irlashtirmasdan".
const ProfitDeepDive = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId } = useSession();
  const { isDark } = useTheme();
  const TIME_FILTERS = TIME_FILTER_DAYS.map((f) => ({ ...f, label: t(`pnl.${f.labelKey}`) }));
  const [activeFilter, setActiveFilter] = useState("month");
  // "Oy" filtiri uchun tanlangan aniq oy (0 = joriy oy) - 2026-09
  // punkt-royxati, 1-band.
  const [selectedMonthsAgo, setSelectedMonthsAgo] = useState(0);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const handleFilterClick = (key) => {
    setActiveFilter(key);
    if (key === "month") setShowMonthPicker(true);
  };

  // Ma'lumotlar server tomonida oldindan hisoblangan kunlik yig'ma
  // yozuvlardan o'qiladi (cheklangan sondagi so'nggi buyurtmani
  // qaytaruvchi hook'lardan farqli o'laroq, bu katta buyurtma tarixiga
  // ega do'konlarda ham "Barcha vaqt" kabi uzoq davrlar uchun to'g'ri
  // natija beradi) — eng uzoq mumkin bo'lgan oyna (3650 kun) bir marta
  // so'raladi, filtr almashtirilganda esa faqat client tomonda (kichik,
  // allaqachon yuklangan ro'yxat ustida) qayta filtrlanadi.
  //
  // `Date.now()` render vaqtida to'g'ridan-to'g'ri chaqirilmaydi (React
  // Compiler'ning "impure" qoidasiga zid bo'lardi) — `useState`ning
  // dangasa (lazy) boshlang'ich qiymati orqali bir marta olinadi.
  const [mountedAtMs] = useState(() => Date.now());
  const sinceMs = useMemo(() => mountedAtMs - 3650 * 24 * 60 * 60 * 1000, [mountedAtMs]);
  const { days: rollupDays, loading: isLoading } = useOrderRollups(sellerId, sinceMs);

  const activeDays = TIME_FILTERS.find((f) => f.key === activeFilter)?.days || 30;
  const monthRange = useMemo(() => getCalendarMonthRange(selectedMonthsAgo), [selectedMonthsAgo]);

  const series = useMemo(() => {
    // "Oy" filtiri — OLDIN trailing-30-kun edi (2026-09 punkt-royxati,
    // 1-band bo'yicha xato deb topilgan). Endi HAQIQIY kalendar oyi,
    // oy-tanlash paneli orqali tanlangan (`selectedMonthsAgo`).
    if (activeFilter === "month") {
      const rangeEnd = selectedMonthsAgo === 0 ? Math.min(monthRange.end, mountedAtMs) : monthRange.end;
      return buildDailyProfitSeriesFromRollups(rollupDays, monthRange.start, rangeEnd);
    }
    const rangeStart = mountedAtMs - activeDays * 24 * 60 * 60 * 1000;
    return buildDailyProfitSeriesFromRollups(rollupDays, rangeStart, mountedAtMs);
  }, [rollupDays, activeFilter, activeDays, monthRange, selectedMonthsAgo, mountedAtMs]);

  const insights = useMemo(() => computeSeriesInsights(series), [series]);

  const chartData = useMemo(
    () => series.map((d) => ({
      ...d,
      label: new Date(d.date).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" }),
    })),
    [series]
  );

  const handleExport = () => {
    const rows = [
      [t("pnl.csvDate"), t("pnl.csvRevenueCol"), t("pnl.csvProfitCol")],
      ...series.map((d) => [d.date, d.revenue, d.profit]),
    ];
    exportToCsv(`foyda-tahlili-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

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
          <h1 className="text-sm font-black text-slate-800 dark:text-white truncate">{t("pnl.pageTitle")}</h1>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={series.length === 0}
          className="shrink-0 w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40"
          aria-label={t("pnl.exportAria")}
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

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">{t("pnl.loading")}</div>
          ) : chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 text-center px-6">
              {t("pnl.noOrdersInPeriod")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 5, right: 8, left: -4, bottom: 18 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#f1f5f9"} vertical={false} />
                <XAxis
                  dataKey="label"
                  // Recharts'ning ichki SVG matn elementlariga tashqi
                  // `className` orqali berilgan uslub har doim to'g'ri
                  // qo'llanmaydi (tanilgan cheklov), natijada matn xira
                  // yoki amalda ko'rinmas bo'lib qolishi mumkin — shuning
                  // uchun mavzuga qarab tanlangan aniq HEX rang
                  // ishlatiladi.
                  tick={{ fontSize: 10, fill: isDark ? "#64748b" : "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  interval={Math.max(0, Math.ceil(chartData.length / 7) - 1)}
                  label={{ value: t("pnl.xAxisLabel"), position: "insideBottom", offset: -10, fontSize: 10, fill: isDark ? "#64748b" : "#94a3b8" }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: isDark ? "#64748b" : "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  width={68}
                  // Nol qiymat uchun "k" qo'shimchasi ma'nosiz bo'lgani
                  // uchun shunchaki "0" qaytariladi.
                  tickFormatter={(v) => {
                    if (v === 0) return "0";
                    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}mln`;
                    return `${Math.round(v / 1000)}k`;
                  }}
                  label={{ value: t("pnl.yAxisLabel"), angle: -90, position: "insideLeft", offset: 10, fontSize: 10, fill: isDark ? "#64748b" : "#94a3b8" }}
                />
                <Tooltip
                  formatter={(value, name) => [money(value), name === "revenue" ? t("pnl.tooltipRevenue") : t("pnl.tooltipProfit")]}
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12, fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#revenueGradient)" />
                <Area type="monotone" dataKey="profit" stroke="#6366f1" strokeWidth={2} fill="url(#profitGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          )}

          <div className="flex items-center gap-4 justify-center mt-2">
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> {t("pnl.legendRevenue")}
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> {t("pnl.legendProfit")}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-xl">
            <Trophy size={14} className="text-amber-500 mb-1.5" />
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("pnl.peakDayLabel")}</p>
            <p className="text-xs font-black text-slate-800 dark:text-white mt-0.5 truncate">
              {insights.peakDay ? new Date(insights.peakDay.date).toLocaleDateString("uz-UZ", { day: "2-digit", month: "short" }) : "—"}
            </p>
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
              {insights.peakDay ? money(insights.peakDay.revenue) : ""}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-xl">
            <Wallet size={14} className="text-indigo-500 mb-1.5" />
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("pnl.avgDailyLabel")}</p>
            <p className="text-xs font-black text-slate-800 dark:text-white mt-0.5 truncate">{money(insights.averageDailyProfit)}</p>
            <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{t("pnl.profitPerDay")}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-xl">
            {insights.trendPercent !== null && insights.trendPercent < 0
              ? <TrendingDown size={14} className="text-rose-500 mb-1.5" />
              : <TrendingUp size={14} className="text-emerald-500 mb-1.5" />}
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("pnl.trendLabel")}</p>
            <p className={`text-xs font-black mt-0.5 ${insights.trendPercent === null ? "text-slate-400 dark:text-slate-500" : insights.trendPercent < 0 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"}`}>
              {insights.trendPercent === null ? "—" : `${insights.trendPercent >= 0 ? "+" : ""}${insights.trendPercent}%`}
            </p>
            <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{t("pnl.duringPeriod")}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfitDeepDive;
