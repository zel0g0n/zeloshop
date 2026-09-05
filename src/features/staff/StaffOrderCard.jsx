import { memo, useState } from "react";
import { PhoneCall, MapPin, X, ChevronDown, Check, Loader2, Truck, Bike, Clock, RefreshCw, ReceiptText, Layers } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { formatDeliverySlotAbsolute } from "@/utils/deliverySlots";
import changeOrderStatus from "@/services/orders/changeOrderStatus";
import { getOrderStatusInfo, NEXT_STATUS_ACTION, CAN_CANCEL_STATUSES } from "@/constants/orderStatus";
import { formatRelativeTime } from "@/utils/relativeTime";
import { assignOrderToCourier, resendTrackingLink } from "@/services/couriers/courierManagement";
import { isCourierAssignedPending, isCourierActiveDelivery } from "@/utils/orderCourierLogic";
import CancelReasonModal from "@/features/seller/components/order/CancelReasonModal";
import CourierPickerModal from "@/features/seller/components/order/CourierPickerModal";

// Sotuvchi tomonidagi `sellerOrders.*` bilan bir xil - kuryer holati
// yorlig'i uchun (qarang: `OrderCard.jsx`dagi izoh).
const COURIER_DELIVERY_STATUS_LABEL_KEYS = {
  assigned: "courierStatusAssigned",
  picked_up: "courierStatusPickedUp",
  delivered: "courierStatusDelivered",
  failed: "courierStatusFailed",
};

/**
 * `order/OrderCard.jsx`ning xodim Mini App'i uchun LEAN nusxasi.
 *
 * ATAYLAB OLIB TASHLANGAN: Yandex kuryer chaqirish (bu ATAYLAB
 * BUTUN platformada o'chirilgan — `src/config/platformFlags.js`,
 * 13-band). Shaxsiy kuryerga biriktirish esa ENDI (2026-09
 * punkt-royxati, 3/10-bandlar) MAVJUD — lekin FAQAT `manageCouriers`
 * ruxsatiga ega xodimga (`canManageCouriers` prop).
 *
 * MUHIM TUZATISH (10-band, "kuryer dispetcherligi ishlamayapti"):
 * OLDIN, "processing" bosqichidagi yagona tugma to'g'ridan-to'g'ri
 * `changeOrderStatus(order.id, "shipped")`ni chaqirar edi — bu HECH
 * QANDAY kuryerni BIRIKTIRMASDAN, buyurtmani "yo'lda" deb belgilab
 * qo'yardi (kuryerga hech qanday xabar bormas, `courierId` hech qachon
 * yozilmas edi). Endi, sotuvchining O'ZI ishlatadigan
 * `assignOrderToCourier` Cloud Function'i orqali, HAQIQIY kuryerga
 * topshiriladi (`functions/lib/staffAccess.js` orqali xodim ham
 * ruxsat etilgan bo'lsa shu funksiyani chaqira oladi).
 *
 * `useChangeOrderStatus` (Redux hook) O'RNIGA `changeOrderStatus.js`
 * xizmatining O'ZI to'g'ridan-to'g'ri chaqiriladi — xodim Mini App'ida
 * Redux `store` mavjud emas.
 */
