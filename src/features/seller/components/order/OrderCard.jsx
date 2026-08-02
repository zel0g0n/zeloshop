import { memo, useState } from 'react';
import { PhoneCall, Send, Copy, MapPin, Truck, X, CheckCircle2, ChevronDown } from 'lucide-react';
import useChangeOrderStatus from '@/hooks/seller/useChangeOrderStatus';
import { getOrderStatusInfo, NEXT_STATUS_ACTION, CAN_CANCEL_STATUSES } from '@/constants/orderStatus';
import { formatRelativeTime } from '@/utils/relativeTime';
import CancelReasonModal from './CancelReasonModal';

const OrderRow = ({ order, orderNumber, isSelected, onToggleSelect, onCopied }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { changeOrderStatus } = useChangeOrderStatus();
  const statusInfo = getOrderStatusInfo(order.status);
  const nextAction = NEXT_STATUS_ACTION[order.status];
  const canCancel = CAN_CANCEL_STATUSES.includes(order.status);

  const [pendingAction, setPendingAction] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const customer = order.customer || {};
  const paymentTypes = Array.isArray(customer.paymentTypes) && customer.paymentTypes.length > 0
    ? customer.paymentTypes
    : ["prepay"];
  const paymentLabel = paymentTypes.includes("prepay") && paymentTypes.includes("cod")
    ? "Oldindan / Yetkazilganda"
    : paymentTypes.includes("cod")
    ? "Naqd (Yetkazilganda)"
    : "Oldindan to'lov";

  const handleAdvanceStatus = async () => {
    if (!nextAction || pendingAction) return;
    setPendingAction(true);
    setActionError(null);
    try {
      await changeOrderStatus(order.id, nextAction.next);
    } catch (err) {
      setActionError(err.message || "Statusni o'zgartirishda xatolik yuz berdi");
    } finally {
      setPendingAction(false);
    }
  };

  const handleConfirmCancel = async (reason) => {
    setPendingAction(true);
    setActionError(null);
    try {
      await changeOrderStatus(order.id, "cancel", { cancelReason: reason });
      setShowCancelModal(false);
    } catch (err) {
      setActionError(err.message || "Bekor qilishda xatolik yuz berdi");
    } finally {
      setPendingAction(false);
    }
  };

  const handleCopyForCourier = (e) => {
    e.stopPropagation();
    const text = `Buyurtma #${orderNumber}
Mijoz: ${customer.fullName || "Noma'lum"}
Telefon: ${customer.phone || "Yo'q"}
Manzil: ${customer.address || "Ko'rsatilmagan"}`;
    navigator.clipboard?.writeText(text).then(() => onCopied?.());
  };

  const mapUrl = customer.location
    ? `https://www.openstreetmap.org/?mlat=${customer.location.lat}&mlon=${customer.location.lng}#map=17/${customer.location.lat}/${customer.location.lng}`
    : `https://www.google.com/maps/search/${encodeURIComponent(customer.address || "")}`;

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 space-y-3 transition-all shadow-sm ${isSelected ? "border-indigo-400 ring-1 ring-indigo-300 dark:ring-indigo-500/40" : "border-gray-100/80 dark:border-slate-800"}`}>

      <div className="flex items-start justify-between gap-2 cursor-pointer" onClick={() => setIsOpen((v) => !v)}>
        <div className="flex items-start gap-2.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleSelect(order.id); }}
            className={`shrink-0 mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? "bg-indigo-600 border-indigo-600" : "border-slate-300 dark:border-slate-600"}`}
            aria-label="Tanlash"
          >
            {isSelected && <span className="text-white text-[10px] font-black">✓</span>}
          </button>
          <div>
            <span className="font-bold text-[#514be3] dark:text-[#8b85f5] text-sm">#{orderNumber}</span>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">{formatRelativeTime(order.createdAt)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
          <ChevronDown size={15} className={`text-gray-400 dark:text-slate-500 transition-transform ${isOpen ? "rotate-180 text-[#514be3] dark:text-[#8b85f5]" : ""}`} />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600 dark:text-slate-300 font-medium">{customer.fullName || "Noma'lum"}</span>
        <span className="font-black text-gray-800 dark:text-white">{Number(order.totalAmount).toLocaleString()} so'm</span>
      </div>
      <span className="inline-block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md">
        {paymentLabel}
      </span>
      {order.deliveryZone && (
        <span className="inline-block ml-1.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-md">
          🚚 {order.deliveryZone.isFree ? "Bepul yetkazish" : `${Number(order.deliveryZone.price).toLocaleString()} so'm yetkazish`}
        </span>
      )}

      {isOpen && (
        <div className="pt-2 space-y-3 border-t border-dashed border-gray-100 dark:border-slate-700">

          <div className="bg-gray-50/60 dark:bg-slate-800/60 rounded-xl p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase mb-0.5">Telefon</p>
                <p className="text-xs font-bold text-gray-700 dark:text-slate-200">{customer.phone || "Yo'q"}</p>
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
                <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase">To'liq manzil</p>
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

          <div className="space-y-1.5">
            <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase px-1">Buyurtma tarkibi ({order.orders?.length || 0} ta)</p>
            <div className="bg-gray-50/60 dark:bg-slate-800/60 rounded-xl p-2 space-y-2">
              {order.orders?.map((item, index) => (
                <div key={item.id || index} className="flex items-center gap-3 rounded-xl bg-white dark:bg-slate-900 px-3 py-2 shadow-sm border border-gray-100 dark:border-slate-700">
                  <img src={item.image || "/placeholder.png"} alt={item.name} className="w-12 h-12 rounded-xl object-cover bg-gray-100 dark:bg-slate-800 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-bold text-gray-800 dark:text-white truncate">{item.name}</h4>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                      {Number(item.price).toLocaleString()} so'm x <span className="font-black text-indigo-600 dark:text-indigo-400">{item.quantity} ta</span>
                    </p>
                  </div>
                  <p className="text-[12px] font-bold text-[#3B5BFF] dark:text-[#7c8fff] shrink-0">
                    {(item.price * item.quantity).toLocaleString()} so'm
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {actionError && <p className="w-full text-[11px] text-rose-500 font-semibold">{actionError}</p>}

            {nextAction && (
              <button
                onClick={handleAdvanceStatus}
                disabled={pendingAction}
                className="flex-1 py-2.5 bg-[#514be3] hover:bg-[#433cc7] text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 dark:shadow-none disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {order.status === "shipped" ? <CheckCircle2 size={14} /> : <Truck size={14} />}
                {pendingAction ? "..." : nextAction.label.replace(/^\S+\s/, "")}
              </button>
            )}

            {canCancel && (
              <button
                onClick={() => setShowCancelModal(true)}
                disabled={pendingAction}
                className="px-3 py-2.5 border border-red-100 dark:border-red-500/20 text-red-500 rounded-xl text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-60 flex items-center gap-1.5"
              >
                <X size={14} /> Bekor qilish
              </button>
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
    </div>
  );
};

export default memo(OrderRow);
