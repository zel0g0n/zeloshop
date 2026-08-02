import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/context/SessionContext";
import FullScreenSpinner from "@/components/ui/FullScreenSpinner";
import { usePaymentConfig } from "@/hooks/seller/usePaymentConfig";
import StatusModal from "@/components/ui/StatusModal";

// Sotuvchi bu yerda o'zining Click va/yoki Payme HISOB ma'lumotlarini
// kiritadi — pul to'g'ridan-to'g'ri shu hisobga tushadi (platforma
// pulni ushlab turmaydi). Bu ma'lumotlar `sellers/{id}/private/...`da,
// hech kimga (mijozlarga ham) ko'rinmaydigan joyda saqlanadi.
const PaymentSettingsPage = () => {
  const navigate = useNavigate();
  const { sellerId } = useSession();
  const { config, loading, saving, error, save } = usePaymentConfig(sellerId);

  const [clickServiceId, setClickServiceId] = useState("");
  const [clickSecretKey, setClickSecretKey] = useState("");
  const [clickEnabled, setClickEnabled] = useState(false);
  const [paymeMerchantId, setPaymeMerchantId] = useState("");
  const [paymeKey, setPaymeKey] = useState("");
  const [paymeEnabled, setPaymeEnabled] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);

  useEffect(() => {
    if (!config) return;
    setClickServiceId(config.clickServiceId || "");
    setClickSecretKey(config.clickSecretKey || "");
    setClickEnabled(Boolean(config.clickEnabled));
    setPaymeMerchantId(config.paymeMerchantId || "");
    setPaymeKey(config.paymeKey || "");
    setPaymeEnabled(Boolean(config.paymeEnabled));
  }, [config]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await save({
        clickServiceId, clickSecretKey, clickEnabled,
        paymeMerchantId, paymeKey, paymeEnabled,
      });
      setShowSavedModal(true);
    } catch {
      // xato allaqachon `error` orqali ko'rsatiladi
    }
  };

  if (loading) {
    return <FullScreenSpinner />;
  }

  return (
    <div className="bg-[#F4F5F9] dark:bg-slate-950 min-h-screen text-slate-900 dark:text-white pb-32 transition-colors duration-300">
      <div className="bg-white dark:bg-slate-900 px-5 py-4 sticky top-0 z-30 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">To'lov sozlamalari</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Click / Payme hisobingizni ulang</p>
        </div>
      </div>

      <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 mx-4 mt-4 rounded-2xl text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
        💡 Bu yerga kiritilgan ma'lumotlar (Secret Key) — sizdan
        boshqa hech kimga (mijozlarga ham) ko'rinmaydi. To'lovlar
        to'g'ridan-to'g'ri sizning Click/Payme hisobingizga tushadi.
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {error && (
          <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 p-3 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        {/* CLICK */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-black text-slate-800 dark:text-white">Click</label>
            <button
              type="button"
              onClick={() => setClickEnabled((v) => !v)}
              className={`w-11 h-6 rounded-full p-0.5 transition-colors ${clickEnabled ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`}
            >
              <span className={`w-5 h-5 rounded-full bg-white block transition-transform ${clickEnabled ? "translate-x-5" : ""}`} />
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Service ID</label>
            <input
              type="text"
              value={clickServiceId}
              onChange={(e) => setClickServiceId(e.target.value)}
              placeholder="Masalan: 12345"
              className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Secret Key</label>
            <input
              type="password"
              value={clickSecretKey}
              onChange={(e) => setClickSecretKey(e.target.value)}
              placeholder="••••••••"
              className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* PAYME */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-black text-slate-800 dark:text-white">Payme</label>
            <button
              type="button"
              onClick={() => setPaymeEnabled((v) => !v)}
              className={`w-11 h-6 rounded-full p-0.5 transition-colors ${paymeEnabled ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`}
            >
              <span className={`w-5 h-5 rounded-full bg-white block transition-transform ${paymeEnabled ? "translate-x-5" : ""}`} />
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Merchant ID (Kassa ID)</label>
            <input
              type="text"
              value={paymeMerchantId}
              onChange={(e) => setPaymeMerchantId(e.target.value)}
              placeholder="Masalan: 5e730e8e0b852a417aa49384"
              className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Key</label>
            <input
              type="password"
              value={paymeKey}
              onChange={(e) => setPaymeKey(e.target.value)}
              placeholder="••••••••"
              className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="fixed bottom-24 left-0 right-0 px-4 z-40">
          <button
            type="submit"
            disabled={saving}
            className="w-full h-12 bg-[#5346E0] text-white font-black text-sm rounded-2xl shadow-md shadow-indigo-600/20 disabled:opacity-60"
          >
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </form>

      {showSavedModal && (
        <StatusModal
          variant="success"
          title="To'lov sozlamalari saqlandi! ✅"
          onClose={() => navigate(-1)}
        />
      )}
    </div>
  );
};

export default PaymentSettingsPage;
