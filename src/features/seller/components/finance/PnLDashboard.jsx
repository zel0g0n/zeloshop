import React, { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ArrowUpRight, ArrowDownRight, Download, Trash2,
  TrendingUp, Percent, Target,
} from "lucide-react";
import { useSession } from "@/context/SessionContext";
import useGetOrdersData from "@/hooks/seller/useFilterOrders";
import useGetProductsData from "@/hooks/seller/useGetSellerProducts";
import { useExpenses } from "@/hooks/seller/useExpenses";
import { getRangeStart } from "@/utils/dateRange";
import TimeframeTabs from "../dashboard/TimeframeTabs";
import AddExpenseForm from "./AddExpenseForm";
import { exportToCsv } from "@/utils/csvExport";
import StatusModal from "@/components/ui/StatusModal";

const TAX_RATE = 0.04; // 4% aylanma solig'i

const money = (n) => `${Math.round(n).toLocaleString()} so'm`;

// PRODUCTION-LEVEL LIVE P&L (PROFIT & LOSS) MONITORING DASHBOARD
//
// MUHIM, HALOL IZOH: "Umumiy Tushum" va "COGS" — bularning ikkalasi
// ham HAQIQIY ma'lumotdan (Firestore'dagi yetkazilgan buyurtmalar va
// mahsulotlarning haqiqiy tannarxi) hisoblanadi. Lekin "OPEX" (kuryer
// haqi, qadoqlash) va "Marketing" xarajatlari — ilovada HECH QAYERDA
// avtomatik kuzatilmaydi (masalan yetkazib berish narxlari tizimi
// hali qurilmagan). Shuning uchun bular sotuvchi tomonidan QO'LDA
// kiritiladi — bu soxta emas, aksincha eng to'g'ri yondashuv: mavjud
// bo'lmagan ma'lumotni o'ylab topish o'rniga, buni sotuvchining o'ziga
// topshiramiz.
//
// OLDIN: bu sahifada davr tanlash umuman yo'q edi — barcha
// ko'rsatkichlar (Sof foyda, Margin, ROI) HAR DOIM butun tarix
// bo'yicha (all-time) hisoblanardi, garchi sahifa "LIVE" deb
// nomlangan bo'lsa ham. Endi asosiy Dashboard'dagi bilan bir xil
// Bugun/Hafta/Oy tanlovi qo'shildi — xarajatlar ham shu davrga
// mos ravishda filtrlanadi.
const PnLDashboard = () => {
  const navigate = useNavigate();
  const { sellerId, store } = useSession();
  const { orders = [] } = useGetOrdersData(sellerId);
  const { products = [] } = useGetProductsData(sellerId);
  const { expenses, loading: expensesLoading, create: createExpense, remove: removeExpense } = useExpenses(sellerId);

  const [timeframe, setTimeframe] = useState("Oy");
  const [addingExpense, setAddingExpense] = useState(false);
  const [error, setError] = useState(null);

  const costPriceMap = useMemo(() => {
    const map = new Map();
    products.forEach((p) => map.set(p.id, Number(p.costPrice) || 0));
    return map;
  }, [products]);

  const rangeStart = useMemo(() => getRangeStart(timeframe), [timeframe]);

  const deliveredOrders = useMemo(
    () => orders.filter((o) => o.status === "delivered" && (Number(o.createdAt) || 0) >= rangeStart),
    [orders, rangeStart]
  );

  const periodExpenses = useMemo(
    () => expenses.filter((e) => (Number(e.createdAtMs) || 0) >= rangeStart),
    [expenses, rangeStart]
  );

  const totalRevenue = useMemo(
    () => deliveredOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0),
    [deliveredOrders]
  );

  const totalCOGS = useMemo(() => {
    let cost = 0;
    deliveredOrders.forEach((order) => {
      (order.orders || []).forEach((item) => {
        cost += (costPriceMap.get(item.id) || 0) * (Number(item.quantity) || 0);
      });
    });
    return cost;
  }, [deliveredOrders, costPriceMap]);

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
      ["ZeloShop — P&L Hisoboti", store?.storeName || "", `Davr: ${timeframe}`, new Date().toLocaleDateString("uz-UZ")],
      [],
      ["Ko'rsatkich", "Summasi (so'm)"],
      ["Umumiy Tushum (Revenue)", Math.round(totalRevenue)],
      ["COGS (Tannarx)", -Math.round(totalCOGS)],
      ["OPEX (Operatsion xarajatlar)", -Math.round(totalOpex)],
      ["Marketing xarajatlari", -Math.round(totalMarketing)],
      [`Aylanma solig'i (${TAX_RATE * 100}%)`, -Math.round(taxes)],
      ["Sof Foyda (Net Profit)", Math.round(netProfit)],
      ["Rentabellik Margin (%)", margin.toFixed(1)],
      ["ROI (%)", roi.toFixed(1)],
      [],
      ["Xarajatlar tafsiloti (shu davr)"],
      ["Nomi", "Turi", "Summasi"],
      ...periodExpenses.map((e) => [e.name, e.category === "marketing" ? "Marketing" : "OPEX", e.amount]),
    ];
    exportToCsv(`pnl-hisobot-${timeframe}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }, [store, timeframe, totalRevenue, totalCOGS, totalOpex, totalMarketing, taxes, netProfit, margin, roi, periodExpenses]);

  const flowSteps = [
    { label: "Umumiy Tushum", value: totalRevenue, sign: "" },
    { label: "COGS (Tannarx)", value: totalCOGS, sign: "-" },
    { label: "OPEX", value: totalOpex, sign: "-" },
    { label: "Marketing", value: totalMarketing, sign: "-" },
    { label: `Soliq (${TAX_RATE * 100}%)`, value: taxes, sign: "-" },
  ];

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-32 transition-colors duration-300">

      <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-black text-slate-800 dark:text-white">Foyda-Zarar (P&L) monitoring</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Real-time moliyaviy yadro</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center"
          title="CSV yuklab olish"
        >
          <Download size={16} />
        </button>
      </div>

      <div className="px-4 pt-4">
        <TimeframeTabs timeframe={timeframe} onChange={setTimeframe} />
      </div>

      <div className="p-4 space-y-4">

        <div className={`rounded-[28px] p-5 text-white shadow-lg relative overflow-hidden ${netProfit >= 0 ? "bg-gradient-to-br from-emerald-600 to-emerald-700 shadow-emerald-600/20" : "bg-gradient-to-br from-rose-600 to-rose-700 shadow-rose-600/20"}`}>
          <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider">Sof Foyda ({timeframe})</span>
          <div className="flex items-center gap-2 mt-1">
            <h2 className="text-3xl font-black tracking-tight">{money(netProfit)}</h2>
            {netProfit >= 0 ? <ArrowUpRight size={22} /> : <ArrowDownRight size={22} />}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-white/15 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 text-white/80">
                <Percent size={12} />
                <span className="text-[10px] font-bold uppercase">Rentabellik</span>
              </div>
              <p className="text-lg font-black mt-1">{margin.toFixed(1)}%</p>
            </div>
            <div className="bg-white/15 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 text-white/80">
                <Target size={12} />
                <span className="text-[10px] font-bold uppercase">ROI</span>
              </div>
              <p className="text-lg font-black mt-1">{roi.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-2.5">
          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
            <TrendingUp size={13} />
            <h3 className="text-xs font-black uppercase tracking-wider">Moliyaviy oqim anatomiyasi</h3>
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
            <span className="text-xs font-black text-slate-800 dark:text-white">= Sof Foyda</span>
            <span className={`text-sm font-black ${netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>
              {money(netProfit)}
            </span>
          </div>
        </div>

        <AddExpenseForm onSubmit={handleAddExpense} busy={addingExpense} />

        {!expensesLoading && periodExpenses.length > 0 && (
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-2">
            <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kiritilgan xarajatlar ({timeframe})</h3>
            {periodExpenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between bg-[#F4F5F9] dark:bg-slate-800 rounded-xl px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{expense.name}</p>
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md ${expense.category === "marketing" ? "bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400" : "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400"}`}>
                    {expense.category === "marketing" ? "Marketing" : "OPEX"}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-black text-rose-500">-{money(expense.amount)}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteExpense(expense.id)}
                    className="w-7 h-7 rounded-lg bg-white dark:bg-slate-900 text-rose-500 flex items-center justify-center"
                    aria-label="O'chirish"
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
        <StatusModal variant="error" title="Xatolik yuz berdi" message={error} onClose={() => setError(null)} />
      )}
    </div>
  );
};

export default PnLDashboard;
