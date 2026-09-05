import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ArrowUpRight, ArrowDownRight, Download, Trash2,
  TrendingUp, Percent, Target, ChevronRight, UserPlus,
} from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useOrderRollups } from "@/hooks/seller/useOrderRollups";
import { useExpenses } from "@/hooks/seller/useExpenses";
import useCrmOrders from "@/hooks/seller/useCrmOrders";
import { getRangeStart, getCalendarMonthRange } from "@/utils/dateRange";
import { computeCac } from "@/utils/cac";
import TimeframeTabs from "../dashboard/TimeframeTabs";
import AddExpenseForm from "./AddExpenseForm";
import { exportToCsv } from "@/utils/csvExport";
import StatusModal from "@/components/ui/StatusModal";
import MonthPickerSheet from "@/components/ui/MonthPickerSheet";
import { useLanguage } from "@/context/LanguageContext";

const TAX_RATE = 0.04; // 4% aylanma solig'i

const money = (n) => `${Math.round(n).toLocaleString()} so'm`;

// Real vaqtda P&L (foyda va zarar) monitoring paneli.
//
// "Umumiy Tushum" va "COGS" — ikkalasi ham haqiqiy ma'lumotdan
// (Firestore'dagi yetkazilgan buyurtmalar va mahsulotlarning haqiqiy
// tannarxi) hisoblanadi. "OPEX" (kuryer haqi, qadoqlash) va "Marketing"
// xarajatlari esa ilovada avtomatik kuzatilmaydi (masalan yetkazib
// berish narxlari tizimi hali qurilmagan), shuning uchun bular sotuvchi
// tomonidan qo'lda kiritiladi — mavjud bo'lmagan ma'lumotni taxmin
// qilishdan ko'ra, buni sotuvchining o'ziga topshirish to'g'riroq
// yondashuv.
//
// Barcha ko'rsatkichlar (Sof foyda, Margin, ROI) asosiy Dashboard'dagi
// bilan bir xil Bugun/Hafta/Oy davr tanlovi bo'yicha hisoblanadi;
// xarajatlar ham shu davrga mos ravishda filtrlanadi.
const PnLDashboard = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId, store } = useSession();

  // KPI ma'lumotlari server tomonida oldindan hisoblangan kunlik yig'ma
  // yozuvlardan (`useOrderRollups`) o'qiladi. `useFilterOrders` kabi,
  // cheklangan sondagi (masalan 150 ta) so'nggi buyurtmani qaytaruvchi
  // hook'lardan farqli o'laroq, bu yondashuv katta buyurtma tarixiga ega
  // do'konlarda ham tanlangan davr uchun daromad/foyda ko'rsatkichini
  // to'g'ri hisoblaydi, hamda mahsulot tannarxini alohida yuklab
  // brauzerda birlashtirish shart emas — tannarx allaqachon serverda
  // hisoblangan (`functions/orderRollups.js`).
  //
  // `Date.now()` render vaqtida to'g'ridan-to'g'ri chaqirilmaydi (React
  // Compiler'ning "impure" qoidasiga zid bo'lardi) — `useState`ning
  // dangasa (lazy) boshlang'ich qiymati orqali bir marta olinadi.
  const [mountedAtMs] = useState(() => Date.now());
  // MUHIM TUZATISH: OLDIN 30 kun edi - shu sabab "Oy" davri (eski,
  // xato trailing-30-kun mantig'ida) HAM to'liq qamrab olinmasdi.
  // Endi 370 kun - oy-tanlash paneli orqali 12 oy orqaga borish
  // mumkin (`MonthPickerSheet.jsx`).
  const sinceMs = useMemo(() => mountedAtMs - 370 * 24 * 60 * 60 * 1000, [mountedAtMs]);
  const { days: rollupDays } = useOrderRollups(sellerId, sinceMs);
  const { expenses, loading: expensesLoading, create: createExpense, remove: removeExpense } = useExpenses(sellerId);
  // CAC (mijoz jalb qilish narxi) uchun - mijozlarning `firstOrderAtMs`
  // maydoni shu yerdan olinadi (batafsil izoh: `src/utils/cac.js`).
  const { customers: crmCustomers } = useCrmOrders(sellerId);

  const [timeframe, setTimeframe] = useState("Oy");
  // "Oy" tabi uchun tanlangan oy (0 = joriy oy) - 2026-09
  // punkt-royxati, 1-band: "Oy" filtiri bosilganda oy-tanlash paneli
  // ochiladi, tanlangan oy ma'lumotlari ko'rsatiladi.
  const [selectedMonthsAgo, setSelectedMonthsAgo] = useState(0);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const handleTimeframeChange = useCallback((tf) => {
    setTimeframe(tf);
    if (tf === "Oy") setShowMonthPicker(true);
  }, []);
  const [addingExpense, setAddingExpense] = useState(false);
  const [error, setError] = useState(null);

  // "Oy" uchun — HAQIQIY kalendar oyi chegaralari (tanlangan oyga
  // qarab); "Bugun"/"Hafta" uchun — eski trailing-window mantiq.
  const isMonthMode = timeframe === "Oy";
  const monthRange = useMemo(() => getCalendarMonthRange(selectedMonthsAgo), [selectedMonthsAgo]);
  const rangeStart = useMemo(
    () => (isMonthMode ? monthRange.start : getRangeStart(timeframe)),
    [isMonthMode, monthRange, timeframe]
  );
  const rangeEnd = isMonthMode ? monthRange.end : Infinity;

  const periodDays = useMemo(
    () => rollupDays.filter((d) => d.dateMs >= rangeStart && d.dateMs < rangeEnd),
    [rollupDays, rangeStart, rangeEnd]
  );

  const periodExpenses = useMemo(
    () => expenses.filter((e) => {
      const ms = Number(e.createdAtMs) || 0;
      return ms >= rangeStart && ms < rangeEnd;
    }),
    [expenses, rangeStart, rangeEnd]
  );

  const totalRevenue = useMemo(
    () => periodDays.reduce((sum, d) => sum + (Number(d.revenue) || 0), 0),
    [periodDays]
  );

  const totalCOGS = useMemo(
    () => periodDays.reduce((sum, d) => sum + (Number(d.cogs) || 0), 0),
    [periodDays]
  );

  const totalOpex = useMemo(
    () => periodExpenses.filter((e) => e.category === "opex").reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [periodExpenses]
  );
  const totalMarketing = useMemo(
    () => periodExpenses.filter((e) => e.category === "marketing").reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [periodExpenses]
  );

  const taxes = totalRevenue * TAX_RATE;
  const netProfit = totalRevenue - totalCOGS - totalOpex - totalMarketing - taxes;
  const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const investedBase = totalCOGS + totalMarketing;
  const roi = investedBase > 0 ? (netProfit / investedBase) * 100 : 0;

  // CAC (mijoz jalb qilish narxi) - shu davrda kiritilgan marketing
  // xarajati va HAQIQIY yangi mijozlar soniga asoslanadi (batafsil
  // izoh: `src/utils/cac.js`). Faqat marketing xarajati kiritilgan
  // davrlarda mazmunli - aks holda 0 ko'rsatiladi (haqiqiy natija).
  const { newCustomersCount, cac } = useMemo(
    () => computeCac(crmCustomers, rangeStart, rangeEnd, totalMarketing),
    [crmCustomers, rangeStart, rangeEnd, totalMarketing]
  );

  const handleAddExpense = useCallback(
    async (data) => {
      setAddingExpense(true);
      try {
        await createExpense(data);
      } finally {
        setAddingExpense(false);
      }
    },
    [createExpense]
  );

  const handleDeleteExpense = useCallback(
    async (id) => {
      try {
        await removeExpense(id);
      } catch (err) {
        setError(err.message);
      }
    },
    [removeExpense]
  );

  const handleExport = useCallback(() => {
    const rows = [
      [t("pnl.csvReportTitle"), store?.storeName || "", `${t("pnl.csvPeriod")} ${timeframe}`, new Date().toLocaleDateString("uz-UZ")],
      [],
      [t("pnl.csvMetric"), t("pnl.csvAmountCol")],
      [t("pnl.csvRevenue"), Math.round(totalRevenue)],
      [t("pnl.csvCogs"), -Math.round(totalCOGS)],
      [t("pnl.csvOpex"), -Math.round(totalOpex)],
      [t("pnl.csvMarketing"), -Math.round(totalMarketing)],
      [`${t("pnl.csvTax")} (${TAX_RATE * 100}%)`, -Math.round(taxes)],
      [t("pnl.csvNetProfit"), Math.round(netProfit)],
      [t("pnl.csvMarginPct"), margin.toFixed(1)],
      [t("pnl.csvRoiPct"), roi.toFixed(1)],
      [],
      [t("pnl.csvExpenseDetail")],
      [t("pnl.csvExpenseName"), t("pnl.csvExpenseType"), t("pnl.csvExpenseAmount")],
      ...periodExpenses.map((e) => [e.name, e.category === "marketing" ? t("pnl.marketingOption") : t("pnl.opexOption"), e.amount]),
    ];
    exportToCsv(`pnl-hisobot-${timeframe}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }, [store, timeframe, totalRevenue, totalCOGS, totalOpex, totalMarketing, taxes, netProfit, margin, roi, periodExpenses]);

  const flowSteps = [
    { label: t("pnl.revenue"), value: totalRevenue, sign: "" },
    { label: t("pnl.cogs"), value: totalCOGS, sign: "-" },
    { label: t("pnl.opex"), value: totalOpex, sign: "-" },
    { label: t("pnl.marketing"), value: totalMarketing, sign: "-" },
    { label: `${t("pnl.tax")} (${TAX_RATE * 100}%)`, value: taxes, sign: "-" },
  ];

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-36 transition-colors duration-300">

      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-black text-slate-800 dark:text-white">{t("pnl.title")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("pnl.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center"
          title={t("pnl.exportCsvTitle")}
        >
          <Download size={16} />
        </button>
      </div>

      <div className="px-4 pt-4">
        <TimeframeTabs timeframe={timeframe} onChange={handleTimeframeChange} />
        {isMonthMode && selectedMonthsAgo > 0 && (
          <button
            type="button"
            onClick={() => setShowMonthPicker(true)}
            className="mt-1.5 text-[10px] font-bold text-indigo-500 dark:text-indigo-400 underline underline-offset-2"
          >
            {t("common.monthNamesShort")[monthRange.month]} {monthRange.year}
          </button>
        )}
        {showMonthPicker && (
          <MonthPickerSheet
            selectedMonthsAgo={selectedMonthsAgo}
            onSelect={setSelectedMonthsAgo}
            onClose={() => setShowMonthPicker(false)}
          />
        )}
      </div>

      <div className="p-4 space-y-4">

        <div
          onClick={() => navigate("/seller/analytics/profit-deep-dive")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && navigate("/seller/analytics/profit-deep-dive")}
          className={`rounded-[28px] p-5 text-white shadow-lg relative overflow-hidden cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-transform ${netProfit >= 0 ? "bg-gradient-to-br from-emerald-600 to-emerald-700 shadow-emerald-600/20" : "bg-gradient-to-br from-rose-600 to-rose-700 shadow-rose-600/20"}`}
        >
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider">{t("pnl.netProfitLabel")} ({timeframe})</span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-white/70">
              {t("pnl.deepDiveLink")} <ChevronRight size={13} />
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <h2 className="text-3xl font-black tracking-tight">{money(netProfit)}</h2>
            {netProfit >= 0 ? <ArrowUpRight size={22} /> : <ArrowDownRight size={22} />}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-white/15 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 text-white/80">
                <Percent size={12} />
                <span className="text-[10px] font-bold uppercase">{t("pnl.marginLabel")}</span>
              </div>
              <p className="text-lg font-black mt-1">{margin.toFixed(1)}%</p>
            </div>
            <div className="bg-white/15 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 text-white/80">
                <Target size={12} />
                <span className="text-[10px] font-bold uppercase">{t("pnl.roiLabel")}</span>
              </div>
              <p className="text-lg font-black mt-1">{roi.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-2.5">
          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
            <TrendingUp size={13} />
            <h3 className="text-xs font-black uppercase tracking-wider">{t("pnl.flowTitle")}</h3>
          </div>
          {flowSteps.map((step) => (
            <div key={step.label} className="flex items-center justify-between py-1.5 border-b border-dashed border-slate-100 dark:border-slate-800 last:border-0">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{step.label}</span>
              <span className={`text-sm font-black ${step.sign === "-" ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                {step.sign}{money(step.value)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
            <span className="text-xs font-black text-slate-800 dark:text-white">{t("pnl.equalsNetProfit")}</span>
            <span className={`text-sm font-black ${netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>
              {money(netProfit)}
            </span>
          </div>
        </div>

        {/* CAC (mijoz jalb qilish narxi) — 2026-09 punkt-royxati, 3-band.
            Marketing xarajati kiritilmagan yoki shu davrda yangi mijoz
            bo'lmagan holatda mazmunsiz raqam (masalan cheksizlik yoki
            0/0) ko'rsatilmasligi uchun, `cac === null` bo'lganda oddiy
            "yetarli ma'lumot yo'q" holati ko'rsatiladi - soxta raqam
            hech qachon chizilmaydi. */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 mb-2.5">
            <Target size={13} />
            <h3 className="text-xs font-black uppercase tracking-wider">{t("pnl.cacTitle")}</h3>
          </div>
          {cac !== null ? (
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-black text-slate-800 dark:text-white">{money(cac)}</p>
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">{t("pnl.cacPerCustomer")}</p>
              </div>
              <div className="flex items-center gap-1.5 text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl px-2.5 py-1.5">
                <UserPlus size={13} />
                <span className="text-xs font-black">{newCustomersCount}</span>
                <span className="text-[10px] font-semibold">{t("pnl.cacNewCustomersSuffix")}</span>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
              {totalMarketing > 0 ? t("pnl.cacNoNewCustomers") : t("pnl.cacNoMarketingSpend")}
            </p>
          )}
        </div>

        <AddExpenseForm onSubmit={handleAddExpense} busy={addingExpense} />

        {!expensesLoading && periodExpenses.length > 0 && (
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-2">
            <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("pnl.enteredExpenses", { period: timeframe })}</h3>
            {periodExpenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between bg-[#F4F5F9] dark:bg-slate-800 rounded-xl px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{expense.name}</p>
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md ${expense.category === "marketing" ? "bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400" : "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400"}`}>
                    {expense.category === "marketing" ? t("pnl.marketingOption") : t("pnl.opexOption")}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-black text-rose-500">-{money(expense.amount)}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteExpense(expense.id)}
                    className="w-7 h-7 rounded-lg bg-white dark:bg-slate-900 text-rose-500 flex items-center justify-center"
                    aria-label={t("pnl.deleteAria")}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <StatusModal variant="error" title={t("pnl.errorTitle")} message={error} onClose={() => setError(null)} />
      )}
    </div>
  );
};

export default PnLDashboard;
