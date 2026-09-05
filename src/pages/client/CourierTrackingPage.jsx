import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock3, Bike, CheckCircle2, XCircle, PhoneCall, ShieldAlert, PackageSearch } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { subscribeToOrderTracking } from "@/services/orders/getOrderData";
import LiveDeliveryMap from "@/components/shared/LiveDeliveryMap";
import { estimateEtaMinutes } from "@/utils/deliveryEta";
import { resolveTrackingView } from "@/utils/courierTrackingView";
import { getLocationFreshness } from "@/utils/locationFreshness";
import { toMillis } from "@/utils/firestoreTime";
import { formatRelativeTime } from "@/utils/relativeTime";

/**
 * Mijozning kuryerni jonli kuzatish sahifasi — `buildDeepLink()` orqali
 * yaratilgan havola (`/orders/{orderId}/track`) ochilganda ko'rinadi.
 *
 * Bu sahifa uchun alohida autentifikatsiya mexanizmi (masalan HMAC
 * token) qurilmagan — `firestore.rules`dagi `orders/{orderId}` o'qish
 * qoidasi allaqachon `request.auth.uid == resource.data.clientId`ni
 * o'z ichiga oladi, va `buildDeepLink()` havolasi ochilganda
 * `SessionContext` mijozni aynan o'sha `clientId` (Telegram chat ID)
 * bilan tizimga kirg'izadi. Natijada, agar havolani boshqa odam
 * (buyurtma egasi bo'lmagan) ochsa, Firestore so'rovi
 * "permission-denied" bilan rad etiladi — quyidagi `accessError`
 * holati aynan shuni ko'rsatadi.
 */
const CourierTrackingPage = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const { t } = useLanguage();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState(false);

  useEffect(() => {
    if (!orderId) return undefined;
    const unsubscribe = subscribeToOrderTracking(
      orderId,
      (data) => {
        setOrder(data);
        setLoading(false);
      },
      () => {
        setAccessError(true);
        setLoading(false);
      }
    );
    return () => unsubscribe?.();
  }, [orderId]);

  const eta = order?.courierDeliveryStatus === "picked_up" ? estimateEtaMinutes(order?.courierLocation, order?.customer?.location) : null;
  // Xaritani soxta "har doim jonli" ko'rsatish o'rniga, mijozga
  // nuqta qanchalik yangi ekanligi ochiq ko'rsatiladi (`CourierOrderCard.jsx`
  // dagi bilan bir xil yondashuv, kuryer tomonida ham) - Telegram Mini
  // App fon rejimida GPS yubormaydi.
  const locationFreshness = order?.courierDeliveryStatus === "picked_up" ? getLocationFreshness(order?.courierLocation?.updatedAt) : "unknown";
  const locationLastSeenLabel = order?.courierLocation?.updatedAt ? formatRelativeTime(toMillis(order.courierLocation.updatedAt)) : "";

  // Qaysi ko'rinish ko'rsatilishi kerakligi - sof funksiya orqali
  // (`src/utils/courierTrackingView.js`), alohida sinalgan.
  const view = resolveTrackingView({ loading, accessError, order });

  const renderContent = () => {
    switch (view) {
      case "loading":
        return (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        );

      case "accessError":
        return (
          <div className="flex flex-col items-center text-center gap-3 py-16 px-4">
            <ShieldAlert size={40} className="text-rose-400" />
            <h2 className="text-base font-black text-slate-800 dark:text-white">{t("orderTracking.accessErrorTitle")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">{t("orderTracking.accessError")}</p>
          </div>
        );

      case "notFound":
        return (
          <div className="flex flex-col items-center text-center gap-3 py-16 px-4">
            <PackageSearch size={40} className="text-slate-300 dark:text-slate-700" />
            <h2 className="text-base font-black text-slate-800 dark:text-white">{t("orderTracking.notFound")}</h2>
          </div>
        );

      case "noCourierYet":
      case "unknown":
        return (
          <div className="flex flex-col items-center text-center gap-3 py-16 px-4">
            <Clock3 size={40} className="text-slate-300 dark:text-slate-700" />
            <h2 className="text-base font-black text-slate-800 dark:text-white">{t("orderTracking.noCourierYet")}</h2>
          </div>
        );

      case "assigned":
        return (
          <div className="flex flex-col items-center text-center gap-3 py-16 px-4">
            <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
              <Clock3 size={26} className="text-amber-500" />
            </div>
            <h2 className="text-base font-black text-slate-800 dark:text-white">{t("orderTracking.pendingTitle")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">{t("orderTracking.pendingDesc")}</p>
          </div>
        );

      case "pickedUp":
        return (
          <div className="space-y-3">
            <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-800 shadow-sm">
              <LiveDeliveryMap
                destination={order.customer?.location}
                courierPosition={order.courierLocation}
                accentColor="#2563eb"
                height={260}
                expandLabel={t("orderTracking.mapExpand")}
                collapseLabel={t("orderTracking.mapCollapse")}
              />
            </div>
            {locationFreshness === "unknown" && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold text-center">{t("orderTracking.locationWaiting")}</p>
            )}
            {locationFreshness === "stale" && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold text-center">{t("orderTracking.locationStale", { time: locationLastSeenLabel })}</p>
            )}
            {locationFreshness === "very_stale" && (
              <p className="text-[10px] text-rose-500 font-semibold text-center">{t("orderTracking.locationVeryStale", { time: locationLastSeenLabel })}</p>
            )}
            <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("orderTracking.etaLabel")}</p>
                <p className="text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5">
                  {eta ? t("orderTracking.etaMinutes", { count: eta }) : t("orderTracking.etaUnknown")}
                </p>
              </div>
              <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center">
                <Bike size={20} />
              </div>
            </div>
            {order.courierPhone && (
              <a
                href={`tel:${order.courierPhone}`}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow-md shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                <PhoneCall size={16} /> {t("orderTracking.callCourierButton")}
              </a>
            )}
          </div>
        );

      case "delivered":
        return (
          <div className="flex flex-col items-center text-center gap-3 py-16 px-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 size={26} className="text-emerald-500" />
            </div>
            <h2 className="text-base font-black text-slate-800 dark:text-white">{t("orderTracking.deliveredTitle")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">{t("orderTracking.deliveredDesc")}</p>
          </div>
        );

      case "failed":
        return (
          <div className="flex flex-col items-center text-center gap-3 py-16 px-4">
            <div className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
              <XCircle size={26} className="text-rose-500" />
            </div>
            <h2 className="text-base font-black text-slate-800 dark:text-white">{t("orderTracking.failedTitle")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">{t("orderTracking.failedDesc")}</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 pb-36 pt-4 transition-colors duration-300">
      <div className="max-w-md mx-auto px-4 mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex items-center justify-center shadow-sm active:scale-95 transition-all shrink-0"
        >
          <ArrowLeft size={18} className="text-gray-600 dark:text-slate-300" />
        </button>
        <h1 className="text-lg font-bold text-[#1e293b] dark:text-white">{t("orderTracking.pageTitle")}</h1>
      </div>

      <div className="max-w-md mx-auto px-4">{renderContent()}</div>
    </div>
  );
};

export default CourierTrackingPage;
