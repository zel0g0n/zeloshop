import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Truck, Gift, MapPin } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import updateSeller from "@/services/sellers/updateSeller";
import { DELIVERY_TIER_KEYS, hasDistrictTier } from "@/constants/deliveryTiers";
import { DELIVERY_TIME_KEYS } from "@/constants/deliveryZones";
import { formatMoneyInput, parseMoneyInput } from "@/utils/moneyFormat";
import StatusModal from "@/components/ui/StatusModal";
import CustomSelect from "@/components/ui/CustomSelect";
import { useLanguage } from "@/context/LanguageContext";

// REGIONAL LOGISTICS MATRIX & MARKETING RETENTION TRIGGER
//
// MUHIM, TO'LIQ QAYTA QURISH: OLDIN sotuvchi 5 ta QATTIQ BELGILANGAN,
// O'Z JOYLASHUVIGA UMUMAN BOG'LIQ BO'LMAGAN mintaqaga (masalan
// "Farg'ona vodiysi") narx qo'yardi - bu, boshqa hududda joylashgan
// sotuvchi uchun MANTIQSIZ edi. Endi narx SOTUVCHINING O'Z HUDUDIGA
// (`store.region`, ro'yxatdan o'tishda belgilangan) NISBATAN, 3
// bosqichda so'raladi - "Shahar" / "Viloyat ichidagi tumanlar" /
// "Boshqa viloyatlar" (`constants/deliveryTiers.js`dagi izohga
// qarang - nega faqat Toshkent shahri/viloyati uchun HAQIQIY
// 2-bosqich mavjud).
const LogisticsSettings = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId, store, patchStore } = useSession();
  const sellerRegion = store?.region || null;
  const showDistrictTier = hasDistrictTier(sellerRegion);

  const [tierPrices, setTierPrices] = useState(() => {
    const initial = {};
    DELIVERY_TIER_KEYS.forEach((key) => {
      const existing = store?.deliveryTiers?.[key];
      initial[key] = {
        price: existing?.price ? formatMoneyInput(existing.price) : "",
        days: existing?.days || DELIVERY_TIME_KEYS[0],
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
    DELIVERY_TIER_KEYS.forEach((key) => {
      const existing = store.deliveryTiers?.[key];
      initial[key] = {
        price: existing?.price ? formatMoneyInput(existing.price) : "",
        days: existing?.days || DELIVERY_TIME_KEYS[0],
      };
    });
    setTierPrices(initial);
    setFreeDeliveryEnabled(Boolean(store.freeDeliveryEnabled));
    setFreeDeliveryThreshold(store.freeDeliveryThreshold ? formatMoneyInput(store.freeDeliveryThreshold) : "");
  }, [store]);

  const handlePriceChange = useCallback((tierKey, rawValue) => {
    setTierPrices((prev) => ({
      ...prev,
      [tierKey]: { ...prev[tierKey], price: formatMoneyInput(rawValue) },
    }));
  }, []);

  const handleDaysChange = useCallback((tierKey, value) => {
    setTierPrices((prev) => ({
      ...prev,
      [tierKey]: { ...prev[tierKey], days: value },
    }));
  }, []);

  const handleSave = useCallback(async (e) => {
    e.preventDefault();
    if (!sellerRegion) {
      setError(t("logistics.regionRequiredError"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const deliveryTiersToSave = {};
      DELIVERY_TIER_KEYS.forEach((key) => {
        deliveryTiersToSave[key] = {
          price: parseMoneyInput(tierPrices[key]?.price || "0"),
          days: tierPrices[key]?.days || DELIVERY_TIME_KEYS[0],
        };
      });

      const patch = {
        deliveryTiers: deliveryTiersToSave,
        freeDeliveryEnabled,
        freeDeliveryThreshold: freeDeliveryEnabled ? parseMoneyInput(freeDeliveryThreshold) : 0,
      };
      await updateSeller(sellerId, patch);
      // Checklistdagi "Yetkazib berish xizmatini sozlang" bosqichi
      // shu `store.deliveryTiers`ga qarab hisoblanadi — sahifa
      // yangilanmasdan darhol "bajarilgan" ko'rinishi uchun.
      patchStore(patch);
      setShowSaved(true);
    } catch (err) {
      setError(err.message || t("logistics.saveError"));
    } finally {
      setSaving(false);
    }
  }, [sellerId, sellerRegion, tierPrices, freeDeliveryEnabled, freeDeliveryThreshold, t, patchStore]);

  const visibleTierKeys = DELIVERY_TIER_KEYS.filter((key) => key !== "sameRegionDistricts" || showDistrictTier);

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-36 transition-colors duration-300">

      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">{t("logistics.title")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("logistics.subtitle")}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="p-4 space-y-4">
        {error && (
          <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 p-3 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        {!sellerRegion && (
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 p-3.5 rounded-2xl flex items-start gap-2">
            <MapPin size={14} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{t("logistics.noRegionWarning")}</p>
          </div>
        )}

        {sellerRegion && (
          <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl p-3.5 flex items-center gap-2">
            <MapPin size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">{t("logistics.yourRegionLabel")}: {sellerRegion}</p>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
            <Truck size={14} />
            <h3 className="text-xs font-black uppercase tracking-wider">{t("logistics.zonePricesTitle")}</h3>
          </div>

          {visibleTierKeys.map((tierKey) => (
            <div key={tierKey} className="bg-[#F4F5F9] dark:bg-slate-800 rounded-xl p-3 space-y-2">
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{t(`logistics.tier_${tierKey}_label`)}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">{t(`logistics.tier_${tierKey}_desc`)}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    disabled={saving}
                    placeholder={t("logistics.pricePlaceholder")}
                    value={tierPrices[tierKey]?.price || ""}
                    onChange={(e) => handlePriceChange(tierKey, e.target.value)}
                    className="w-full h-10 pl-3 pr-12 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                  />
                  <span className="absolute inset-y-0 right-3 flex items-center text-[10px] font-bold text-slate-400 dark:text-slate-500">UZS</span>
                </div>

                <CustomSelect
                  disabled={saving}
                  value={tierPrices[tierKey]?.days || DELIVERY_TIME_KEYS[0]}
                  onChange={(v) => handleDaysChange(tierKey, v)}
                  options={DELIVERY_TIME_KEYS.map((dayKey) => ({ value: dayKey, label: t(`deliveryZones.${dayKey}`) }))}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift size={16} className="text-indigo-500 dark:text-indigo-400" />
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">{t("logistics.freeDeliveryTitle")}</h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("logistics.freeDeliveryDesc")}</p>
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
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("logistics.minAmountLabel")}</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  disabled={saving}
                  placeholder={t("logistics.minAmountPlaceholder")}
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
          {saving ? t("logistics.saving") : t("logistics.save")}
        </button>
      </form>

      {showSaved && (
        <StatusModal
          variant="success"
          title={t("logistics.savedTitle")}
          onClose={() => navigate(-1)}
        />
      )}
    </div>
  );
};

export default LogisticsSettings;
