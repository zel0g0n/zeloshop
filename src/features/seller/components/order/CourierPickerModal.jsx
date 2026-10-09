import { useNavigate } from "react-router-dom";
import { Bike, ChevronRight, UserRound } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import Sheet from "@/components/ui/Sheet";

// KURYER TANLASH OYNASI (v39) — `YandexTariffModal.jsx`ning AYNAN BIR
// XIL bottom-sheet naqshiga qurilgan, lekin statik tariflar o'rniga
// sotuvchining O'Z FAOL kuryerlari ro'yxati ko'rsatiladi. Agar hali
// birorta ham faol kuryer bo'lmasa (yoki umuman kuryer qo'shilmagan
// bo'lsa), bo'sh holat ko'rsatiladi — sotuvchini to'g'ridan-to'g'ri
// "Kuryerlar" sozlamalar sahifasiga yo'naltiradigan tugma bilan.
// `hideManageButton`/`emptyDescKey` — XODIM Mini App'i (`StaffOrderCard.jsx`)
// shu MODALNI o'zgarishsiz qayta ishlatishi uchun (2026-09, 10-band:
// xodim uchun ISHLAYDIGAN kuryer dispetcherligi). Xodim "/seller/couriers"
// (sotuvchi sahifasi) ga o'ta olmaydi - kuryer qo'shish FAQAT sotuvchi
// huquqi, shuning uchun bo'sh holatda "Kuryerlar bo'limiga o'tish"
// tugmasi XODIM uchun YASHIRILADI, va tavsif matni ham (ixtiyoriy
// `emptyDescKey` orqali) xodimga mos, "sotuvchidan so'rang" ma'nosidagi
// matnga almashtiriladi.
const CourierPickerModal = ({ couriers = [], onSelect, onClose, busy, hideManageButton = false, emptyDescKey }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const activeCouriers = couriers.filter((c) => c.status === "active");

  return (
    <Sheet
      onClose={onClose}
      busy={busy}
      icon={Bike}
      accent="teal"
      size="sm"
      title={t("sellerOrders.courierPickerModal.title")}
      subtitle={activeCouriers.length > 0 ? t("sellerOrders.courierPickerModal.subtitle") : undefined}
    >
      {activeCouriers.length === 0 ? (
        <div className="text-center py-3 space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <UserRound size={24} />
          </div>
          <div className="space-y-1.5 px-2">
            <p className="text-[13px] font-black text-slate-800 dark:text-white">{t("sellerOrders.courierPickerModal.empty")}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {t(emptyDescKey || "sellerOrders.courierPickerModal.emptyDesc")}
            </p>
          </div>
          {!hideManageButton && (
            <button
              type="button"
              onClick={() => { onClose?.(); navigate("/seller/couriers"); }}
              className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs rounded-xl flex items-center justify-center transition-colors"
            >
              {t("sellerOrders.courierPickerModal.manageButton")}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {activeCouriers.map((courier) => (
            <button
              key={courier.id}
              type="button"
              disabled={busy}
              onClick={() => onSelect(courier.id)}
              className="group w-full flex items-center gap-3 text-left px-3.5 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-teal-300 hover:bg-teal-50/50 dark:hover:border-teal-500/40 dark:hover:bg-teal-500/5 disabled:opacity-50 active:scale-[0.99] transition-all"
            >
              <span className="shrink-0 w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-500/10 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <Bike size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-black text-slate-800 dark:text-white truncate">{courier.name}</span>
                {courier.phone && (
                  <span className="block text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 tabular-nums">{courier.phone}</span>
                )}
              </span>
              <ChevronRight size={16} className="shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-teal-500 transition-colors" />
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
};

export default CourierPickerModal;
