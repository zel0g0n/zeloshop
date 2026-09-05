import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Truck, MapPin } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useYandexDeliveryConfig } from "@/hooks/seller/useYandexDeliveryConfig";
import LocationPickerModal from "@/components/ui/LocationPickerModal";
import StatusModal from "@/components/ui/StatusModal";
import { useLanguage } from "@/context/LanguageContext";

// YANDEX DELIVERY INTEGRATSIYASI (sotuvchi sozlamalari)
//
// MUHIM: bu yerda sotuvchi o'z Yandex Delivery hisobiga ulanadi
// (shaxsiy OAuth token) va do'konining ANIQ (koordinata bilan)
// olib ketish manzilini belgilaydi — bularsiz haqiqiy narx
// hisoblab bo'lmaydi (Yandex API koordinata talab qiladi, oddiy
// matnli manzil YETARLI EMAS).
//
// Token — Click/Payme kabi — `sellers/{id}/private/yandexDelivery`da
// saqlanadi, faqat sotuvchining o'zi ko'radi.
const YandexDeliverySettings = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId } = useSession();
  const { config, loading, saving, error, save } = useYandexDeliveryConfig(sellerId);

  const [oauthToken, setOauthToken] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupLocation, setPickupLocation] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (!config) return;
    setOauthToken(config.oauthToken || "");
    setPickupAddress(config.pickupAddress || "");
    if (config.pickupLat && config.pickupLng) {
      setPickupLocation({ lat: config.pickupLat, lng: config.pickupLng });
    }
    setEnabled(Boolean(config.enabled));
  }, [config]);

  const handlePickupConfirm = useCallback((location) => {
    setPickupLocation(location);
    setPickupAddress(`${t("yandexDelivery.mapAddressPrefix")} ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`);
    setShowMapPicker(false);
  }, [t]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setFormError(null);
    if (enabled && !oauthToken.trim()) {
      setFormError(t("yandexDelivery.tokenRequired"));
      return;
    }
    if (enabled && !pickupLocation) {
      setFormError(t("yandexDelivery.pickupRequired"));
      return;
    }
    try {
      await save({
        oauthToken: oauthToken.trim(),
        pickupAddress,
        pickupLat: pickupLocation?.lat,
        pickupLng: pickupLocation?.lng,
        enabled,
      });
      setShowSaved(true);
    } catch (err) {
      setFormError(err.message || t("yandexDelivery.saveError"));
    }
  }, [oauthToken, pickupAddress, pickupLocation, enabled, save, t]);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-36 transition-colors duration-300">
      <div className="bg-white dark:bg-slate-900 px-5 py-4 sticky top-0 z-30 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300">
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">{t("yandexDelivery.title")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("yandexDelivery.subtitle")}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
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
              onClick={() => setEnabled((v) => !v)}
              className={`w-12 h-7 rounded-full flex items-center px-1 transition-colors shrink-0 ${enabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
            >
              <span className="w-5 h-5 bg-white rounded-full shadow-sm" />
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-1.5">
          <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{t("yandexDelivery.tokenLabel")}</label>
          <input
            type="text"
            disabled={saving}
            placeholder={t("yandexDelivery.tokenPlaceholder")}
            value={oauthToken}
            onChange={(e) => setOauthToken(e.target.value)}
            className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
          />
          <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("yandexDelivery.tokenHint")}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-2">
          <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{t("yandexDelivery.pickupLabel")}</label>
          <button
            type="button"
            onClick={() => setShowMapPicker(true)}
            className="w-full flex items-center gap-2.5 p-3 rounded-xl bg-[#F4F5F9] dark:bg-slate-800 text-left"
          >
            <MapPin size={16} className="text-indigo-500 shrink-0" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
              {pickupLocation ? pickupAddress : t("yandexDelivery.pickupPlaceholder")}
            </span>
          </button>
        </div>

        {formError && <p className="text-[11px] text-rose-500 font-semibold px-1">{formError}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full h-12 bg-[#5346E0] text-white font-black text-sm rounded-2xl shadow-md shadow-indigo-600/20 disabled:opacity-60"
        >
          {saving ? t("yandexDelivery.saving") : t("yandexDelivery.save")}
        </button>
      </form>

      {showMapPicker && (
        <LocationPickerModal
          initialLocation={pickupLocation}
          onConfirm={handlePickupConfirm}
          onClose={() => setShowMapPicker(false)}
        />
      )}

      {showSaved && (
        <StatusModal
          variant="success"
          title={t("yandexDelivery.savedTitle")}
          onClose={() => setShowSaved(false)}
        />
      )}
    </div>
  );
};

export default YandexDeliverySettings;
