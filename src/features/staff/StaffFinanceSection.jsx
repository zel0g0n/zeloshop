import { useMemo, useState } from "react";
import { ArrowUpRight, ArrowDownRight, TrendingUp, Percent, Wallet, Loader2 } from "lucide-react";
import { useStaffSession } from "@/context/StaffSessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { useOrderRollups } from "@/hooks/seller/useOrderRollups";
import { useExpenses } from "@/hooks/seller/useExpenses";
import TimeframeTabs from "@/features/seller/components/dashboard/TimeframeTabs";
import { getRangeStart, getCalendarMonthRange } from "@/utils/dateRange";

const TAX_RATE = 0.04; // 4% aylanma solig'i — `PnLDashboard.jsx` bilan BIR XIL.
const money = (n) => `${Math.round(n).toLocaleString()} so'm`;

/**
 * Xodim Mini App'i — "Moliya" bo'limi. Faqat `permissions.viewFinance`
 * ruxsatiga ega xodimga ko'rsatiladi (masalan "Buxgalter"/"Menejer"
 * roli, 2026-09 punkt-royxati, 2-band "Advanced Team & RBAC").
 *
 * `src/features/seller/components/finance/PnLDashboard.jsx`ning
 * ATAYLAB QAT'IY FAQAT-O'QISH versiyasi — bir xil HAQIQIY manbalardan
 * (`useOrderRollups`/`useExpenses`, ikkalasi ham server tomonida
 * oldindan hisoblangan yig'ma yozuvlar) foydalanadi va bir xil P&L
 * formulasi bilan hisoblaydi, LEKIN: (1) xarajat qo'shish/o'chirish
 * FORMASI YO'Q — `firestore.rules`dagi `expenses` YOZISH qoidasi
 * FAQAT haqiqiy do'kon egasiga ochiq (xodim — hatto `viewFinance`ga
 * ega bo'lsa ham — hech qachon xarajat qo'sha/o'chira olmaydi, bu
 * ATAYLAB, "faqat ko'rish" talabiga mos); (2) CSV eksport/"chuqur
 * tahlil" havolasi/CAC bloki YO'Q — bular ro'yxatdagi ANIQ talabdan
 * (daromad/tannarx/sof foyda/xarajatlar xulosasi) tashqarida, ortiqcha
 * murakkablik qo'shmaslik uchun ataylab qoldirilgan.
 */
const StaffFinanceSection = () => {
  const { t } = useLanguage();
  const { sellerId } = useStaffSession();

  const [mountedAtMs] = useState(() => Date.now());
  const sinceMs = useMemo(() => mountedAtMs - 370 * 24 * 60 * 60 * 1000, [mountedAtMs]);
  const { days: rollupDays, loading: rollupsLoading } = useOrderRollups(sellerId, sinceMs);
  const { expenses, loading: expensesLoading } = useExpenses(sellerId);

  const [timeframe, setTimeframe] = useState("Oy");
  const isMonthMode = timeframe === "Oy";
  const monthRange = useMemo(() => getCalendarMonthRange(0), []);
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

  const totalRevenue = useMemo(() => periodDays.reduce((sum, d) => sum + (Number(d.revenue) || 0), 0), [periodDays]);
  const totalCOGS = useMemo(() => periodDays.reduce((sum, d) => sum + (Number(d.cogs) || 0), 0), [periodDays]);
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

  const flowSteps = [
    { label: t("pnl.revenue"), value: totalRevenue, sign: "" },
    { label: t("pnl.cogs"), value: totalCOGS, sign: "-" },
    { label: t("pnl.opex"), value: totalOpex, sign: "-" },
    { label: t("pnl.marketing"), value: totalMarketing, sign: "-" },
    { label: `${t("pnl.tax")} (${TAX_RATE * 100}%)`, value: taxes, sign: "-" },
  ];

  const loading = rollupsLoading || expensesLoading;

  return (
    <div className="p-4 space-y-4 pb-24">
      <TimeframeTabs timeframe={timeframe} onChange={setTimeframe} />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-indigo-500" />
        </div>
      ) : (
        <>
          <div className={`rounded-[28px] p-5 text-white shadow-lg relative overflow-hidden ${netProfit >= 0 ? "bg-gradient-to-br from-emerald-600 to-emerald-700 shadow-emerald-600/20" : "bg-gradient-to-br from-rose-600 to-rose-700 shadow-rose-600/20"}`}>
            <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider">{t("pnl.netProfitLabel")} ({timeframe})</span>
            <div className="flex items-center gap-2 mt-1">
              <h2 className="text-3xl font-black tracking-tight">{money(netProfit)}</h2>
              {netProfit >= 0 ? <ArrowUpRight size={22} /> : <ArrowDownRight size={22} />}
            </div>
            <div className="mt-4 bg-white/15 rounded-2xl p-3 inline-flex items-center gap-1.5">
              <Percent size={12} />
              <span className="text-[10px] font-bold uppercase">{t("pnl.marginLabel")}</span>
              <span className="text-sm font-black ml-1">{margin.toFixed(1)}%</span>
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

          {periodExpenses.length > 0 && (
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-2">
              <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                <Wallet size={13} />
                <h3 className="text-xs font-black uppercase tracking-wider">{t("pnl.enteredExpenses", { period: timeframe })}</h3>
              </div>
              {periodExpenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between bg-[#F4F5F9] dark:bg-slate-800 rounded-xl px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{expense.name}</p>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md ${expense.category === "marketing" ? "bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400" : "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400"}`}>
                      {expense.category === "marketing" ? t("pnl.marketingOption") : t("pnl.opexOption")}
                    </span>
                  </div>
                  <span className="text-xs font-black text-rose-500 shrink-0">-{money(expense.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StaffFinanceSection;
