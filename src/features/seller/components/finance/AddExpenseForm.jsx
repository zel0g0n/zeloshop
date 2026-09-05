import { useState } from "react";
import { Plus } from "lucide-react";
import CustomSelect from "@/components/ui/CustomSelect";
import { useLanguage } from "@/context/LanguageContext";

const AddExpenseForm = ({ onSubmit, busy }) => {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("opex");
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !amount || Number(amount) <= 0) {
      setError(t("pnl.nameAmountError"));
      return;
    }
    try {
      await onSubmit({ name, amount, category });
      setName("");
      setAmount("");
    } catch (err) {
      setError(err.message || t("pnl.genericError"));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
      <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("pnl.addExpenseTitle")}</h3>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          disabled={busy}
          placeholder={t("pnl.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="col-span-2 h-10 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
        />
        <input
          type="number"
          disabled={busy}
          placeholder={t("pnl.amountPlaceholder")}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-10 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
        />
        <CustomSelect
          disabled={busy}
          value={category}
          onChange={setCategory}
          options={[
            { value: "opex", label: t("pnl.opexOption") },
            { value: "marketing", label: t("pnl.marketingOption") },
          ]}
        />
      </div>

      {error && <p className="text-[11px] text-rose-500 font-semibold">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-60"
      >
        <Plus size={14} /> {t("pnl.addToBalance")}
      </button>
    </form>
  );
};

export default AddExpenseForm;
