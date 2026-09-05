import { memo, useState } from "react";
import { PhoneCall, MapPin, ChevronDown, Truck, CheckCircle2, XCircle, Loader2, Copy, Check, Play, AlertTriangle, Clock3 } from "lucide-react";
import { formatRelativeTime } from "@/utils/relativeTime";
import { updateCourierOrderStatus } from "@/services/couriers/courierOrderActions";
import { useLanguage } from "@/context/LanguageContext";
import { triggerHaptic } from "@/config/telegram";
import LiveDeliveryMap from "@/components/shared/LiveDeliveryMap";
import { estimateEtaMinutes } from "@/utils/deliveryEta";
import { getLocationFreshness } from "@/utils/locationFreshness";
import { toMillis } from "@/utils/firestoreTime";
import { formatDeliverySlotAbsolute } from "@/utils/deliverySlots";

// Kuryer yetkazma statuslari `order.status`dan alohida saqlanadi, chunki
// bu faqat kuryer nuqtai nazaridan bosqichni ifodalaydi
// (`courierDeliveryStatus`, `functions/couriers.js`da yoziladi).
const COURIER_STATUS_COLORS = {
  assigned: "bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400",
  picked_up: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  failed: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
};

const COURIER_STATUS_LABEL_KEYS = {
  assigned: "statusAssigned",
  picked_up: "statusPickedUp",
  delivered: "statusDelivered",
  failed: "statusFailed",
};

/**
 * Ikki bosqichli tugma tizimi: avval faqat "Boshlash"/"Bekor qilish"
 * ko'rsatiladi (`courierDeliveryStatus === "assigned"`); "Boshlash"
 * bosilgach, jonli xarita va ETA bilan birga faqat "Yetkazildi"/
 * "Yetkaza olmadim" tugmalari ko'rsatiladi (`courierDeliveryStatus ===
 * "picked_up"`).
 */
