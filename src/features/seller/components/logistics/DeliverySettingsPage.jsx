import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Truck, Gift, MapPin, Eye, EyeOff, Loader2, Clock } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useYandexDeliveryConfig } from "@/hooks/seller/useYandexDeliveryConfig";
import updateSeller from "@/services/sellers/updateSeller";
import { DELIVERY_TIER_KEYS, hasDistrictTier } from "@/constants/deliveryTiers";
import { DELIVERY_TIME_KEYS } from "@/constants/deliveryZones";
import { formatMoneyInput, parseMoneyInput } from "@/utils/moneyFormat";
import StatusModal from "@/components/ui/StatusModal";
import CustomSelect from "@/components/ui/CustomSelect";
import YandexPickupLocationCard from "@/features/seller/components/delivery/YandexPickupLocationCard";
import { useLanguage } from "@/context/LanguageContext";

// "HH:00" shaklidagi soat variantlari (00:00...23:00) — do'kon ish
// vaqtini (2026-09 punkt-royxati, 15-band) FAQAT to'liq soat
// chegarasida tanlash uchun (daqiqa granularligi ATAYLAB YO'Q -
// `src/utils/deliverySlots.js`dagi 1-soatlik yetkazib berish
// oralig'i mantig'i bilan mos bo'lishi uchun).
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