const StaffOrderCard = ({ order, orderNumber, canManageCouriers = false, couriers = [], staffId = null, staffName = null }) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const statusInfo = getOrderStatusInfo(order.status);
  const rawNextAction = NEXT_STATUS_ACTION[order.status];
  // "handToCourier" - buyurtmani kuryerga TOPSHIRISH bosqichi. Xodimda
  // `manageCouriers` ruxsati YO'Q bo'lsa, bu amal UMUMAN
  // ko'rsatilmaydi (status to'g'ridan-to'g'ri "shipped"ga
  // o'zgartirilishiga YO'L QO'YILMAYDI - yuqoridagi izohga qarang).
  const nextAction = rawNextAction?.labelKey === "handToCourier" && !canManageCouriers ? null : rawNextAction;
  const canCancel = CAN_CANCEL_STATUSES.includes(order.status);

  const [pendingAction, setPendingAction] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCourierPickerModal, setShowCourierPickerModal] = useState(false);
  const [courierAssigning, setCourierAssigning] = useState(false);
  const [courierError, setCourierError] = useState(null);
  const [resendPending, setResendPending] = useState(false);
  const [resendError, setResendError] = useState(null);
  const [resendSuccess, setResendSuccess] = useState(false);

  const courierAssignedPending = isCourierAssignedPending(order);
  const courierActiveDelivery = isCourierActiveDelivery(order);

  const customer = order.customer || {};
  // Haqiqiy tanlangan to'lov usulidan (`order.paymentMethod`) olinadi -
  // "ruxsat etilgan turlar" to'plamidan EMAS (batafsili: `OrderCard.jsx`
  // - sotuvchi ko'rinishidagi bir xil tuzatish).
  const paymentLabel = order.paymentMethod === "card"
    ? t("sellerOrders.paymentTypePrepay")
    : t("sellerOrders.paymentTypeCod");

  // `lastActionByStaffId`/`lastActionByStaffName` — 2026-09
  // punkt-royxati, 11-band ("xodim/kuryer boshqaruv sahifalarida
  // faoliyat statistikasi"). `changeOrderStatus.js` xizmati
  // (sotuvchi VA xodim uchun UMUMIY) allaqachon ixtiyoriy
  // `extraFields` parametrini qabul qiladi - shuning uchun bu yerda
  // xizmatning o'ziga TEGMASDAN, faqat shu ikki maydonni qo'shib
  // yuborish yetarli. `firestore.rules`dagi `orders/{orderId}`
  // yangilash qoidasiga ham shu ikki kalit qo'shilgan.
  const staffAttributionFields = staffId ? { lastActionByStaffId: staffId, lastActionByStaffName: staffName || null } : {};

  const handleAdvanceStatus = async () => {
    if (!nextAction || pendingAction) return;
    setPendingAction(true);
    setActionError(null);
    try {
      await changeOrderStatus(order.id, nextAction.next, staffAttributionFields);
    } catch (err) {
      setActionError(err.message || t("sellerOrders.errorAdvanceStatus"));
    } finally {
      setPendingAction(false);
    }
  };

  // "Kuryerga topshirish" bosqichida to'g'ridan-to'g'ri status
  // o'zgartirilmaydi - avval kuryer tanlash oynasi ochiladi (status
  // o'zgarishi `assignOrderToCourier` tomonidan avtomatik amalga
  // oshiriladi, xuddi sotuvchi tomonidagi bilan bir xil).
  const handlePrimaryAction = () => {
    if (nextAction?.labelKey === "handToCourier") {
      setShowCourierPickerModal(true);
      return;
    }
    handleAdvanceStatus();
  };

  const handleAssignCourier = async (courierId) => {
    if (courierAssigning) return;
    setCourierAssigning(true);
    setCourierError(null);
    try {
      await assignOrderToCourier(order.id, courierId);
      setShowCourierPickerModal(false);
    } catch (err) {
      setCourierError(err.message || t("sellerOrders.errorAssignCourier"));
    } finally {
      setCourierAssigning(false);
    }
  };

  // Asosiy yo'l - kuryer "Boshladim" bosganda kuzatuv havolasi
  // mijozga avtomatik yuboriladi; bu FAQAT zaxira/qo'lda qayta
  // yuborish uchun (`OrderCard.jsx`dagi bilan bir xil naqsh).
  const handleResendTrackingLink = async (e) => {
    e.stopPropagation();
    if (resendPending) return;
    setResendPending(true);
    setResendError(null);
    setResendSuccess(false);
    try {
      await resendTrackingLink(order.id);
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 2500);
    } catch (err) {
      setResendError(err.message || t("sellerOrders.resendTrackingLinkError"));
    } finally {
      setResendPending(false);
    }
  };

  const handleConfirmCancel = async (reason) => {
    setPendingAction(true);
    setActionError(null);
    try {
      await changeOrderStatus(order.id, "cancel", { cancelReason: reason, ...staffAttributionFields });
      setShowCancelModal(false);
    } catch (err) {
      setActionError(err.message || t("sellerOrders.errorCancel"));
    } finally {
      setPendingAction(false);
    }
  };

  const mapUrl = customer.location
    ? `https://www.openstreetmap.org/?mlat=${customer.location.lat}&mlon=${customer.location.lng}#map=17/${customer.location.lat}/${customer.location.lng}`
    : `https://www.google.com/maps/search/${encodeURIComponent(customer.address || "")}`;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100/80 dark:border-slate-800 p-4 space-y-3 shadow-sm">
      <div className="flex items-start justify-between gap-2 cursor-pointer" onClick={() => setIsOpen((v) => !v)}>
        <div>
          <span className="font-bold text-[#514be3] dark:text-[#8b85f5] text-sm">#{orderNumber}</span>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">{formatRelativeTime(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${statusInfo.color}`}>
            {t(`orderStatus.${statusInfo.key}`)}
          </span>
          <ChevronDown size={15} className={`text-gray-400 dark:text-slate-500 transition-transform ${isOpen ? "rotate-180 text-[#514be3] dark:text-[#8b85f5]" : ""}`} />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600 dark:text-slate-300 font-medium">{customer.fullName || t("sellerOrders.unknownCustomer")}</span>
        <span className="font-black text-gray-800 dark:text-white">{Number(order.totalAmount).toLocaleString()} so'm</span>
      </div>
      <span className="inline-block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md">
        {paymentLabel}
      </span>
      {order.courierId && (
        <span className="inline-flex items-center gap-1 ml-1.5 text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 px-2 py-0.5 rounded-md">
          {order.courierDeliveryStatus === "assigned" ? <Clock size={10} /> : <Bike size={10} />}
          {t("sellerOrders.courierBadgeLabel", { name: order.courierName || "" })}
          {order.courierDeliveryStatus ? ` · ${t(`sellerOrders.${COURIER_DELIVERY_STATUS_LABEL_KEYS[order.courierDeliveryStatus] || "courierStatusAssigned"}`)}` : ""}
        </span>
      )}
      {order.deliveryTimeSlot && (
        <span className="inline-flex items-center gap-1 ml-1.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md">
          <Clock size={10} />
          {t("sellerOrders.deliveryTimeSlotBadge", {
            range: formatDeliverySlotAbsolute({ startMs: order.deliveryTimeSlot.start, endMs: order.deliveryTimeSlot.end }),
          })}
        </span>
      )}

      {isOpen && (
        <div className="pt-2 space-y-3 border-t border-dashed border-gray-100 dark:border-slate-700">
          <div className="bg-gray-50/60 dark:bg-slate-800/60 rounded-xl p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase mb-0.5">{t("sellerOrders.phoneLabel")}</p>
                <p className="text-xs font-bold text-gray-700 dark:text-slate-200">{customer.phone || t("sellerOrders.unknownPhone")}</p>
              </div>
              {customer.phone && (
                <a href={`tel:${customer.phone}`} onClick={(e) => e.stopPropagation()} className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <PhoneCall size={14} />
                </a>
              )}
            </div>
            <div className="border-t border-gray-100 dark:border-slate-700 pt-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase">{t("sellerOrders.fullAddress")}</p>
                <a href={mapUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <MapPin size={12} />
                </a>
              </div>
              <p className="text-xs text-gray-700 dark:text-slate-200 font-medium leading-relaxed">{customer.address}</p>
            </div>
          </div>

          {/* Karta orqali to'langan buyurtmalar uchun - mijoz
              yuklagan to'lov cheki skrinshoti (2026-09 punkt-royxati,
              14-band, sotuvchi tomonidagi `OrderCard.jsx` bilan bir
              xil naqsh). */}
          {order.paymentMethod === "card" && order.paymentReceiptUrl && (
            <a
              href={order.paymentReceiptUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-2.5"
            >
              <img src={order.paymentReceiptUrl} alt="chek" className="w-11 h-11 rounded-lg object-cover shrink-0 border border-amber-200 dark:border-amber-500/30" />
              <div className="min-w-0">
                <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase flex items-center gap-1">
                  <ReceiptText size={11} /> {t("sellerOrders.paymentReceiptLabel")}
                </p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400/80">{t("sellerOrders.paymentReceiptHint")}</p>
              </div>
            </a>
          )}

          {order.installmentPlan && (
            <div className="bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 rounded-xl p-2.5 space-y-2">
              <p className="text-[10px] font-black text-violet-700 dark:text-violet-400 uppercase flex items-center gap-1">
                <Layers size={11} />
                {t("sellerOrders.installmentProgress", { paid: order.installmentPlan.partsPaid, total: order.installmentPlan.totalParts })}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(order.installmentPlan.payments || []).map((payment) => (
                  <a
                    key={payment.index}
                    href={payment.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-500/30 rounded-lg px-2 py-1"
                  >
                    <img src={payment.receiptUrl} alt="chek" className="w-6 h-6 rounded object-cover shrink-0" />
                    <span className="text-[10px] font-bold text-violet-700 dark:text-violet-300">
                      {t("sellerOrders.installmentPartLabel", { n: payment.index + 1 })}: {Number(payment.amount).toLocaleString()} so'm
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase px-1">{t("sellerOrders.orderContents")} ({order.orders?.length || 0} {t("sellerOrders.itemQtySuffix")})</p>
            <div className="bg-gray-50/60 dark:bg-slate-800/60 rounded-xl p-2 space-y-2">
              {order.orders?.map((item, index) => (
                <div key={item.id || index} className="flex items-center gap-3 rounded-xl bg-white dark:bg-slate-900 px-3 py-2 shadow-sm border border-gray-100 dark:border-slate-700">
                  <img src={item.image || "/placeholder.png"} alt={item.name} className="w-12 h-12 rounded-xl object-cover bg-gray-100 dark:bg-slate-800 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-bold text-gray-800 dark:text-white truncate">{item.name}</h4>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                      {Number(item.price).toLocaleString()} so'm x <span className="font-black text-indigo-600 dark:text-indigo-400">{item.quantity} {t("sellerOrders.itemQtySuffix")}</span>
                    </p>
                  </div>
                  <p className="text-[12px] font-bold text-[#3B5BFF] dark:text-[#7c8fff] shrink-0">
                    {(item.price * item.quantity).toLocaleString()} so'm
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {actionError && <p className="text-[11px] text-rose-500 font-semibold">{actionError}</p>}
            {courierError && <p className="text-[11px] text-rose-500 font-semibold">{courierError}</p>}
            {(courierAssignedPending || courierActiveDelivery) && resendError && <p className="text-[11px] text-rose-500 font-semibold">{resendError}</p>}

            {/* Kuryer biriktirilgan, lekin hali "Boshladim" bosmagan. */}
            {courierAssignedPending ? (
              <>
                <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3 flex items-center gap-2.5">
                  <Clock size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">{t("sellerOrders.courierPendingLabel")}</p>
                    <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 font-medium">{t("sellerOrders.courierPendingHint")}</p>
                  </div>
                </div>
                {canCancel && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    disabled={pendingAction}
                    className="w-full py-2.5 border border-red-100 dark:border-red-500/20 text-red-500 rounded-xl text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                  >
                    <X size={14} /> {t("sellerOrders.cancelButton")}
                  </button>
                )}
              </>
            ) : courierActiveDelivery ? (
              /* Kuryer haqiqatan yo'lda - kuzatuv havolasi mijozga
                 allaqachon avtomatik yuborilgan, bu yerda faqat qayta
                 yuborish imkoni. */
              <>
                <div className="bg-teal-50 dark:bg-teal-500/10 rounded-xl p-3 flex items-center gap-2.5">
                  <Bike size={16} className="text-teal-600 dark:text-teal-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wide">{t("sellerOrders.courierActiveLabel")}</p>
                    <p className="text-[11px] text-teal-700/80 dark:text-teal-400/80 font-medium">{t("sellerOrders.courierActiveHint")}</p>
                  </div>
                </div>
                {canManageCouriers && (
                  <button
                    type="button"
                    onClick={handleResendTrackingLink}
                    disabled={resendPending}
                    className="w-full h-10 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md shadow-teal-600/10 flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {resendPending ? <Loader2 size={13} className="animate-spin" /> : resendSuccess ? <Check size={14} /> : <RefreshCw size={13} />}
                    {resendSuccess ? t("sellerOrders.resendTrackingLinkSuccess") : t("sellerOrders.resendTrackingLinkButton")}
                  </button>
                )}
                {canCancel && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    disabled={pendingAction}
                    className="w-full py-2.5 border border-red-100 dark:border-red-500/20 text-red-500 rounded-xl text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                  >
                    <X size={14} /> {t("sellerOrders.cancelButton")}
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                {nextAction && (
                  <button
                    onClick={handlePrimaryAction}
                    disabled={pendingAction}
                    className="flex-1 py-2.5 bg-[#514be3] hover:bg-[#433cc7] text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 dark:shadow-none disabled:opacity-60 flex items-center justify-center gap-1.5"
                  >
                    {pendingAction ? <Loader2 size={13} className="animate-spin" /> : order.status === "processing" ? <Truck size={14} /> : <Check size={14} strokeWidth={2.5} />}
                    {pendingAction ? "..." : t(`orderStatus.actions.${nextAction.labelKey}`)}
                  </button>
                )}
                {canCancel && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    disabled={pendingAction}
                    className="px-3 py-2.5 border border-red-100 dark:border-red-500/20 text-red-500 rounded-xl text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-60 flex items-center gap-1.5"
                  >
                    <X size={14} /> {t("sellerOrders.cancelButton")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showCancelModal && (
        <CancelReasonModal
          busy={pendingAction}
          onConfirm={handleConfirmCancel}
          onClose={() => setShowCancelModal(false)}
        />
      )}

      {showCourierPickerModal && (
        <CourierPickerModal
          couriers={couriers}
          busy={courierAssigning}
          onSelect={handleAssignCourier}
          onClose={() => setShowCourierPickerModal(false)}
          hideManageButton
          emptyDescKey="staffApp.courierPickerEmptyDesc"
        />
      )}
    </div>
  );
};

export default memo(StaffOrderCard);
