import { useState } from "react";
import { ChevronDown, ChevronUp, Wallet, Plus, Loader2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import CustomSelect from "@/components/ui/CustomSelect";

// MUHIM: Tailwind JIT dinamik shablon satrlarni (masalan
// `text-${accent}-600`) "ko'ra olmaydi" — shuning uchun loyihaning
// o'rnatilgan qoidasiga ko'ra rang klasslari LOOKUP-OBYEKT orqali
// beriladi, hech qachon template-literal orqali emas.
const ACCENT_CLASSES = {
  indigo: {
    text: "text-indigo-600 dark:text-indigo-400",
    ring: "focus:ring-indigo-500",
    solidBtn: "bg-indigo-600 hover:bg-indigo-700",
  },
  teal: {
    text: "text-teal-600 dark:text-teal-400",
    ring: "focus:ring-teal-500",
    solidBtn: "bg-teal-600 hover:bg-teal-700",
  },
};

const buildStatRows = (type, stats, t) => {
  if (type === "courier") {
    return [
      { key: "delivered", label: t("personPerformance.statLabelDelivered"), value: stats?.deliveredCount || 0, tone: "text-emerald-600 dark:text-emerald-400" },
      { key: "active", label: t("personPerformance.statLabelActive"), value: stats?.activeCount || 0 },
      { key: "pending", label: t("personPerformance.statLabelPending"), value: stats?.pendingCount || 0 },
      { key: "failed", label: t("personPerformance.statLabelFailed"), value: stats?.failedCount || 0, tone: (stats?.failedCount || 0) > 0 ? "text-rose-500" : undefined },
    ];
  }
  return [
    { key: "handled", label: t("personPerformance.statLabelHandled"), value: stats?.handledCount || 0 },
    { key: "delivered", label: t("personPerformance.statLabelDelivered"), value: stats?.deliveredCount || 0, tone: "text-emerald-600 dark:text-emerald-400" },
    { key: "cancelled", label: t("personPerformance.statLabelCancelled"), value: stats?.cancelledCount || 0, tone: (stats?.cancelledCount || 0) > 0 ? "text-rose-500" : undefined },
  ];
};

/**
 * Xodim/kuryer kartochkasi ichida ochiladigan "batafsil statistika"
 * paneli — `StaffManagementPage.jsx` VA `CourierManagementPage.jsx`
 * ikkalasida ham ishlatiladi (2026-09 punkt-royxati: "hodimlar va
 * kuryerlarni nazorat qilish — analitika, qilingan ishlar,
 * harajatlar"). Ikkala sahifada naqsh bir xil, faqat: (1) ranglar
 * (sotuvchi UI'da xodimlar — indigo, kuryerlar — teal), (2) ish
 * faoliyati statistikasining maydonlari farq qiladi (`type` orqali).
 *
 * Xarajatlar qismi — HAQIQIY, allaqachon mavjud `sellers/{id}/expenses`
 * kolleksiyasidan (`useExpenses` hook, P&L Dashboard bilan bir xil
 * manba) — endi `linkedStaffId`/`linkedCourierId` bilan MA'LUM BIR
 * shaxsga bog'langan xarajatlarni ko'rsatadi va shu shaxsga yangi
 * xarajat qo'shish imkonini beradi (masalan "shu kuryerga to'langan
 * yoqilg'i puli").
 */
const PersonPerformancePanel = ({ type, accent = "indigo", stats, expenses, onAddExpense }) => {
  const { t } = useLanguage();
  const classes = ACCENT_CLASSES[accent] || ACCENT_CLASSES.indigo;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("opex");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const statRows = buildStatRows(type, stats, t);
  const totalExpense = (expenses || []).reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim() || !amount || Number(amount) <= 0) {
      setFormError(t("personPerformance.expenseFormError"));
      return;
    }
    setSubmitting(true);
    try {
      await onAddExpense({ name, amount, category });
      setName("");
      setAmount("");
    } catch (err) {
      setFormError(err.message || t("personPerformance.expenseFormError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pl-11.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 text-[10px] font-black ${classes.text}`}
      >
        {t("personPerformance.detailsToggle")} {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div className="mt-2 space-y-2.5 bg-[#F4F5F9] dark:bg-slate-950 rounded-xl p-2.5">
          <div className="grid grid-cols-3 gap-1.5">
            {statRows.map((row) => (
              <div key={row.key} className="bg-white dark:bg-slate-900 rounded-lg px-2 py-1.5">
                <p className="text-[8.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">{row.label}</p>
                <p className={`text-sm font-black ${row.tone || "text-slate-800 dark:text-white"}`}>{row.value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Wallet size={11} /> {t("personPerformance.expensesTitle")}
              </p>
              {totalExpense > 0 && (
                <p className="text-[11px] font-black text-rose-500">{totalExpense.toLocaleString()} so'm</p>
              )}
            </div>

            {(expenses || []).length === 0 ? (
              <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("personPerformance.expensesEmpty")}</p>
            ) : (
              <div className="space-y-1">
                {expenses.map((exp) => (
                  <div key={exp.id} className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-lg px-2 py-1.5">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate">{exp.name}</span>
                    <span className="text-[11px] font-black text-slate-800 dark:text-white shrink-0 ml-2">{(Number(exp.amount) || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleAddExpense} className="grid grid-cols-2 gap-1.5">
            <input
              type="text"
              disabled={submitting}
              placeholder={t("personPerformance.expenseNamePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`col-span-2 h-9 px-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg text-[11px] font-semibold focus:outline-none focus:ring-1 ${classes.ring} disabled:opacity-60`}
            />
            <input
              type="number"
              disabled={submitting}
              placeholder={t("personPerformance.expenseAmountPlaceholder")}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`h-9 px-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg text-[11px] font-semibold focus:outline-none focus:ring-1 ${classes.ring} disabled:opacity-60`}
            />
            <CustomSelect
              disabled={submitting}
              value={category}
              onChange={setCategory}
              options={[
                { value: "opex", label: t("pnl.opexOption") },
                { value: "marketing", label: t("pnl.marketingOption") },
              ]}
            />
            {formError && <p className="col-span-2 text-[10px] text-rose-500 font-semibold">{formError}</p>}
            <button
              type="submit"
              disabled={submitting}
              className={`col-span-2 h-9 ${classes.solidBtn} text-white font-bold text-[11px] rounded-lg flex items-center justify-center gap-1 disabled:opacity-60`}
            >
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              {t("personPerformance.addExpenseButton")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default PersonPerformancePanel;