// Yetkazib berish sozlamalari — birlashtirilgan sahifa.
//
// "Yetkazib berish va Logistika" (mintaqaviy narxlar) va "Yandex
// Delivery" (tezkor kuryer ulash) bir mavzuga tegishli bo'lgani uchun
// bitta sahifada, ichida segment-tab bilan almashtiriladigan ikki bo'lim
// sifatida, bitta orqaga tugmasi bilan ko'rsatiladi. Har bir bo'lim
// o'zining mustaqil saqlash tugmasiga ega, chunki ular Firestore'da
// turli hujjatlarga yoziladi (`sellers/{id}` va `sellers/{id}/private/
// yandexDelivery`) — shuning uchun ularni bitta formaga birlashtirish
// noto'g'ri bo'lardi, faqat ko'rinish birlashtirilgan.
const DeliverySettingsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { sellerId, store, patchStore } = useSession();
  const yandexHook = useYandexDeliveryConfig(sellerId);
  const { config: yandexConfig, loading: yandexLoading, saving: yandexSaving, save: saveYandexConfig } = yandexHook;

  const [activeTab, setActiveTab] = useState(location.state?.initialTab === "yandex" ? "yandex" : "zones");

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
  // Do'kon ish vaqti (2026-09 punkt-royxati, 15-band) - checkout'dagi
  // yetkazib berish vaqt oralig'i tanlovi shu oraliqqa CHEGARALANADI
  // (`Checkout.jsx`, `functions/orders.js`dagi server tomonidagi
  // yakuniy tasdiqlash). Standart: 10:00-19:00.
  const [workingHoursOpen, setWorkingHoursOpen] = useState(store?.workingHoursOpen || "10:00");
  const [workingHoursClose, setWorkingHoursClose] = useState(store?.workingHoursClose || "19:00");
  const [zonesSaving, setZonesSaving] = useState(false);
  const [zonesShowSaved, setZonesShowSaved] = useState(false);
  const [zonesError, setZonesError] = useState(null);

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
    setWorkingHoursOpen(store.workingHoursOpen || "10:00");
    setWorkingHoursClose(store.workingHoursClose || "19:00");
  }, [store]);

  const handlePriceChange = useCallback((tierKey, rawValue) => {
    setTierPrices((prev) => ({ ...prev, [tierKey]: { ...prev[tierKey], price: formatMoneyInput(rawValue) } }));
  }, []);

  const handleDaysChange = useCallback((tierKey, value) => {
    setTierPrices((prev) => ({ ...prev, [tierKey]: { ...prev[tierKey], days: value } }));
  }, []);

  const handleSaveZones = useCallback(async (e) => {
    e.preventDefault();
    if (!sellerRegion) {
      setZonesError(t("logistics.regionRequiredError"));
      return;
    }
    if (workingHoursOpen >= workingHoursClose) {
      setZonesError(t("logistics.workingHoursInvalidError"));
      return;
    }
    setZonesSaving(true);
    setZonesError(null);
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
        workingHoursOpen,
        workingHoursClose,
      };
      await updateSeller(sellerId, patch);
      patchStore(patch);
      setZonesShowSaved(true);
    } catch (err) {
      setZonesError(err.message || t("logistics.saveError"));
    } finally {
      setZonesSaving(false);
    }
  }, [sellerId, sellerRegion, tierPrices, freeDeliveryEnabled, freeDeliveryThreshold, workingHoursOpen, workingHoursClose, t, patchStore, setZonesShowSaved]);

  const visibleTierKeys = DELIVERY_TIER_KEYS.filter((key) => key !== "sameRegionDistricts" || showDistrictTier);

  // --- Yandex Delivery bo'limi ---
  const [yandexEnabled, setYandexEnabled] = useState(false);
  const [oauthToken, setOauthToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [yandexFormError, setYandexFormError] = useState(null);
  const [yandexShowSaved, setYandexShowSaved] = useState(false);

  useEffect(() => {
    if (!yandexConfig) return;
    setOauthToken(yandexConfig.oauthToken || "");
    setYandexEnabled(Boolean(yandexConfig.enabled));
  }, [yandexConfig]);

  const isYandexConnected = useMemo(
    () => Boolean(yandexConfig?.enabled && yandexConfig?.oauthToken && yandexConfig?.pickupLat && yandexConfig?.pickupLng),
    [yandexConfig],
  );

  const handleSaveYandex = useCallback(async (e) => {
    e.preventDefault();
    setYandexFormError(null);
    const hasPickup = Boolean(yandexConfig?.pickupLat && yandexConfig?.pickupLng);
    if (yandexEnabled && !oauthToken.trim()) {
      setYandexFormError(t("yandexDelivery.tokenRequired"));
      return;
    }
    if (yandexEnabled && !hasPickup) {
      setYandexFormError(t("yandexDelivery.pickupRequired"));
      return;
    }
    try {
      await saveYandexConfig({
        oauthToken: oauthToken.trim(),
        pickupAddress: yandexConfig?.pickupAddress || "",
        pickupLat: yandexConfig?.pickupLat,
        pickupLng: yandexConfig?.pickupLng,
        enabled: yandexEnabled,
      });
      setYandexShowSaved(true);
    } catch (err) {
      setYandexFormError(err.message || t("yandexDelivery.saveError"));
    }
  }, [oauthToken, yandexEnabled, yandexConfig, saveYandexConfig, t, setYandexShowSaved]);

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-36 transition-colors duration-300">

      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">{t("deliverySettings.title")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("deliverySettings.subtitle")}</p>
        </div>
      </div>

      <div className="p-4 pb-0">
        <div className="bg-slate-200/60 dark:bg-slate-800 p-1 rounded-xl grid grid-cols-2 text-center text-xs font-black text-slate-500 dark:text-slate-400">
          <button
            type="button"
            onClick={() => setActiveTab("zones")}
            className={`py-2 rounded-lg transition-colors ${activeTab === "zones" ? "bg-white dark:bg-slate-900 text-[#5346E0] dark:text-[#8b85f5] shadow-xs" : ""}`}
          >
            {t("deliverySettings.tabZones")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("yandex")}
            className={`py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${activeTab === "yandex" ? "bg-white dark:bg-slate-900 text-[#5346E0] dark:text-[#8b85f5] shadow-xs" : ""}`}
          >
            {t("deliverySettings.tabYandex")}
            {!yandexLoading && isYandexConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
          </button>
        </div>
      </div>

      {activeTab === "zones" ? (
        <form onSubmit={handleSaveZones} className="p-4 space-y-4">
          {zonesError && (
            <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 p-3 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400">
              {zonesError}
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
                      disabled={zonesSaving}
                      placeholder={t("logistics.pricePlaceholder")}
                      value={tierPrices[tierKey]?.price || ""}
                      onChange={(e) => handlePriceChange(tierKey, e.target.value)}
                      className="w-full h-10 pl-3 pr-12 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                    />
                    <span className="absolute inset-y-0 right-3 flex items-center text-[10px] font-bold text-slate-400 dark:text-slate-500">UZS</span>
                  </div>

                  <CustomSelect
                    disabled={zonesSaving}
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
                disabled={zonesSaving}
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
                    disabled={zonesSaving}
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

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-indigo-500 dark:text-indigo-400" />
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">{t("logistics.workingHoursTitle")}</h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("logistics.workingHoursDesc")}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("logistics.workingHoursOpenLabel")}</label>
                <CustomSelect
                  disabled={zonesSaving}
                  value={workingHoursOpen}
                  onChange={setWorkingHoursOpen}
                  options={HOUR_OPTIONS.map((hh) => ({ value: hh, label: hh }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("logistics.workingHoursCloseLabel")}</label>
                <CustomSelect
                  disabled={zonesSaving}
                  value={workingHoursClose}
                  onChange={setWorkingHoursClose}
                  options={HOUR_OPTIONS.map((hh) => ({ value: hh, label: hh }))}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={zonesSaving}
            className="w-full h-12 bg-[#5346E0] hover:bg-[#4336c7] text-white font-black text-sm rounded-2xl shadow-md shadow-indigo-600/20 disabled:opacity-60"
          >
            {zonesSaving ? t("logistics.saving") : t("logistics.save")}
          </button>
        </form>
      ) : yandexLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
            <Loader2 size={22} className="animate-spin text-indigo-500" />
          </div>
        </div>
      ) : (
        <form onSubmit={handleSaveYandex} className="p-4 space-y-4">
          <div className="flex items-start gap-2 p-4 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
            <Truck size={15} className="shrink-0 mt-0.5" />
            <span>{t("yandexDelivery.infoText")}</span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">{t("yandexDelivery.enableTitle")}</h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">{t("yandexDelivery.enableDesc")}</p>
              </div>
              <button
                type="button"
                onClick={() => setYandexEnabled((v) => !v)}
                className={`w-12 h-7 rounded-full flex items-center px-1 transition-colors shrink-0 ${yandexEnabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
              >
                <span className="w-5 h-5 bg-white rounded-full shadow-sm" />
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-1.5">
            <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{t("yandexDelivery.tokenLabel")}</label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                disabled={yandexSaving}
                placeholder={t("yandexDelivery.tokenPlaceholder")}
                value={oauthToken}
                onChange={(e) => setOauthToken(e.target.value)}
                className={`w-full h-11 pl-3 pr-11 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-mono text-xs focus:outline-none focus:ring-1 disabled:opacity-60 ${
                  yandexFormError && !oauthToken.trim() ? "ring-1 ring-rose-400" : "focus:ring-indigo-500"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                tabIndex={-1}
                className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-slate-400 dark:text-slate-500"
                aria-label={showToken ? t("yandexDelivery.hideToken") : t("yandexDelivery.showToken")}
              >
                {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("yandexDelivery.tokenHint")}</p>
          </div>

          <YandexPickupLocationCard config={yandexConfig} save={saveYandexConfig} />

          {yandexFormError && <p className="text-[11px] text-rose-500 font-semibold px-1">{yandexFormError}</p>}

          <button
            type="submit"
            disabled={yandexSaving}
            className="w-full h-12 bg-[#5346E0] text-white font-black text-sm rounded-2xl shadow-md shadow-indigo-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {yandexSaving && <Loader2 size={15} className="animate-spin" />}
            {yandexSaving ? t("yandexDelivery.saving") : t("yandexDelivery.save")}
          </button>
        </form>
      )}

      {zonesShowSaved && (
        <StatusModal
          variant="success"
          title={t("logistics.savedTitle")}
          onClose={() => setZonesShowSaved(false)}
        />
      )}

      {yandexShowSaved && (
        <StatusModal
          variant="success"
          title={t("yandexDelivery.savedTitle")}
          onClose={() => setYandexShowSaved(false)}
        />
      )}
    </div>
  );
};

export default DeliverySettingsPage;