const CourierOrderCard = ({ order, orderNumber, canStart = true, defaultOpen = false }) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [pending, setPending] = useState(null); // 'picked_up' | 'delivered' | 'failed' | 'declined' | null
  const [error, setError] = useState(null);
  const [addressCopied, setAddressCopied] = useState(false);
  // Tasodifiy bosishdan himoya qilish uchun — "Bekor qilish" birinchi
  // marta bosilganda faqat tasdiqlash holatiga o'tadi, HAQIQIY amal
  // faqat IKKINCHI bosishda yuboriladi.
  const [confirmingDecline, setConfirmingDecline] = useState(false);

  const customer = order.customer || {};
  const deliveryStatus = order.courierDeliveryStatus || "assigned";
  const statusColor = COURIER_STATUS_COLORS[deliveryStatus] || COURIER_STATUS_COLORS.assigned;
  const statusLabel = t(`courierApp.${COURIER_STATUS_LABEL_KEYS[deliveryStatus] || "statusAssigned"}`);
  const isFinal = deliveryStatus === "delivered" || deliveryStatus === "failed";
  const isAssignedStage = deliveryStatus === "assigned";
  const isPickedUpStage = deliveryStatus === "picked_up";
  // MUHIM TUZATISH: OLDIN bu "ruxsat etilgan to'lov turlari" to'plamidan
  // (`customer.paymentTypes`) hisoblanardi - agar sotuvchi ikkala turni
  // ham yoqqan bo'lsa, mijoz ALLAQACHON karta orqali to'lagan bo'lsa
  // ham, kuryerga baribir "naqd yig'ib oling" ko'rsatilardi (haqiqiy pul
  // xatosi!). ENDI buyurtmaning O'ZIDA saqlangan HAQIQIY tanlovdan
  // (`order.paymentMethod`, 2026-09 punkt-royxati 14-band) olinadi.
  const isCod = order.paymentMethod !== "card";

  const eta = isPickedUpStage ? estimateEtaMinutes(order.courierLocation, customer.location) : null;
  // Telegram Mini App'da GPS faqat ilova ochiq turgan paytda yangilanadi
  // (fon rejimida ishlamaydi), shuning uchun xaritani soxta "har doim
  // jonli" qilib ko'rsatish o'rniga, nuqta qanchalik yangi ekanligi ochiq
  // ko'rsatiladi (kuryerning o'ziga ham) — bu kuryer ilovani yopib
  // qo'yganda, mijozning xaritasi "buzilgan" ko'rinishining oldini oladi
  // (`locationFreshness.js`).
  const locationFreshness = isPickedUpStage ? getLocationFreshness(order.courierLocation?.updatedAt) : "unknown";
  const locationLastSeenLabel = order.courierLocation?.updatedAt ? formatRelativeTime(toMillis(order.courierLocation.updatedAt)) : "";

  const mapUrl = customer.location
    ? `https://www.openstreetmap.org/?mlat=${customer.location.lat}&mlon=${customer.location.lng}#map=17/${customer.location.lat}/${customer.location.lng}`
    : `https://www.google.com/maps/search/${encodeURIComponent(customer.address || "")}`;

  const handleAction = async (action) => {
    if (pending) return;
    triggerHaptic("impact", "medium");
    setPending(action);
    setError(null);
    try {
      await updateCourierOrderStatus(order.id, action);
      triggerHaptic("notification", action === "failed" || action === "declined" ? "warning" : "success");
      setConfirmingDecline(false);
    } catch (err) {
      triggerHaptic("notification", "error");
      setError(err.message || t("courierApp.errorAction"));
    } finally {
      setPending(null);
    }
  };

  const handleStartClick = (e) => {
    e.stopPropagation();
    if (!canStart) return;
    handleAction("picked_up");
  };

  const handleDeclineClick = (e) => {
    e.stopPropagation();
    if (!confirmingDecline) {
      triggerHaptic("selection");
      setConfirmingDecline(true);
      return;
    }
    handleAction("declined");
  };

  const handleCancelDeclineConfirm = (e) => {
    e.stopPropagation();
    setConfirmingDecline(false);
  };

  const handleToggleOpen = () => {
    triggerHaptic("selection");
    setIsOpen((v) => !v);
  };

  const handleCopyAddress = (e) => {
    e.stopPropagation();
    if (!customer.address) return;
    triggerHaptic("impact", "light");
    navigator.clipboard?.writeText(customer.address).then(() => {
      setAddressCopied(true);
      setTimeout(() => setAddressCopied(false), 1500);
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100/80 dark:border-slate-800 p-4 space-y-3 shadow-sm">
      <div className="flex items-start justify-between gap-2 cursor-pointer" onClick={handleToggleOpen}>
        <div>
          <span className="font-bold text-teal-600 dark:text-teal-400 text-sm">#{orderNumber}</span>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">{formatRelativeTime(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${statusColor}`}>{statusLabel}</span>
          <ChevronDown size={15} className={`text-gray-400 dark:text-slate-500 transition-transform ${isOpen ? "rotate-180 text-teal-600 dark:text-teal-400" : ""}`} />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600 dark:text-slate-300 font-medium">{customer.fullName || t("courierApp.unknownCustomer")}</span>
        <span className="font-black text-gray-800 dark:text-white">{Number(order.totalAmount || 0).toLocaleString()} so'm</span>
      </div>
      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md ${isCod ? "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10" : "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10"}`}>
        {isCod ? t("courierApp.codLabel", { amount: Number(order.totalAmount || 0).toLocaleString() }) : t("courierApp.prepaidLabel")}
      </span>
      {/* Mijoz checkout'da tanlagan yetkazib berish vaqt oralig'i
          (2026-09 punkt-royxati, 15-band) - kuryer uchun bu ENG MUHIM
          ma'lumotlardan biri (qachon yetkazishi KERAKLIGI), shuning
          uchun karta yopiq holatda ham (`isOpen` shartisiz) ko'rinadi -
          xuddi to'lov turi (naqd/oldindan) belgisi kabi. Sotuvchi
          (`OrderCard.jsx`) va xodim (`StaffOrderCard.jsx`) kartalarida
          AYNAN SHU maydon (`order.deliveryTimeSlot`) allaqachon
          ko'rsatiladi - bu yerda ham xuddi shunday, faqat kuryer
          ilovasiga mos alohida i18n matni bilan. */}
      {order.deliveryTimeSlot && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md">
          <Clock3 size={10} />
          {t("courierApp.deliveryTimeSlotBadge", {
            range: formatDeliverySlotAbsolute({ startMs: order.deliveryTimeSlot.start, endMs: order.deliveryTimeSlot.end }),
          })}
        </span>
      )}

      {isOpen && (
        <div className="pt-2 space-y-3 border-t border-dashed border-gray-100 dark:border-slate-700">
          {/* Jonli xarita mijoz/manzil ma'lumotlaridan oldin joylashtirilgan,
              chunki bu kuryer uchun ushbu bosqichdagi eng muhim ma'lumot.
              Xarita faqat "picked_up" bosqichida ko'rsatiladi. */}
          {isPickedUpStage && (
            <div className="space-y-2">
              <div className="rounded-xl overflow-hidden border border-gray-100 dark:border-slate-700">
                <LiveDeliveryMap
                  destination={customer.location}
                  courierPosition={order.courierLocation}
                  accentColor="#0d9488"
                  height={200}
                  expandLabel={t("courierApp.mapExpand")}
                  collapseLabel={t("courierApp.mapCollapse")}
                />
              </div>
              <div className="flex items-center justify-between bg-teal-50 dark:bg-teal-500/10 rounded-xl px-3 py-2">
                <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400 uppercase flex items-center gap-1">
                  <Clock3 size={11} /> {t("courierApp.etaLabel")}
                </span>
                <span className="text-xs font-black text-teal-700 dark:text-teal-400">
                  {eta ? t("courierApp.etaMinutesValue", { count: eta }) : t("courierApp.etaUnknown")}
                </span>
              </div>
              {/* Joylashuv qanchalik yangi ekanligi haqidagi ko'rsatkich —
                  Telegram Mini App fon rejimida GPS yubormaydi, shuning
                  uchun kuryer ilovani yopib qo'yganda xarita eskirgan
                  ma'lumot ko'rsatishi mumkin; bu holat foydalanuvchiga
                  aniq bildiriladi. */}
              {locationFreshness === "unknown" && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold text-center">
                  {t("courierApp.locationWaiting")}
                </p>
              )}
              {locationFreshness === "stale" && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold text-center">
                  {t("courierApp.locationStale", { time: locationLastSeenLabel })}
                </p>
              )}
              {locationFreshness === "very_stale" && (
                <p className="text-[10px] text-rose-500 font-semibold text-center">
                  {t("courierApp.locationVeryStale", { time: locationLastSeenLabel })}
                </p>
              )}
            </div>
          )}

          <div className="bg-gray-50/60 dark:bg-slate-800/60 rounded-xl p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase mb-0.5">{t("courierApp.phoneLabel")}</p>
                <p className="text-xs font-bold text-gray-700 dark:text-slate-200">{customer.phone || t("courierApp.noPhone")}</p>
              </div>
              {customer.phone && (
                <a href={`tel:${customer.phone}`} onClick={(e) => e.stopPropagation()} className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <PhoneCall size={14} />
                </a>
              )}
            </div>
            <div className="border-t border-gray-100 dark:border-slate-700 pt-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase">{t("courierApp.addressLabel")}</p>
                <div className="flex items-center gap-1.5">
                  {customer.address && (
                    <button
                      type="button"
                      onClick={handleCopyAddress}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                        addressCopied
                          ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-300"
                      }`}
                    >
                      {addressCopied ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  )}
                  <a href={mapUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                    <MapPin size={12} />
                  </a>
                </div>
              </div>
              <p className="text-xs text-gray-700 dark:text-slate-200 font-medium leading-relaxed">{customer.address || t("courierApp.noAddress")}</p>
              {addressCopied && <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">{t("courierApp.addressCopied")}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase px-1">{t("courierApp.contentsLabel", { count: order.orders?.length || 0 })}</p>
            <div className="bg-gray-50/60 dark:bg-slate-800/60 rounded-xl p-2 space-y-2">
              {order.orders?.map((item, index) => (
                <div key={item.id || index} className="flex items-center gap-3 rounded-xl bg-white dark:bg-slate-900 px-3 py-2 shadow-sm border border-gray-100 dark:border-slate-700">
                  <img src={item.image || "/placeholder.png"} alt={item.name} className="w-11 h-11 rounded-xl object-cover bg-gray-100 dark:bg-slate-800 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-bold text-gray-800 dark:text-white truncate">{item.name}</h4>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">{[item.quantity, t("courierApp.qtySuffix")].filter(Boolean).join(" ")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-[11px] text-rose-500 font-semibold">{error}</p>}

          {isAssignedStage && (
            <div className="space-y-2">
              {!canStart && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-2.5 py-2">
                  <AlertTriangle size={12} className="shrink-0" /> {t("courierApp.cannotStartYet")}
                </p>
              )}
              <button
                type="button"
                onClick={handleStartClick}
                disabled={Boolean(pending) || !canStart}
                className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md shadow-teal-600/10 flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {pending === "picked_up" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {t("courierApp.actionStart")}
              </button>
              {!confirmingDecline ? (
                <button
                  type="button"
                  onClick={handleDeclineClick}
                  disabled={Boolean(pending)}
                  className="w-full h-10 border border-rose-100 dark:border-rose-500/20 text-rose-500 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <XCircle size={14} />
                  {t("courierApp.actionDecline")}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancelDeclineConfirm}
                    disabled={Boolean(pending)}
                    className="flex-1 h-10 border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-300 rounded-xl text-xs font-bold disabled:opacity-60"
                  >
                    {t("courierApp.declineCancelButton")}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeclineClick}
                    disabled={Boolean(pending)}
                    className="flex-1 h-10 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {pending === "declined" ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={14} />}
                    {t("courierApp.actionDeclineConfirm")}
                  </button>
                </div>
              )}
            </div>
          )}

          {isPickedUpStage && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleAction("delivered"); }}
                disabled={Boolean(pending)}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/10 flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {pending === "delivered" ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {t("courierApp.actionDelivered")}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleAction("failed"); }}
                disabled={Boolean(pending)}
                className="w-full h-10 border border-rose-100 dark:border-rose-500/20 text-rose-500 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {pending === "failed" ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={14} />}
                {t("courierApp.actionFailed")}
              </button>
            </div>
          )}

          {!isFinal && order.yandexClaimId && (
            <p className="text-[10px] text-gray-400 dark:text-slate-500 flex items-center gap-1">
              <Truck size={11} /> {t("courierApp.yandexWarning")}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(CourierOrderCard);
