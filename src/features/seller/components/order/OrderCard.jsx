import { memo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebase/config';
import { useLanguage } from '@/context/LanguageContext';
import { useSession } from '@/context/SessionContext';
import { PhoneCall, Send, Copy, MapPin, Truck, X, CheckCircle2, ChevronDown, Check, Loader2, Bike, Clock, RefreshCw, ReceiptText, Layers, AlertCircle } from 'lucide-react';
import useChangeOrderStatus from '@/hooks/seller/useChangeOrderStatus';
import { getOrderStatusInfo, NEXT_STATUS_ACTION, CAN_CANCEL_STATUSES } from '@/constants/orderStatus';
import { formatRelativeTime } from '@/utils/relativeTime';
import { assignOrderToCourier, resendTrackingLink } from '@/services/couriers/courierManagement';
import { canDispatchYandex, isCourierAssignedPending, isCourierActiveDelivery, YANDEX_STATUS_LABEL_KEYS } from '@/utils/orderCourierLogic';
import { formatDeliverySlotAbsolute } from '@/utils/deliverySlots';
import CancelReasonModal from './CancelReasonModal';
import YandexTariffModal from './YandexTariffModal';
import CourierPickerModal from './CourierPickerModal';

// Kuryer yetkazma statusi (`order.courierDeliveryStatus`) uchun
// tarjima kaliti — `sellerOrders.*` ostida joylashgan, chunki kuryer
// bot/ilova o'zining alohida `courierApp.*` kalitlaridan foydalanadi;
// bu yerdagi kalitlar faqat sotuvchi tomonidagi ko'rinish uchun.
const COURIER_DELIVERY_STATUS_LABEL_KEYS = {
  assigned: "courierStatusAssigned",
  picked_up: "courierStatusPickedUp",
  delivered: "courierStatusDelivered",
  failed: "courierStatusFailed",
};

const OrderRow = ({ order, orderNumber, isSelected, onToggleSelect, onCopied, couriers = [], defaultOpen = false, hideSelect = false, variant = 'card' }) => {
  const isPanel = variant === 'panel';
  const { t } = useLanguage();
  const { store } = useSession();
  const [isOpenState, setIsOpen] = useState(defaultOpen);
  const isOpen = isPanel || isOpenState;
  const { changeOrderStatus } = useChangeOrderStatus();
  const statusInfo = getOrderStatusInfo(order.status);
  const nextAction = NEXT_STATUS_ACTION[order.status];
  const canCancel = CAN_CANCEL_STATUSES.includes(order.status);

  const [pendingAction, setPendingAction] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [yandexDispatching, setYandexDispatching] = useState(false);
  const [yandexError, setYandexError] = useState(null);
  const [showYandexTariffModal, setShowYandexTariffModal] = useState(false);
  const [showCourierPickerModal, setShowCourierPickerModal] = useState(false);
  const [courierAssigning, setCourierAssigning] = useState(false);
  const [courierError, setCourierError] = useState(null);
  const [resendPending, setResendPending] = useState(false);
  const [resendError, setResendError] = useState(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const navigate = useNavigate();

  const customer = order.customer || {};
  // OLDIN: bu yorliq `customer.paymentTypes` (savat/do'kon uchun
  // RUXSAT ETILGAN turlar to'plami) asosida hisoblanardi - shuning
  // uchun sotuvchi ikkalasini ham yoqqan bo'lsa, mijoz AYNAN qaysi
  // birini tanlaganidan qat'i nazar, HAR DOIM "Oldindan / Yetkazilganda"
  // (ikkalasi ham) ko'rsatilardi. ENDI to'g'ridan-to'g'ri buyurtmaning
  // O'ZIDA saqlangan HAQIQIY tanlovdan (`order.paymentMethod`, 2026-09
  // punkt-royxati 14-band) olinadi - aniq va ishonchli.
  const paymentLabel = order.paymentMethod === "card"
    ? t("sellerOrders.paymentTypePrepay")
    : t("sellerOrders.paymentTypeCod");

  const handleAdvanceStatus = async () => {
    if (!nextAction || pendingAction) return;
    setPendingAction(true);
    setActionError(null);
    try {
      await changeOrderStatus(order.id, nextAction.next);
    } catch (err) {
      setActionError(err.message || t("sellerOrders.errorAdvanceStatus"));
    } finally {
      setPendingAction(false);
    }
  };

  // "Yig'ilmoqda" bosqichida ("handToCourier" yorlig'i bilan) tugma
  // bosilganda, status to'g'ridan-to'g'ri o'zgartirilmaydi — avval
  // kuryer tanlash oynasi ochiladi. Status o'zgarishi kuryer
  // biriktirilgach, backend (`assignOrderToCourier`) tomonidan
  // avtomatik amalga oshiriladi.
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

  const handleConfirmCancel = async (reason) => {
    setPendingAction(true);
    setActionError(null);
    try {
      await changeOrderStatus(order.id, "cancel", { cancelReason: reason });
      setShowCancelModal(false);
    } catch (err) {
      setActionError(err.message || t("sellerOrders.errorCancel"));
    } finally {
      setPendingAction(false);
    }
  };

  const handleCopyForCourier = (e) => {
    e.stopPropagation();
    const text = `${t("sellerOrders.courierOrderNumber", { number: orderNumber })}\n${t("sellerOrders.courierCustomer")} ${customer.fullName || t("sellerOrders.unknownCustomer")}\n${t("sellerOrders.courierPhone")} ${customer.phone || t("sellerOrders.unknownPhone")}\n${t("sellerOrders.courierAddress")} ${customer.address || t("sellerOrders.notSpecified")}`;
    navigator.clipboard?.writeText(text).then(() => onCopied?.());
  };

  // Asosiy yo'l — kuryer "Boshladim" bosganda kuzatuv havolasi
  // mijozga avtomatik yuboriladi (`functions/couriers.js`dagi
  // `applyCourierOrderAction`). Bu tugma faqat zaxira/qo'lda qayta
  // yuborish uchun (masalan, birinchi xabar yetib bormagan yoki
  // mijoz havolani yo'qotgan bo'lsa).
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

  const handleDispatchYandex = async (taxiClass) => {
    setShowYandexTariffModal(false);
    setYandexDispatching(true);
    setYandexError(null);
    try {
      const dispatch = httpsCallable(functions, "dispatchYandexDelivery");
      await dispatch({ orderId: order.id, taxiClass });
    } catch (err) {
      setYandexError(err.message || t("sellerOrders.yandexDispatchError"));
    } finally {
      setYandexDispatching(false);
    }
  };

  // Yandex kuryerini faqat "Yig'ilmoqda" (processing) bosqichida,
  // ya'ni "Tasdiqlash va Yig'ish" bosilgach, chaqirish mumkin —
  // "Yangi" bosqichida ko'rsatilishi buyurtma hali tasdiqlanmasdan
  // turib kuryer chaqirishga imkon bergan bo'lardi. Shuningdek,
  // `order.status` kuryer biriktirilganda darhol "shipped"ga
  // o'tmaydi — kuryer "Boshladim" bosgunicha "processing" bo'lib
  // qoladi, shuning uchun `canDispatchYandex`ga `!order.courierId`
  // sharti qo'shilgan (aks holda allaqachon biriktirilgan buyurtma
  // uchun ham Yandex tugmasi ko'rinib qolardi). Bu shart mantig'i
  // `src/utils/orderCourierLogic.js`da, komponentdan alohida
  // sinaladi.
  const canDispatch = canDispatchYandex(order, store);
  // Kuryer biriktirilgan, lekin hali "Boshladim" bosmagan — buyurtma
  // hali jismonan yo'lga chiqmagan, shuning uchun oddiy "keyingi
  // bosqich" tugmasi o'rniga kutish paneli ko'rsatiladi (soatcha
  // ikonkasi bilan).
  const courierAssignedPending = isCourierAssignedPending(order);
  // Kuryer haqiqatan yo'lda — kuzatuv havolasi allaqachon avtomatik
  // yuborilgan, bu yerda faqat qayta yuborish imkoni beriladi.
  const courierActiveDelivery = isCourierActiveDelivery(order);

  const mapUrl = customer.location
    ? `https://www.openstreetmap.org/?mlat=${customer.location.lat}&mlon=${customer.location.lng}#map=17/${customer.location.lat}/${customer.location.lng}`
    : `https://www.google.com/maps/search/${encodeURIComponent(customer.address || "")}`;

  // HARAKAT TUGMALARI (telefon kartasi VA kompyuter paneli uchun yagona
  // dizayn). Kompyuter paneli (`variant="panel"`)da tugmalar skroll
  // bo'ladigan mazmundan ALOHIDA, panelning pastiga qadalgan
  // (`shrink-0`) bo'limda turadi — buyurtmada nechta mahsulot bo'lishidan
  // qat'i nazar, "Kuryer chaqirish" / "Kuryerga topshirish" /
  // "Bekor qilish" doim ko'rinib turadi. Tugmalar bir xil balandlikda
  // (h-11), to'liq kenglikda, ustma-ust joylashadi (matn ikki qatorga
  // o'tib ketmaydi).
  const panelErrors = [
    actionError,
    canDispatch ? yandexError : null,
    courierError,
    (courierAssignedPending || courierActiveDelivery) ? resendError : null,
  ].filter(Boolean);

  const btnBase = "w-full h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed";
  const btnPrimary = `${btnBase} bg-[#514be3] hover:bg-[#433cc7] text-white shadow-sm shadow-indigo-200/60 dark:shadow-none`;
  const btnSecondary = `${btnBase} bg-indigo-50 hover:bg-indigo-100 text-[#514be3] dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 dark:text-indigo-300`;
  const btnTeal = `${btnBase} bg-teal-600 hover:bg-teal-700 text-white`;
  const btnOutline = `${btnBase} border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800`;
  const btnDanger = `${btnBase} h-10 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10`;

  const cancelButton = canCancel && (
    <button type="button" onClick={() => setShowCancelModal(true)} disabled={pendingAction} className={btnDanger}>
      <X size={14} /> {t("sellerOrders.cancelButton")}
    </button>
  );

  const infoStrip = (tone, Icon, label, hint) => {
    const tones = {
      amber: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400",
      teal: "bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400",
    };
    return (
      <div className={`rounded-xl px-3 py-2.5 flex items-center gap-2.5 ${tones[tone]}`}>
        <Icon size={16} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide">{label}</p>
          <p className="text-[11px] font-medium opacity-80">{hint}</p>
        </div>
      </div>
    );
  };

  const panelActions = (
    <div className="space-y-2">
      {panelErrors.map((message, i) => (
        <div key={i} role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2.5 text-rose-600 dark:text-rose-400">
          <AlertCircle size={15} className="shrink-0 mt-px" />
          <p className="text-[11.5px] leading-4 font-semibold break-words min-w-0">{message}</p>
        </div>
      ))}

      {courierAssignedPending ? (
        <>
          {infoStrip("amber", Clock, t("sellerOrders.courierPendingLabel"), t("sellerOrders.courierPendingHint"))}
          {cancelButton}
        </>
      ) : courierActiveDelivery ? (
        <>
          {infoStrip("teal", Bike, t("sellerOrders.courierActiveLabel"), t("sellerOrders.courierActiveHint"))}
          <button type="button" onClick={handleResendTrackingLink} disabled={resendPending} className={btnTeal}>
            {resendPending ? <Loader2 size={14} className="animate-spin" /> : resendSuccess ? <Check size={14} /> : <RefreshCw size={14} />}
            {resendSuccess ? t("sellerOrders.resendTrackingLinkSuccess") : t("sellerOrders.resendTrackingLinkButton")}
          </button>
          {nextAction && (
            <button type="button" onClick={handlePrimaryAction} disabled={pendingAction} className={btnOutline}>
              <CheckCircle2 size={14} />
              {pendingAction ? "..." : t(`orderStatus.actions.${nextAction.labelKey}`)}
            </button>
          )}
          {cancelButton}
        </>
      ) : canDispatch && nextAction ? (
        <>
          <button type="button" onClick={() => setShowYandexTariffModal(true)} disabled={yandexDispatching} className={btnPrimary}>
            {yandexDispatching ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
            {yandexDispatching ? t("sellerOrders.yandexDispatching") : t("sellerOrders.yandexDispatchButton")}
          </button>
          <button type="button" onClick={handlePrimaryAction} disabled={pendingAction} className={btnSecondary}>
            <Bike size={14} />
            {pendingAction ? "..." : t(`orderStatus.actions.${nextAction.labelKey}`)}
          </button>
          {cancelButton}
        </>
      ) : (
        <>
          {nextAction && (
            <button type="button" onClick={handlePrimaryAction} disabled={pendingAction} className={btnPrimary}>
              {order.status === "shipped" ? <CheckCircle2 size={14} /> : order.status === "processing" ? <Truck size={14} /> : <Check size={14} strokeWidth={2.5} />}
              {pendingAction ? "..." : t(`orderStatus.actions.${nextAction.labelKey}`)}
            </button>
          )}
          {cancelButton}
        </>
      )}
    </div>
  );

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 space-y-3 transition-all shadow-sm ${isPanel ? "overflow-y-auto overscroll-contain" : ""} ${isSelected ? "border-indigo-400 ring-1 ring-indigo-300 dark:ring-indigo-500/40" : "border-gray-100/80 dark:border-slate-800"}`}
      style={isPanel ? { maxHeight: "var(--panel-max-h, calc(100vh - 6.5rem))" } : undefined}>

      <div className={`flex items-start justify-between gap-2 ${isPanel ? "" : "cursor-pointer"}`} onClick={isPanel ? undefined : () => setIsOpen((v) => !v)}>
        <div className="flex items-start gap-2.5">
          {!hideSelect && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleSelect(order.id); }}
              className={`shrink-0 mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? "bg-indigo-600 border-indigo-600" : "border-slate-300 dark:border-slate-600"}`}
              aria-label={t("sellerOrders.select")}
            >
              {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
            </button>
          )}
          <div>
            <span className="font-bold text-[#514be3] dark:text-[#8b85f5] text-sm">#{orderNumber}</span>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">{formatRelativeTime(order.createdAt)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${statusInfo.color}`}>
            {t(`orderStatus.${statusInfo.key}`)}
          </span>
          {!isPanel && <ChevronDown size={15} className={`text-gray-400 dark:text-slate-500 transition-transform ${isOpen ? "rotate-180 text-[#514be3] dark:text-[#8b85f5]" : ""}`} />}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600 dark:text-slate-300 font-medium">{customer.fullName || t("sellerOrders.unknownCustomer")}</span>
        <span className="font-black text-gray-800 dark:text-white">{Number(order.totalAmount).toLocaleString()} so'm</span>
      </div>
      <span className="inline-block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md">
        {paymentLabel}
      </span>
      {order.deliveryZone && (
        <span className="inline-flex items-center gap-1 ml-1.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-md">
          <Truck size={10} /> {order.deliveryZone.isFree ? t("sellerOrders.freeDeliveryBadge") : t("sellerOrders.paidDeliveryBadge", { amount: Number(order.deliveryZone.price).toLocaleString() })}
        </span>
      )}
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
                <div className="flex items-center gap-1.5">
                  <a href={`tel:${customer.phone}`} onClick={(e) => e.stopPropagation()} className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <PhoneCall size={14} />
                  </a>
                  <a href={`tg://user?id=${order.clientId}`} onClick={(e) => e.stopPropagation()} className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Send size={14} />
                  </a>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 dark:border-slate-700 pt-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase">{t("sellerOrders.fullAddress")}</p>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={handleCopyForCourier} className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Copy size={12} />
                  </button>
                  <a href={mapUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <MapPin size={12} />
                  </a>
                </div>
              </div>
              <p className="text-xs text-gray-700 dark:text-slate-200 font-medium leading-relaxed">{customer.address}</p>
            </div>
          </div>

          {/* Karta orqali to'langan buyurtmalar uchun — mijoz yuklagan
              to'lov cheki skrinshoti. Sotuvchi buni "Tasdiqlash"dan
              OLDIN ko'rib, pul o'zining kartasiga tushganini tekshirishi
              kerak (2026-09 punkt-royxati, 14-band — qo'lda
              tekshirish bosqichi). */}
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

          {/* "BO'LIB TO'LASH" - mijoz bir necha qismda to'layotgan
              bo'lsa, sotuvchiga HAR BIR qismning cheki va umumiy
              progress ko'rsatiladi (yuqoridagi yagona `paymentReceiptUrl`
              faqat BIRINCHI qismni ko'rsatadi). */}
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

          {/* Yandex delivery — bosilganda to'liq holat sahifasiga
              o'tkaziladi (stepper + kuryer kartochkasi bilan), shunchaki
              "qidirilmoqda..." matni bilan chegaralanmaydi. */}
          {order.yandexClaimId ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); navigate(`/seller/orders/${order.id}/yandex-delivery`, { state: { initialStatus: order.yandexStatus } }); }}
              className="w-full bg-blue-50 dark:bg-blue-500/10 rounded-xl p-3 flex items-center gap-2 text-left active:scale-[0.99] transition-transform"
            >
              <Truck size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">{t("sellerOrders.yandexDeliveryLabel")}</p>
                <p className="text-xs font-bold text-blue-800 dark:text-blue-300">
                  {t(`sellerOrders.${YANDEX_STATUS_LABEL_KEYS[order.yandexStatus] || "yandexStatusSearching"}`)}
                </p>
              </div>
              <span className="shrink-0 text-[10px] font-bold text-blue-600 dark:text-blue-400 underline underline-offset-2">
                {t("sellerOrders.yandexModal.openButton")}
              </span>
            </button>
          ) : null}

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

          {/* Umumiy hisob-kitob: mahsulotlar summasi + yetkazib berish
              narxi = yakuniy summa — mijoz nima uchun qancha
              to'laganini aniq ko'rsatish uchun. */}
          <div className="bg-gray-50/60 dark:bg-slate-800/60 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-500 dark:text-slate-400 font-medium">{t("sellerOrders.productsTotal")}</span>
              <span className="text-gray-700 dark:text-slate-200 font-bold">
                {(order.orders || []).reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0).toLocaleString()} so'm
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-500 dark:text-slate-400 font-medium">{t("sellerOrders.delivery")}</span>
              <span className="text-gray-700 dark:text-slate-200 font-bold">
                {order.deliveryZone && !order.deliveryZone.isFree
                  ? `${Number(order.deliveryZone.price).toLocaleString()} so'm`
                  : t("sellerOrders.free")}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-dashed border-gray-200 dark:border-slate-700">
              <span className="text-gray-700 dark:text-slate-200 font-black">{t("sellerOrders.finalTotal")}</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-black">{Number(order.totalAmount).toLocaleString()} so'm</span>
            </div>
          </div>

          {!isPanel && <div className="pt-1">{panelActions}</div>}
        </div>
      )}

      {isPanel && (
        <div className="sticky bottom-0 z-10 -mx-4 -mb-4 px-4 pt-3 pb-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shadow-[0_-8px_16px_-12px_rgba(15,23,42,0.18)]">
          {panelActions}
        </div>
      )}

      {showCancelModal && (
        <CancelReasonModal
          busy={pendingAction}
          onConfirm={handleConfirmCancel}
          onClose={() => setShowCancelModal(false)}
        />
      )}

      {showYandexTariffModal && (
        <YandexTariffModal
          busy={yandexDispatching}
          onSelect={handleDispatchYandex}
          onClose={() => setShowYandexTariffModal(false)}
        />
      )}

      {showCourierPickerModal && (
        <CourierPickerModal
          couriers={couriers}
          busy={courierAssigning}
          onSelect={handleAssignCourier}
          onClose={() => setShowCourierPickerModal(false)}
        />
      )}
    </div>
  );
};

export default memo(OrderRow);
