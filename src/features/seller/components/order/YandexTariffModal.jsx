import { Bike, Car, Truck, ChevronRight, Info } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import Sheet from "@/components/ui/Sheet";

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

  return (
    <Sheet
      onClose={onClose}
      busy={busy}
      icon={Car}
      accent="amber"
      title={t("sellerOrders.yandexTariffModal.title")}
      subtitle={t("sellerOrders.yandexTariffModal.subtitle")}
      size="sm"
      footer={
        <p className="flex items-start gap-2 text-[11px] leading-4 font-medium text-slate-400 dark:text-slate-500">
          <Info size={13} className="shrink-0 mt-0.5" />
          <span>{t("sellerOrders.yandexTariffModal.note")}</span>
        </p>
      }
    >
      <div className="space-y-2">
        {TARIFF_OPTIONS.map(({ value, icon: Icon, labelKey, descKey }) => (
          <button
            key={value}
            type="button"
            disabled={busy}
            onClick={() => onSelect(value)}
            className="group w-full flex items-center gap-3 text-left px-3.5 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-300 hover:bg-amber-50/50 dark:hover:border-amber-500/40 dark:hover:bg-amber-500/5 disabled:opacity-50 active:scale-[0.99] transition-all"
          >
            <span className="shrink-0 w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-amber-100 dark:group-hover:bg-amber-500/10 flex items-center justify-center text-slate-600 group-hover:text-amber-600 dark:text-slate-300 dark:group-hover:text-amber-400 transition-colors">
              <Icon size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-black text-slate-800 dark:text-white">{t(`sellerOrders.yandexTariffModal.${labelKey}`)}</span>
              <span className="block text-[11px] leading-4 text-slate-400 dark:text-slate-500 font-medium mt-0.5">{t(`sellerOrders.yandexTariffModal.${descKey}`)}</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-amber-500 transition-colors" />
          </button>
        ))}
      </div>
    </Sheet>
  );
};

export default YandexTariffModal;
