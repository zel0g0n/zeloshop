import { X, Bike, Car, Truck } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";

// Yandex Delivery - tarif tanlash oynasi.
//
// Tarif sinfi (`courier`/`express`/`cargo`) doimiy sozlama sifatida
// emas, "Kuryer chaqirish" tugmasi bosilganda har bir buyurtma uchun
// alohida tanlanadi — narx/tezlik bo'yicha farq qiladigan tariflar
// orasida sotuvchi buyurtma bo'yicha moslashuvchan tanlov qila oladi.
const TARIFF_OPTIONS = [
  { value: "courier", icon: Bike, labelKey: "courierLabel", descKey: "courierDesc" },
  { value: "express", icon: Car, labelKey: "expressLabel", descKey: "expressDesc" },
  { value: "cargo", icon: Truck, labelKey: "cargoLabel", descKey: "cargoDesc" },
];

const YandexTariffModal = ({ onSelect, onClose, busy }) => {
  const { t } = useLanguage();

  useEscapeToClose(onClose, !busy);

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-[440px] rounded-t-[28px] p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 dark:text-white">{t("sellerOrders.yandexTariffModal.title")}</h3>
          <button type="button" onClick={onClose} disabled={busy} className="text-slate-400 dark:text-slate-500 disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2">
          {TARIFF_OPTIONS.map(({ value, icon: Icon, labelKey, descKey }) => (
            <button
              key={value}
              type="button"
              disabled={busy}
              onClick={() => onSelect(value)}
              className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-2xl border border-transparent bg-[#F4F5F9] dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-50 active:scale-[0.99] transition-transform"
            >
              <span className="shrink-0 w-9 h-9 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
                <Icon size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-black">{t(`sellerOrders.yandexTariffModal.${labelKey}`)}</span>
                <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">{t(`sellerOrders.yandexTariffModal.${descKey}`)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default YandexTariffModal;
