import usePlatformStats from "@/hooks/admin/usePlatformStats";
import useGetAllSellers from "@/hooks/admin/useGetAllSellers";
import useTariffRequests from "@/hooks/admin/useTariffRequests";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import { Loader2 } from "lucide-react";

const StatCard = ({ label, value, icon }) => (
  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xs">
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="text-lg">{icon}</span>
    </div>
    <div className="text-2xl font-black text-gray-800 dark:text-white mt-1">{value}</div>
  </div>
);

// BIR MARTALIK SOZLASH TUGMASI (v39) — botlarning Telegram webhook'ini
// ro'yxatdan o'tkazish uchun. MUHIM: bu funksiya (`registerCourierBotWebhook`
// va sh.k.) faqat ADMIN uchun ochiq `onCall`, lekin ilovada buni
// chaqiradigan HECH QANDAY tugma yo'q edi — foydalanuvchi buni avval
// har safar boshqa (bu loyihaga tegishli bo'lmagan) usul bilan
// chaqirgan. Endi shu yerda, admin panelida, oddiy tugma orqali —
// skript yoki qo'lda so'rov yuborishga hojat qolmaydi.
const WEBHOOK_TOOLS = [
  { id: "courier", label: "Kuryer boti webhookini ro'yxatdan o'tkazish", fn: "registerCourierBotWebhook" },
  { id: "staff", label: "Xodim boti webhookini ro'yxatdan o'tkazish", fn: "registerStaffBotWebhook" },
  { id: "main", label: "Asosiy bot webhookini qayta ro'yxatdan o'tkazish", fn: "registerTelegramWebhook" },
];

const WebhookSetupTools = () => {
  const [busyId, setBusyId] = useState(null);
  const [results, setResults] = useState({});

  const handleRegister = async (tool) => {
    setBusyId(tool.id);
    setResults((prev) => ({ ...prev, [tool.id]: null }));
    try {
      const fn = httpsCallable(functions, tool.fn);
      const { data } = await fn();
      setResults((prev) => ({ ...prev, [tool.id]: { ok: true, text: data?.webhookUrl || "Muvaffaqiyatli." } }));
    } catch (err) {
      setResults((prev) => ({ ...prev, [tool.id]: { ok: false, text: err.message || "Xatolik yuz berdi." } }));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 space-y-3">
      <p className="text-[11px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-wider">Bir martalik sozlash</p>
      {WEBHOOK_TOOLS.map((tool) => (
        <div key={tool.id} className="space-y-1.5">
          <button
            type="button"
            onClick={() => handleRegister(tool)}
            disabled={busyId === tool.id}
            className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {busyId === tool.id ? <Loader2 size={13} className="animate-spin" /> : null}
            {tool.label}
          </button>
          {results[tool.id] && (
            <p className={`text-[10px] font-semibold break-all ${results[tool.id].ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>
              {results[tool.id].ok ? "✓ " : "✗ "}{results[tool.id].text}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { stats, loading: statsLoading } = usePlatformStats();
  const { sellers, loading: sellersLoading } = useGetAllSellers();
  const { requests: tariffRequests, loading: tariffRequestsLoading } = useTariffRequests();

  const suspendedCount = useMemo(
    () => sellers.filter((s) => s.status === "suspended").length,
    [sellers]
  );

  return (
    <div className="p-4 space-y-4 pb-28">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Jami sotuvchilar" value={statsLoading ? "…" : stats?.totalSellers ?? 0} icon="🏪" />
        <StatCard label="Jami mahsulotlar" value={statsLoading ? "…" : stats?.totalProducts ?? 0} icon="📦" />
        <StatCard label="Jami buyurtmalar" value={statsLoading ? "…" : stats?.totalOrders ?? 0} icon="🧾" />
        <StatCard label="To'xtatilgan do'konlar" value={sellersLoading ? "…" : suspendedCount} icon="⛔️" />
      </div>

      {!tariffRequestsLoading && tariffRequests.length > 0 && (
        <button
          type="button"
          onClick={() => navigate("/tariff-requests")}
          className="w-full bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-2xl p-4 text-left flex items-center justify-between gap-3"
        >
          <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
            💎 {tariffRequests.length} ta kutilayotgan tarif so'rovi bor
          </span>
          <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase shrink-0">Ko'rish →</span>
        </button>
      )}

      <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl p-4 text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
        💡 "Sotuvchilar" bo'limidan istalgan do'konni qidirishingiz va
        kerak bo'lsa faoliyatini to'xtatib qo'yishingiz mumkin.
      </div>

      <WebhookSetupTools />
    </div>
  );
};

export default AdminDashboard;
