import { useState, useEffect, useCallback } from "react";
import { MapPin, Check, Loader2 } from "lucide-react";
import LocationPickerModal from "@/components/ui/LocationPickerModal";
import { useLanguage } from "@/context/LanguageContext";

// YANDEX DELIVERY OLIB KETISH NUQTASI — QAYTA ISHLATILADIGAN KARTA.
//
// MUHIM: bu joylashuv (`sellers/{id}/private/yandexDelivery`dagi
// pickupLat/pickupLng/pickupAddress) endi IKKI joyda tahrirlanadi —
// "Do'kon sozlamalari" (StoreSettingsPage) VA "Yetkazib berish"
// (DeliverySettingsPage'ning Yandex bo'limi) — ikkalasi ham AYNAN
// SHU komponentni ishlatadi, shuning uchun mantiq bitta joyda.
//
// `config`/`save` — ota komponentdan PROP sifatida keladi (o'z ichida
// `useYandexDeliveryConfig` chaqirmaydi). Bu ATAYLAB shunday: agar
// bu karta o'zining alohida hook nusxasini yuritsa, xuddi shu
// sahifada yonma-yon turgan boshqa forma (masalan token/yoqish
// formasi) ESKIRGAN (stale) `config`ni ko'rishi mumkin edi — ota
// komponentda BITTA hook chaqiruvi, ikkalasiga ham bir xil, doim
// YANGI holat kafolatlaydi.
const YandexPickupLocationCard = ({ config, save }) => {
  const { t } = useLanguage();
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupLocation, setPickupLocation] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!config) return;
    setPickupAddress(config.pickupAddress || "");
    if (config.pickupLat && config.pickupLng) {
      setPickupLocation({ lat: config.pickupLat, lng: config.pickupLng });
    } else {
      setPickupLocation(null);
    }
  }, [config]);

  const handleConfirm = useCallback(async (location) => {
    const address = `${t("yandexDelivery.mapAddressPrefix")} ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
    setShowMapPicker(false);
    setSaving(true);
    setError(null);
    try {
      // MUHIM: token/yoqilgan-yoqilmagan bayrog'ini MAVJUD qiymatdan
      // o'zgarmasdan qayta yuboramiz (`saveYandexDeliveryConfig` HAR
      // SAFAR to'liq 4 ta maydonni yozadi) — aks holda bu yerdan
      // shunchaki joylashuv o'zgartirilsa, allaqachon saqlangan OAuth
      // tokeni TASODIFAN bo'shatib qo'yilishi mumkin edi.
      await save({
        oauthToken: config?.oauthToken || "",
        enabled: Boolean(config?.enabled),
        pickupAddress: address,
        pickupLat: location.lat,
        pickupLng: location.lng,
      });
      setPickupLocation(location);
      setPickupAddress(address);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message || t("yandexDelivery.saveError"));
    } finally {
      setSaving(false);
    }
  }, [config, save, t]);

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{t("yandexDelivery.pickupLabel")}</label>
        {saving && <Loader2 size={12} className="animate-spin text-indigo-400 shrink-0" />}
        {saved && !saving && (
          <span className="shrink-0 text-[10px] font-bold text-emerald-500 flex items-center gap-1">
            <Check size={11} /> {t("yandexDelivery.locationSavedLabel")}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => setShowMapPicker(true)}
        disabled={saving}
        className="w-full flex items-center gap-2.5 p-3 rounded-xl bg-[#F4F5F9] dark:bg-slate-800 text-left disabled:opacity-60"
      >
        <MapPin size={16} className="text-indigo-500 shrink-0" />
        <span className="flex-1 min-w-0 text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
          {pickupLocation ? pickupAddress : t("yandexDelivery.pickupPlaceholder")}
        </span>
        {pickupLocation && <Check size={14} className="text-emerald-500 shrink-0" />}
      </button>
      <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("yandexDelivery.pickupSharedHint")}</p>
      {error && <p className="text-[11px] text-rose-500 font-semibold">{error}</p>}

      {showMapPicker && (
        <LocationPickerModal
          initialLocation={pickupLocation}
          onConfirm={handleConfirm}
          onClose={() => setShowMapPicker(false)}
        />
      )}
    </div>
  );
};

export default YandexPickupLocationCard;
