import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Tag, Plus, Trash2, Percent, Wallet } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useCoupons } from "@/hooks/seller/useCoupons";
import StatusModal from "@/components/ui/StatusModal";

const MarketingCoupons = () => {
  const navigate = useNavigate();
  const { sellerId } = useSession();
  const { coupons, loading, create, remove } = useCoupons(sellerId);

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState("percent"); // "percent" | "fixed"
  const [discountValue, setDiscountValue] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deletingCode, setDeletingCode] = useState(null);
  const [globalError, setGlobalError] = useState(null);

  const handleCreate = useCallback(async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!code.trim()) {
      setFormError("Promokod kiritilishi shart.");
      return;
    }
    if (!discountValue || Number(discountValue) <= 0) {
      setFormError("Chegirma qiymatini to'g'ri kiriting.");
      return;
    }
    if (discountType === "percent" && Number(discountValue) > 100) {
      setFormError("Foiz chegirma 100 dan katta bo'lishi mumkin emas.");
      return;
    }

    setCreating(true);
    try {
      await create({
        code,
        discountType,
        discountValue,
        expiresAt: expiresAt || null,
        usageLimit: usageLimit || null,
      });
      setCode("");
      setDiscountValue("");
      setExpiresAt("");
      setUsageLimit("");
    } catch (err) {
      setFormError(err.message || "Promokod yaratishda xatolik yuz berdi");
    } finally {
      setCreating(false);
    }
  }, [code, discountType, discountValue, expiresAt, usageLimit, create]);

  const handleDelete = useCallback(async (couponCode) => {
    setDeletingCode(couponCode);
    try {
      await remove(couponCode);
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setDeletingCode(null);
    }
  }, [remove]);

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-32 transition-colors duration-300">

      <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">Marketing va Kuponlar</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Promokodlar va aksiyalar</p>
        </div>
      </div>

      <div className="p-4 space-y-4">

        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
            <Tag size={13} />
            <h3 className="text-xs font-black uppercase tracking-wider">Yangi promokod yaratish</h3>
          </div>

          <input
            type="text"
            disabled={creating}
            placeholder="Kod (masalan: YOZGI30)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-black text-sm uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
          />

          <div className="grid grid-cols-2 gap-2">
            <select
              disabled={creating}
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value)}
              className="h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
            >
              <option value="percent">Foiz chegirma (%)</option>
              <option value="fixed">Aniq summa (so'm)</option>
            </select>
            <input
              type="number"
              disabled={creating}
              placeholder={discountType === "percent" ? "Masalan: 20" : "Masalan: 15000"}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className="h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Amal qilish muddati (ixtiyoriy)</label>
              <input
                type="date"
                disabled={creating}
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full h-10 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Ishlatish limiti (ixtiyoriy)</label>
              <input
                type="number"
                disabled={creating}
                placeholder="Cheklovsiz"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                className="w-full h-10 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
              />
            </div>
          </div>

          {formError && <p className="text-[11px] text-rose-500 font-semibold">{formError}</p>}

          <button
            type="submit"
            disabled={creating}
            className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            <Plus size={14} /> {creating ? "Yaratilmoqda..." : "Promokod yaratish"}
          </button>
        </form>

        <div className="space-y-2">
          <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">Faol promokodlar</h3>

          {loading && <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-6">Yuklanmoqda...</p>}

          {!loading && coupons.length === 0 && (
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-8">Hali promokod yaratilmagan</p>
          )}

          {!loading && coupons.map((coupon) => (
            <div key={coupon.code} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-3.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
                  {coupon.discountType === "percent" ? <Percent size={15} /> : <Wallet size={15} />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-800 dark:text-white truncate">{coupon.code}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    {coupon.discountType === "percent" ? `${coupon.discountValue}% chegirma` : `${Number(coupon.discountValue).toLocaleString()} so'm chegirma`}
                    {coupon.usageLimit ? ` · ${coupon.usedCount}/${coupon.usageLimit} ishlatilgan` : ` · ${coupon.usedCount} marta ishlatilgan`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(coupon.code)}
                disabled={deletingCode === coupon.code}
                className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0 disabled:opacity-50"
                aria-label="O'chirish"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {globalError && (
        <StatusModal variant="error" title="Xatolik yuz berdi" message={globalError} onClose={() => setGlobalError(null)} />
      )}
    </div>
  );
};

export default MarketingCoupons;
