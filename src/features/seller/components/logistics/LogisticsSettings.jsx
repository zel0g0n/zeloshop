import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Truck, Gift } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import updateSeller from "@/services/sellers/updateSeller";
import { DELIVERY_ZONES, DELIVERY_TIME_OPTIONS } from "@/constants/deliveryZones";
import { formatMoneyInput, parseMoneyInput } from "@/utils/moneyFormat";
import StatusModal from "@/components/ui/StatusModal";

// REGIONAL LOGISTICS MATRIX & MARKETING RETENTION TRIGGER
//
// MUHIM IZOH: bu yerda sotuvchi o'z hududiy kuryer narxlarini va
// bepul yetkazib berish chegarasini SOZLAYDI — bu ma'lumot
// `sellers/{id}` hujjatida saqlanadi. Buni haqiqiy Checkout
// hisob-kitobiga (mijoz hududini tanlashi va shu narxni ko'rishi)
// bog'lash — alohida, kelajakdagi bosqich (bu yerda faqat sotuvchi
// tomonidagi sozlash interfeysi qurilmoqda).
const LogisticsSettings = () => {
  const navigate = useNavigate();
  const { sellerId, store } = useSession();

  const [zonePrices, setZonePrices] = useState(() => {
    const initial = {};
    DELIVERY_ZONES.forEach((zone) => {
      const existing = store?.deliveryZones?.[zone.key];
      initial[zone.key] = {
        price: existing?.price ? formatMoneyInput(existing.price) : "",
        days: existing?.days || DELIVERY_TIME_OPTIONS[0],
      };
    });
    return initial;
  });

  const [freeDeliveryEnabled, setFreeDeliveryEnabled] = useState(Boolean(store?.freeDeliveryEnabled));
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(
    store?.freeDeliveryThreshold ? formatMoneyInput(store.freeDeliveryThreshold) : ""
  );

  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!store) return;
    const initial = {};
    DELIVERY_ZONES.forEach((zone) => {
      const existing = store.deliveryZones?.[zone.key];
      initial[zone.key] = {
        price: existing?.price ? formatMoneyInput(existing.price) : "",
        days: existing?.days || DELIVERY_TIME_OPTIONS[0],
      };
    });
    setZonePrices(initial);
    setFreeDeliveryEnabled(Boolean(store.freeDeliveryEnabled));
    setFreeDeliveryThreshold(store.freeDeliveryThreshold ? formatMoneyInput(store.freeDeliveryThreshold) : "");
  }, [store]);

  const handlePriceChange = useCallback((zoneKey, rawValue) => {
    setZonePrices((prev) => ({
      ...prev,
      [zoneKey]: { ...prev[zoneKey], price: formatMoneyInput(rawValue) },
    }));
  }, []);

  const handleDaysChange = useCallback((zoneKey, value) => {
    setZonePrices((prev) => ({
      ...prev,
      [zoneKey]: { ...prev[zoneKey], days: value },
    }));
  }, []);

  const handleSave = useCallback(async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const deliveryZonesToSave = {};
      DELIVERY_ZONES.forEach((zone) => {
        deliveryZonesToSave[zone.key] = {
          price: parseMoneyInput(zonePrices[zone.key]?.price || "0"),
          days: zonePrices[zone.key]?.days || DELIVERY_TIME_OPTIONS[0],
        };
      });

      await updateSeller(sellerId, {
        deliveryZones: deliveryZonesToSave,
        freeDeliveryEnabled,
        freeDeliveryThreshold: freeDeliveryEnabled ? parseMoneyInput(freeDeliveryThreshold) : 0,
      });
      setShowSaved(true);
    } catch (err) {
      setError(err.message || "Saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }, [sellerId, zonePrices, freeDeliveryEnabled, freeDeliveryThreshold]);

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-32 transition-colors duration-300">

      <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">Yetkazib berish va Logistika</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Hududiy kuryer narxlari</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="p-4 space-y-4">
        {error && (
          <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 p-3 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
            <Truck size={14} />
            <h3 className="text-xs font-black uppercase tracking-wider">Hududiy kuryer narxlari</h3>
          </div>

          {DELIVERY_ZONES.map((zone) => (
            <div key={zone.key} className="bg-[#F4F5F9] dark:bg-slate-800 rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{zone.label}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    disabled={saving}
                    placeholder="Narxi"
                    value={zonePrices[zone.key]?.price || ""}
                    onChange={(e) => handlePriceChange(zone.key, e.target.value)}
                    className="w-full h-10 pl-3 pr-12 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                  />
                  <span className="absolute inset-y-0 right-3 flex items-center text-[10px] font-bold text-slate-400 dark:text-slate-500">UZS</span>
                </div>

                <select
                  disabled={saving}
                  value={zonePrices[zone.key]?.days || DELIVERY_TIME_OPTIONS[0]}
                  onChange={(e) => handleDaysChange(zone.key, e.target.value)}
                  className="h-10 px-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                >
                  {DELIVERY_TIME_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift size={16} className="text-indigo-500 dark:text-indigo-400" />
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">Bepul yetkazib berish</h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">Muayyan summadan yuqorida avtomatik bepul</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFreeDeliveryEnabled((v) => !v)}
              disabled={saving}
              className={`shrink-0 w-11 h-6 rounded-full p-0.5 transition-colors disabled:opacity-50 ${freeDeliveryEnabled ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`}
            >
              <span className={`block w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${freeDeliveryEnabled ? "translate-x-5" : ""}`} />
            </button>
          </div>

          {freeDeliveryEnabled && (
            <div className="animate-fade-in space-y-1">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Minimal chek summasi</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  disabled={saving}
                  placeholder="Masalan: 400,000"
                  value={freeDeliveryThreshold}
                  onChange={(e) => setFreeDeliveryThreshold(formatMoneyInput(e.target.value))}
                  className="w-full h-11 pl-3 pr-14 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                />
                <span className="absolute inset-y-0 right-3 flex items-center text-[10px] font-bold text-slate-400 dark:text-slate-500">UZS</span>
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full h-12 bg-[#5346E0] hover:bg-[#4336c7] text-white font-black text-sm rounded-2xl shadow-md shadow-indigo-600/20 disabled:opacity-60"
        >
          {saving ? "Saqlanmoqda..." : "Saqlash"}
        </button>
      </form>

      {showSaved && (
        <StatusModal
          variant="success"
          title="Logistika sozlamalari saqlandi! ✅"
          onClose={() => navigate(-1)}
        />
      )}
    </div>
  );
};

export default LogisticsSettings;
