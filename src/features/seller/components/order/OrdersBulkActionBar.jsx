import { memo } from "react";
import { X, Truck, CheckCircle2, Ban, Trash2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { CAN_HIDE_STATUSES } from "@/constants/orderStatus";

// FOYDALANUVCHI SO'ROVI BILAN TUZATILDI (v34): OLDIN bu panel HAR
// DOIM barcha 3 tugmani (Tasdiqlash/Jo'natish/Bekor qilish) ko'rsatar
// edi — activeTab'dan qat'i nazar. Bu mantiqan xato edi: masalan
// "Yig'ilmoqda" bo'limida "Tasdiqlash" tugmasi keraksiz edi (buyurtma
// allaqachon tasdiqlangan), "Yo'lda" bo'limida esa na Tasdiqlash, na
// Jo'natish mantiqiy edi. Endi ko'rsatiladigan tugmalar `activeTab`ga
// (buyurtmaning HAQIQIY ish-jarayoni bosqichiga) qarab tanlanadi:
//   - "new" (Yangi): Tasdiqlash + Bekor qilish
//   - "processing" (Yig'ilmoqda): Jo'natish (kuryerga) + Bekor qilish
//   - "shipped" (Yo'lda): faqat Bekor qilish
//   - "delivered"/"cancel" (tarix): faqat "Tarixdan o'chirish" (haqiqiy
//     o'chirish EMAS - `bulkHideOrders` orqali ro'yxatdan yashirish,
//     hisob-kitoblarga ta'sir qilmaydi)
const OrdersBulkActionBar = ({ selectedCount, activeTab, onApprove, onShip, onCancel, onHide, onCancelReset, busy }) => {
  const { t } = useLanguage();
  const isHistoryTab = CAN_HIDE_STATUSES.includes(activeTab);

  return (
    <div className="sticky top-0 z-30 bg-indigo-600 text-white px-4 py-2.5 flex items-center justify-between rounded-2xl shadow-md mb-2.5 animate-fade-in">
      <div className="flex items-center gap-2">
        <button onClick={onCancelReset} className="w-6 h-6 rounded-full bg-white/15 text-white flex items-center justify-center" aria-label={t("sellerProducts.bulkCancel")}>
          <X size={13} />
        </button>
        <span className="text-xs font-black">{t("sellerProducts.bulkSelected", { count: selectedCount })}</span>
      </div>

      <div className="flex items-center gap-1.5">
        {isHistoryTab ? (
          <button type="button" disabled={busy} onClick={onHide} title={t("sellerOrders.bulkHide")} className="w-8 h-8 rounded-lg bg-rose-500 flex items-center justify-center disabled:opacity-50">
            <Trash2 size={14} />
          </button>
        ) : (
          <>
            {activeTab === "new" && (
              <button type="button" disabled={busy} onClick={onApprove} title={t("sellerOrders.bulkApprove")} className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center disabled:opacity-50">
                <CheckCircle2 size={14} />
              </button>
            )}
            {activeTab === "processing" && (
              <button type="button" disabled={busy} onClick={onShip} title={t("orderStatus.actions.handToCourier")} className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center disabled:opacity-50">
                <Truck size={14} />
              </button>
            )}
            <button type="button" disabled={busy} onClick={onCancel} title={t("sellerOrders.bulkCancel")} className="w-8 h-8 rounded-lg bg-rose-500 flex items-center justify-center disabled:opacity-50">
              <Ban size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default memo(OrdersBulkActionBar);
