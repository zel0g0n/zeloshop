import { useNavigate } from "react-router-dom";
import { X, Bike } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";

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

  useEscapeToClose(onClose, !busy);

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-[440px] rounded-t-[28px] p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 dark:text-white">{t("sellerOrders.courierPickerModal.title")}</h3>
          <button type="button" onClick={onClose} disabled={busy} className="text-slate-400 dark:text-slate-500 disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        {activeCouriers.length === 0 ? (
          <div className="text-center py-4 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Bike size={22} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed px-2">
              {t("sellerOrders.courierPickerModal.empty")}
              <br />
              {t(emptyDescKey || "sellerOrders.courierPickerModal.emptyDesc")}
            </p>
            {!hideManageButton && (
              <button
                type="button"
                onClick={() => { onClose?.(); navigate("/seller/couriers"); }}
                className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs rounded-xl flex items-center justify-center"
              >
                {t("sellerOrders.courierPickerModal.manageButton")}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {activeCouriers.map((courier) => (
              <button
                key={courier.id}
                type="button"
                disabled={busy}
                onClick={() => onSelect(courier.id)}
                className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-2xl border border-transparent bg-[#F4F5F9] dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-50 active:scale-[0.99] transition-transform"
              >
                <span className="shrink-0 w-9 h-9 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center text-teal-600 dark:text-teal-400">
                  <Bike size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-black truncate">{courier.name}</span>
                  {courier.phone && (
                    <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">{courier.phone}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CourierPickerModal;
