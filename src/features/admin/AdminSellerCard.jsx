import { memo, useState } from "react";
import { Trash2, X, TriangleAlert } from "lucide-react";
import updateSellerStatus from "@/services/admin/updateSellerStatus";
import setSellerTariffPlan from "@/services/admin/setSellerTariffPlan";
import deleteSellerPermanently from "@/services/admin/deleteSellerPermanently";
import { normalizeTariffPlan } from "@/utils/tariffLimits";

const STATUS_META = {
  active: { label: "Faol", color: "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  suspended: { label: "To'xtatilgan", color: "bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400" },
};

// Z-TARIFLAR (2026-09): ILGARI bu yerda faqat ikkilik "AI CEO"
// tugmasi bor edi (yoqilgan="pro"/o'chirilgan="start") — Z-Biznes
// darajasini berish uchun hech qanday admin boshqaruvi yo'q edi,
// FAQAT Firebase Console orqali qo'lda. Endi uchala tarif ham shu
// yerdan, bitta tugmalar qatoridan tanlanadi.
const PLAN_OPTIONS = [
  { id: "start", label: "Z-Start" },
  { id: "pro", label: "Z-Pro" },
  { id: "biznes", label: "Z-Biznes" },
];

const AdminSellerCard = ({ seller, onDeleted, onStatusChanged, onTariffPlanChanged }) => {
  const [pending, setPending] = useState(false);
  const [tariffPending, setTariffPending] = useState(false);
  const [error, setError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const isActive = seller.status !== "suspended";
  const meta = STATUS_META[isActive ? "active" : "suspended"];
  const currentPlan = normalizeTariffPlan(seller.tariffPlan);

  const handleToggle = async () => {
    setPending(true);
    setError(null);
    const nextStatus = isActive ? "suspended" : "active";
    try {
      await updateSellerStatus(seller.id, nextStatus);
      // Ro'yxat endi jonli tinglovchidan kelmaydi (audit izohiga
      // qarang, `useGetAllSellers.jsx`) — shuning uchun ota
      // komponentga o'zgarishni QO'LDA xabar qilamiz.
      onStatusChanged?.(seller.id, seller.status, nextStatus);
    } catch (err) {
      setError(err.message || "Xatolik yuz berdi");
    } finally {
      setPending(false);
    }
  };

  // Tarif — hozircha markazlashtirilgan to'lov tizimi yo'qligi
  // sababli, "Tariflar" so'rovi (`AdminTariffRequestsPage.jsx`) orqali
  // yoki bevosita shu yerdan, to'lov TASHQARIDA (masalan bank
  // o'tkazmasi) kelishilgach, admin QO'LDA o'rnatadi. Kelajakda
  // haqiqiy to'lov tizimi qurilsa, bu qadam avtomatlashtiriladi.
  const handlePlanSelect = async (plan) => {
    if (plan === currentPlan || tariffPending) return;
    setTariffPending(true);
    setError(null);
    try {
      await setSellerTariffPlan(seller.id, plan);
      onTariffPlanChanged?.(seller.id, plan);
    } catch (err) {
      setError(err.message || "Xatolik yuz berdi");
    } finally {
      setTariffPending(false);
    }
  };

  const handleDeletePermanently = async () => {
    setDeletePending(true);
    setDeleteError(null);
    try {
      await deleteSellerPermanently(seller.id, deleteConfirmText);
      setShowDeleteModal(false);
      onDeleted?.(seller.id, seller.status === "suspended");
    } catch (err) {
      setDeleteError(err.message || "O'chirishda xatolik yuz berdi");
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 text-lg">
            {seller.logo ? <img src={seller.logo} alt={seller.storeName} className="w-full h-full object-cover" /> : "🏪"}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-800 dark:text-white truncate">{seller.storeName || "Nomsiz do'kon"}</h3>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">{seller.category || "Soha ko'rsatilmagan"} · {seller.phone || "Telefon yo'q"}</p>
          </div>
        </div>
        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md shrink-0 ${meta.color}`}>
          {meta.label}
        </span>
      </div>

      {error && <p className="text-[11px] text-rose-500 font-semibold">{error}</p>}

      <button
        onClick={handleToggle}
        disabled={pending}
        className={`w-full h-9 rounded-xl text-xs font-bold transition-all disabled:opacity-60 ${
          isActive
            ? "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"
            : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        }`}
      >
        {pending ? "..." : isActive ? "To'xtatish" : "Qayta faollashtirish"}
      </button>

      <div>
        <p className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Tarif</p>
        <div className="grid grid-cols-3 gap-1.5">
          {PLAN_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handlePlanSelect(opt.id)}
              disabled={tariffPending}
              className={`h-9 rounded-xl text-[11px] font-bold transition-all disabled:opacity-60 ${
                currentPlan === opt.id
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => { setShowDeleteModal(true); setDeleteConfirmText(""); setDeleteError(null); }}
        className="w-full h-8 rounded-xl text-[11px] font-bold text-rose-400 dark:text-rose-500/80 flex items-center justify-center gap-1.5 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
      >
        <Trash2 size={12} /> Do'konni butunlay o'chirish
      </button>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center px-5 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl p-5 space-y-3.5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                <TriangleAlert size={18} />
              </div>
              <button onClick={() => setShowDeleteModal(false)} className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center shrink-0">
                <X size={14} />
              </button>
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white">Do'konni butunlay o'chirish</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                Bu amal <span className="font-bold text-rose-500">QAYTARIB BO'LMAYDI</span>. "{seller.storeName}" do'konining
                barcha mahsulotlari, buyurtmalari, xodimlari, kuryerlari va boshqa ma'lumotlari butunlay o'chiriladi.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                Tasdiqlash uchun do'kon nomini kiriting: <span className="text-slate-600 dark:text-slate-300">{seller.storeName}</span>
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={seller.storeName}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-white outline-none focus:border-rose-400"
              />
            </div>
            {deleteError && <p className="text-[11px] text-rose-500 font-semibold">{deleteError}</p>}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="h-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl"
              >
                Bekor qilish
              </button>
              <button
                onClick={handleDeletePermanently}
                disabled={deletePending || deleteConfirmText.trim().toLowerCase() !== String(seller.storeName || "").trim().toLowerCase()}
                className="h-10 bg-rose-600 disabled:opacity-40 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5"
              >
                <Trash2 size={13} /> {deletePending ? "O'chirilmoqda..." : "Butunlay o'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(AdminSellerCard);
