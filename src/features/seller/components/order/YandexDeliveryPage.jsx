import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import {
  ArrowLeft, Search, UserCheck, Truck, PackageCheck, XCircle, PhoneCall,
  Loader2, Car, RotateCcw, MapPin, Check, RefreshCw, Share2, HelpCircle,
  Package, ChevronDown, Maximize2, Minimize2,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { loadLeaflet, applyMapTileLayer } from "@/utils/loadLeaflet";
import { useTheme } from "@/context/ThemeContext";
import YandexTariffModal from "./YandexTariffModal";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";

/**
 * Yandex Delivery — to'liq ekran (routing) holat sahifasi.
 *
 * Sahifa oddiy scroll qilinadigan tuzilishda ishlaydi: xarita
 * chegaralangan balandlikdagi karta ichida joylashadi, sarlavha va
 * boshqaruv paneli esa uning ostida, sahifaning normal oqimida
 * ko'rsatiladi. Bu tuzilish ataylab shunday tanlangan — muqobil
 * "doimiy to'liq ekran xarita + pastdan tortiladigan panel" varianti
 * sinovda ishlatilganda, xarita ostidagi sarlavha va panel butunlay
 * ko'rinmay qolar edi (production muhitida aniq sababini konsol
 * xatosisiz aniqlash imkonsiz bo'lgan render muammosi). Interaktiv
 * xarita (pickup/dropoff/kuryer belgilari) va barcha funksiyalar
 * (bekor qilish, narx, buyurtma vaqti) shu tuzilishda to'liq
 * ishlaydi — faqat tashqi joylashuv oddiy va ishonchli variantga
 * moslashtirilgan. Xaritani vaqtinchalik to'liq ekranga yoyish
 * imkoniyati (pastda, `isMapFullscreen`) shu chegaralangan-karta
 * yondashuvi ustiga qo'shilgan overlay sifatida ishlaydi va bu
 * cheklovga zid kelmaydi.
 */
const STAGE_ORDER = ["searching", "found", "onTheWay", "delivered"];

const STATUS_TO_STAGE = {
  new: "searching", estimating: "searching", ready_for_approval: "searching",
  accepted: "searching", performer_lookup: "searching", performer_draft: "searching",
  performer_found: "found", pickup_arrived: "found", ready_for_pickup_confirmation: "found",
  pickuped: "onTheWay", delivery_arrived: "onTheWay", ready_for_delivery_confirmation: "onTheWay",
  delivered: "delivered", delivered_finish: "delivered",
};

const CANCELLED_STATUSES = new Set([
  "cancelled", "cancelled_with_payment", "cancelled_by_taxi",
  "cancelled_with_items_on_hands", "failed", "performer_not_found", "estimating_failed",
]);

const RETURNING_STATUSES = new Set([
  "returning", "return_arrived", "ready_for_return_confirmation", "returned", "returned_finish",
]);

const STAGE_ICONS = { searching: Search, found: UserCheck, onTheWay: Truck, delivered: PackageCheck };

const YandexDeliveryPage = () => {
  const { orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const initialStatus = location.state?.initialStatus || null;

  const [status, setStatus] = useState(initialStatus);
  const [performerInfo, setPerformerInfo] = useState(null);
  const [price, setPrice] = useState(null);
  const [currency, setCurrency] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [phone, setPhone] = useState(null);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState(null);
  const [yandexErrors, setYandexErrors] = useState([]);
  const [trackingLink, setTrackingLink] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [position, setPosition] = useState(null);
  const [positionLoading, setPositionLoading] = useState(false);
  const [positionError, setPositionError] = useState(null);
  const [showAllStages, setShowAllStages] = useState(false);
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [createdAt, setCreatedAt] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEscapeToClose(() => setShowCancelConfirm(false), showCancelConfirm && !cancelling);
  const [cancelError, setCancelError] = useState(null);
  const [redispatching, setRedispatching] = useState(false);
  const [redispatchError, setRedispatchError] = useState(null);
  const [showTariffModal, setShowTariffModal] = useState(false);
  // Xaritani to'liq ekranga yoyish/qaytarish - `LiveDeliveryMap.jsx`dagi
  // bilan bir xil naqsh (vaqtinchalik `fixed` overlay). Bu sahifaning
  // asosiy tuzilishini o'zgartirmaydi va yuqoridagi izohda tavsiflangan
  // doimiy to'liq ekran layoutidan farqli — faqat vaqtinchalik overlay.
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const dropoffMarkerRef = useRef(null);
  const courierMarkerRef = useRef(null);
  const routeLineRef = useRef(null);

  const loadDetails = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const getDetails = httpsCallable(functions, "getYandexClaimDetails");
      const { data } = await getDetails({ orderId });
      setStatus(data.status);
      setPerformerInfo(data.performerInfo);
      setPrice(data.price);
      setCurrency(data.currency);
      setYandexErrors(data.errorMessages || []);
      setTrackingLink(data.trackingLink || null);
      setPickup(data.pickup || null);
      setDropoff(data.dropoff || null);
      setCreatedAt(data.createdAt || null);
    } catch (err) {
      setError(err.message || t("sellerOrders.yandexModal.loadError"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId, t]);

  useEffect(() => {
    loadDetails(false);
  }, [loadDetails]);

  // Xaritani ishga tushirish - `LocationPickerModal.jsx`dagi bilan
  // bir xil Leaflet+OpenStreetMap naqshi (bepul, API kalitisiz).
  useEffect(() => {
    if (!pickup && !dropoff) return;
    if (!mapContainerRef.current || mapRef.current) return;

    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !mapContainerRef.current || mapRef.current) return;

      const center = pickup || dropoff;
      const map = L.map(mapContainerRef.current).setView([center.lat, center.lng], 13);
      applyMapTileLayer(L, map, tileLayerRef, isDark);
      mapRef.current = map;

      const makeDivIcon = (bgColor, label) => L.divIcon({
        className: "",
        html: `<div style="background:${bgColor};width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid white;">${label}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const bounds = [];
      if (pickup) {
        pickupMarkerRef.current = L.marker([pickup.lat, pickup.lng], { icon: makeDivIcon("#5346E0", "D") }).addTo(map);
        bounds.push([pickup.lat, pickup.lng]);
      }
      if (dropoff) {
        // Manzil belgisi joylashuv-pin ikonkasidan foydalanadi
        // (`LiveDeliveryMap.jsx`dagi PIN_SVG bilan bir xil - ikkala
        // xarita amalga oshirilishi bo'ylab izchillik uchun).
        dropoffMarkerRef.current = L.marker([dropoff.lat, dropoff.lng], {
          icon: makeDivIcon("#10b981", '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>'),
        }).addTo(map);
        bounds.push([dropoff.lat, dropoff.lng]);
      }
      if (pickup && dropoff) {
        routeLineRef.current = L.polyline(bounds, { color: "#5346E0", weight: 2, dashArray: "6,6", opacity: 0.6 }).addTo(map);
      }
      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        tileLayerRef.current = null;
        pickupMarkerRef.current = null;
        dropoffMarkerRef.current = null;
        courierMarkerRef.current = null;
        routeLineRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

  // TEMA (dark/light) almashsa — `LiveDeliveryMap.jsx`dagi bilan bir
  // xil naqsh: xarita qaytadan yaratilmaydi, faqat plitka qatlami
  // yangilanadi.
  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    applyMapTileLayer(window.L, mapRef.current, tileLayerRef, isDark);
  }, [isDark]);

  // Kuryer belgisini xaritada yangilash.
  useEffect(() => {
    if (!position || !mapRef.current || !window.L) return;
    const L = window.L;

    if (courierMarkerRef.current) {
      courierMarkerRef.current.setLatLng([position.lat, position.lon]);
    } else {
      const courierIcon = L.divIcon({
        className: "",
        html: `<div style="background:#f59e0b;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid white;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      courierMarkerRef.current = L.marker([position.lat, position.lon], { icon: courierIcon }).addTo(mapRef.current);
    }
    mapRef.current.panTo([position.lat, position.lon]);
  }, [position]);

  // To'liq ekran holati o'zgarganda, Leaflet'ga konteyner o'lchami
  // o'zgarganini majburiy bildiramiz (`LiveDeliveryMap.jsx`dagi bilan
  // bir xil sabab - aks holda xarita eski o'lchamda chizilib qoladi).
  useEffect(() => {
    if (!mapRef.current) return undefined;
    const id = setTimeout(() => mapRef.current?.invalidateSize(), 80);
    return () => clearTimeout(id);
  }, [isMapFullscreen]);

  const handleCallCourier = async () => {
    setPhoneLoading(true);
    setPhoneError(null);
    try {
      const getPhone = httpsCallable(functions, "getYandexCourierPhone");
      const { data } = await getPhone({ orderId });
      setPhone(data.phone);
    } catch (err) {
      setPhoneError(err.message || t("sellerOrders.courierPhoneError"));
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleShowPosition = async () => {
    setPositionLoading(true);
    setPositionError(null);
    try {
      const getPosition = httpsCallable(functions, "getYandexPerformerPosition");
      const { data } = await getPosition({ orderId });
      setPosition(data);
    } catch (err) {
      setPositionError(err.message || t("sellerOrders.yandexModal.positionError"));
    } finally {
      setPositionLoading(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      const cancelDelivery = httpsCallable(functions, "cancelYandexDelivery");
      const { data } = await cancelDelivery({ orderId });
      setStatus(data.status);
      setShowCancelConfirm(false);
    } catch (err) {
      setCancelError(err.message || t("sellerOrders.yandexModal.cancelError"));
    } finally {
      setCancelling(false);
    }
  };

  // Bekor qilingandan keyin, sotuvchi shu sahifadan turib yangi kuryer
  // chaqira olishi kerak. Backend `handleCancelYandexDelivery`da
  // `yandexClaimId`ni tozalaydi, shuning uchun bu chaqiruv "allaqachon
  // jo'natilgan" xatosiga uchramaydi. Muvaffaqiyatli bo'lsa, holatni
  // to'liq qayta yuklaymiz - shu orqali sahifa "bekor qilingan"
  // ko'rinishidan chiqib, yangi da'voning haqiqiy holatini (odatda
  // "qidirilmoqda") ko'rsatadi.
  const handleRedispatch = async (taxiClass) => {
    setShowTariffModal(false);
    setRedispatching(true);
    setRedispatchError(null);
    try {
      const dispatch = httpsCallable(functions, "dispatchYandexDelivery");
      await dispatch({ orderId, taxiClass });
      await loadDetails(true);
    } catch (err) {
      setRedispatchError(err.message || t("sellerOrders.yandexModal.redispatchError"));
    } finally {
      setRedispatching(false);
    }
  };

  const handleShareLink = async () => {
    if (!trackingLink) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: t("sellerOrders.yandexModal.copyTrackingLink"), url: trackingLink });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(trackingLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard API mavjud bo'lmasa - jim qolamiz.
    }
  };

  const isCancelled = CANCELLED_STATUSES.has(status);
  const isReturning = RETURNING_STATUSES.has(status);
  const currentStage = STATUS_TO_STAGE[status] || "searching";
  const currentStageIndex = STAGE_ORDER.indexOf(currentStage);
  const CurrentStageIcon = STAGE_ICONS[currentStage];

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-36 transition-colors duration-300">

      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-transform shrink-0"
        >
          <ArrowLeft size={17} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-black text-slate-800 dark:text-white">{t("sellerOrders.yandexModal.title")}</h1>
          {createdAt ? (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              {t("sellerOrders.yandexModal.orderedAtLabel")}: {new Date(createdAt).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </p>
          ) : (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">{t("sellerOrders.yandexModal.subtitle")}</p>
          )}
        </div>
        {!isCancelled && (
          <button
            type="button"
            onClick={() => loadDetails(true)}
            disabled={loading || refreshing}
            className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center active:scale-95 transition-transform shrink-0 disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
            <Loader2 size={22} className="animate-spin text-indigo-500" />
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{t("sellerOrders.yandexModal.subtitle")}</p>
        </div>
      ) : (
        <div className="p-4 space-y-4">

          {error && (
            <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-2xl p-4 flex items-start gap-3 animate-fade-in">
              <XCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
              <p className="flex-1 min-w-0 text-xs font-bold text-rose-600 dark:text-rose-400 leading-relaxed">{error}</p>
              <button
                type="button"
                onClick={() => loadDetails(true)}
                disabled={refreshing}
                className="shrink-0 h-8 px-3 rounded-full bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-[11px] font-bold flex items-center gap-1 disabled:opacity-60"
              >
                <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
                {t("sellerOrders.yandexModal.actionRefresh")}
              </button>
            </div>
          )}

          {/* Xarita chegaralangan balandlikdagi (260px) karta ichida
              ko'rsatiladi — bu tuzilish haqida yuqoridagi fayl darajasidagi
              izohga qarang. Balandlik ko'proq tafsilot ko'rinishi uchun
              tanlangan. */}
          {!isCancelled && (pickup || dropoff) && (
            <div className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm animate-fade-in ${isMapFullscreen ? "fixed inset-0 z-[999] rounded-none border-0" : "rounded-2xl overflow-hidden"}`}>
              <div className="relative">
                <div ref={mapContainerRef} style={{ height: isMapFullscreen ? "calc(100vh - 56px)" : "260px", width: "100%" }} />
                <button
                  type="button"
                  onClick={() => setIsMapFullscreen((v) => !v)}
                  aria-label={isMapFullscreen ? t("sellerOrders.yandexModal.mapCollapse") : t("sellerOrders.yandexModal.mapExpand")}
                  className="absolute top-2.5 right-2.5 z-[1000] w-8 h-8 rounded-full bg-white/95 dark:bg-slate-800/95 border border-gray-200 dark:border-slate-700 shadow-md flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-transform"
                >
                  {isMapFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
              </div>
              <div className="flex items-center gap-4 px-4 py-3 border-t border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#5346E0] inline-block ring-2 ring-[#5346E0]/20" /> {t("sellerOrders.yandexModal.pickupLabel")}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block ring-2 ring-emerald-500/20" /> {t("sellerOrders.yandexModal.dropoffLabel")}
                </span>
                {position && (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block ring-2 ring-amber-500/20 animate-pulse" /> {t("sellerOrders.courierCallButton")}
                  </span>
                )}
              </div>
            </div>
          )}

          {!isCancelled && !pickup && !dropoff && (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center pt-1">
                  <div className="w-3 h-3 rounded-full bg-indigo-600 shrink-0" />
                  <div className="w-0.5 h-10 bg-indigo-200 dark:bg-indigo-500/30 my-1" />
                  <Package size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                </div>
                <div className="flex-1 min-w-0 space-y-3 pt-0.5">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("sellerOrders.yandexModal.pickupLabel")}</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">{t("sellerOrders.yandexModal.pickupFromStore")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("sellerOrders.yandexModal.dropoffLabel")}</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">{t("sellerOrders.yandexModal.dropoffToCustomer")}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isCancelled ? (
            <div className="bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-500/20 rounded-2xl flex flex-col items-center gap-2 py-10 text-center px-4">
              <XCircle size={36} className="text-rose-500" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{t("sellerOrders.yandexModal.cancelledTitle")}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{t("sellerOrders.yandexModal.cancelledSubtitle")}</p>
              <div className="mt-2 bg-gray-50 dark:bg-slate-800/60 rounded-xl px-3 py-2 text-left w-full">
                <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500">status: {status}</p>
                {yandexErrors.map((e, i) => (
                  <p key={i} className="text-[10px] font-mono text-rose-400 mt-0.5">{e.code}{e.message ? ` — ${e.message}` : ""}</p>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowTariffModal(true)}
                disabled={redispatching}
                className="mt-3 w-full h-11 rounded-xl bg-[#5346E0] text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {redispatching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {redispatching ? t("sellerOrders.yandexModal.redispatching") : t("sellerOrders.yandexModal.redispatchButton")}
              </button>
              {redispatchError && <p className="text-[11px] text-rose-500 font-semibold">{redispatchError}</p>}
            </div>
          ) : isReturning ? (
            <div className="bg-white dark:bg-slate-900 border border-amber-100 dark:border-amber-500/20 rounded-2xl flex flex-col items-center gap-2 py-10 text-center px-4">
              <RotateCcw size={36} className="text-amber-500" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{t("sellerOrders.yandexModal.returningTitle")}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{t("sellerOrders.yandexModal.returningSubtitle")}</p>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowAllStages((v) => !v)}
                className="w-full bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-4 flex items-center gap-3 text-left shadow-lg shadow-indigo-600/25 active:scale-[0.99] transition-transform animate-fade-in"
              >
                <span className="relative w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                  {currentStage === "searching" && (
                    <span className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
                  )}
                  <CurrentStageIcon size={19} className="text-white relative" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white">{t(`sellerOrders.yandexModal.stage.${currentStage}`)}</p>
                  <p className="text-[11px] text-white/70 mt-0.5">{t(`sellerOrders.yandexModal.stageHint.${currentStage}`)}</p>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-bold text-white/80 shrink-0">
                  <span className="underline">{t("sellerOrders.yandexModal.allStatuses")}</span>
                  {/* `rotate-180` klassi faqat strelka ikonkasiga
                      qo'llanadi, matnga emas — shunday qilib matn
                      joyida qoladi, faqat ikonka aylanadi. */}
                  <ChevronDown size={12} className={`transition-transform ${showAllStages ? "rotate-180" : ""}`} />
                </span>
              </button>

              {showAllStages && (
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 animate-fade-in">
                  {STAGE_ORDER.map((stage, index) => {
                    const Icon = STAGE_ICONS[stage];
                    const isDone = index < currentStageIndex;
                    const isCurrent = index === currentStageIndex;
                    const isLast = index === STAGE_ORDER.length - 1;
                    return (
                      <div key={stage} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                            isDone || isCurrent ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-300 dark:text-slate-600"
                          }`}>
                            <Icon size={15} />
                          </div>
                          {!isLast && <div className={`w-0.5 flex-1 min-h-[22px] ${isDone ? "bg-indigo-600" : "bg-gray-100 dark:bg-slate-800"}`} />}
                        </div>
                        <div className={`pb-6 ${isLast ? "pb-0" : ""}`}>
                          <p className={`text-xs font-bold ${isCurrent ? "text-indigo-600 dark:text-indigo-400" : isDone ? "text-slate-600 dark:text-slate-300" : "text-slate-300 dark:text-slate-600"}`}>
                            {t(`sellerOrders.yandexModal.stage.${stage}`)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-5 gap-2 animate-fade-in">
                <button
                  type="button"
                  onClick={() => loadDetails(true)}
                  className="flex flex-col items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl py-3 shadow-sm active:scale-95 transition-transform"
                >
                  <RefreshCw size={16} className="text-slate-500 dark:text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("sellerOrders.yandexModal.actionRefresh")}</span>
                </button>
                <button
                  type="button"
                  onClick={handleShareLink}
                  disabled={!trackingLink}
                  className="flex flex-col items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl py-3 shadow-sm active:scale-95 transition-transform disabled:opacity-40 disabled:active:scale-100"
                >
                  {linkCopied ? <Check size={16} className="text-emerald-500" /> : <Share2 size={16} className="text-slate-500 dark:text-slate-400" />}
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("sellerOrders.yandexModal.actionShare")}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCallCourier}
                  disabled={!performerInfo || phoneLoading}
                  className="flex flex-col items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl py-3 shadow-sm active:scale-95 transition-transform disabled:opacity-40 disabled:active:scale-100"
                >
                  {phoneLoading ? <Loader2 size={16} className="animate-spin text-slate-500 dark:text-slate-400" /> : <PhoneCall size={16} className="text-slate-500 dark:text-slate-400" />}
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("sellerOrders.courierCallButton")}</span>
                </button>
                <Link
                  to="/seller/support"
                  className="flex flex-col items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl py-3 shadow-sm active:scale-95 transition-transform"
                >
                  <HelpCircle size={16} className="text-slate-500 dark:text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("sellerOrders.yandexModal.actionSupport")}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(true)}
                  className="flex flex-col items-center gap-1.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-2xl py-3 shadow-sm active:scale-95 transition-transform"
                >
                  <XCircle size={16} className="text-rose-500" />
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">{t("sellerOrders.yandexModal.actionCancel")}</span>
                </button>
              </div>
              {phoneError && <p className="text-[11px] text-rose-500 font-semibold text-center">{phoneError}</p>}

              {performerInfo ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3 shadow-sm animate-fade-in">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shrink-0 font-black text-sm shadow-sm">
                    {(performerInfo.courier_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{performerInfo.courier_name || t("sellerOrders.yandexModal.courierFallbackName")}</p>
                    {performerInfo.car_model && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <Car size={11} /> {performerInfo.car_model}
                        {performerInfo.car_number ? ` · ${performerInfo.car_number}` : ""}
                      </p>
                    )}
                  </div>
                  {phone && (
                    <a href={`tel:${phone}`} className="shrink-0 h-8 px-3 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      {phone}
                    </a>
                  )}
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-center animate-fade-in">
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">{t("sellerOrders.yandexModal.noCourierYet")}</p>
                </div>
              )}

              {performerInfo && (
                <div className="space-y-2">
                  {(pickup || dropoff) ? (
                    <button
                      type="button"
                      onClick={handleShowPosition}
                      disabled={positionLoading}
                      className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold disabled:opacity-60"
                    >
                      {positionLoading ? <Loader2 size={13} className="animate-spin" /> : <MapPin size={13} />}
                      {positionLoading
                        ? t("sellerOrders.yandexModal.positionLoading")
                        : position
                          ? t("sellerOrders.yandexModal.refreshPositionButton")
                          : t("sellerOrders.yandexModal.showPositionButton")}
                    </button>
                  ) : position ? (
                    <a
                      href={`https://yandex.com/maps/?ll=${position.lon},${position.lat}&z=16&pt=${position.lon},${position.lat}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-xs font-bold"
                    >
                      <MapPin size={13} /> {t("sellerOrders.yandexModal.openInMaps")}
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={handleShowPosition}
                      disabled={positionLoading}
                      className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold disabled:opacity-60"
                    >
                      {positionLoading ? <Loader2 size={13} className="animate-spin" /> : <MapPin size={13} />}
                      {positionLoading ? t("sellerOrders.yandexModal.positionLoading") : t("sellerOrders.yandexModal.showPositionButton")}
                    </button>
                  )}
                  {positionError && <p className="text-[11px] text-rose-500 font-semibold text-center">{positionError}</p>}
                </div>
              )}

              {price !== null && price !== undefined && (
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm animate-fade-in">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t("sellerOrders.yandexModal.deliveryPriceLabel")}</span>
                  <span className="text-base font-black text-slate-800 dark:text-white">{Number(price).toLocaleString()} <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{currency || "UZS"}</span></span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !cancelling && setShowCancelConfirm(false)} role="dialog" aria-modal="true">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="w-11 h-11 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
                <XCircle size={20} className="text-rose-500" />
              </span>
              <p className="text-sm font-black text-slate-800 dark:text-white">{t("sellerOrders.yandexModal.cancelConfirmTitle")}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">{t("sellerOrders.yandexModal.cancelConfirmDesc")}</p>
            </div>
            {cancelError && <p className="text-[11px] text-rose-500 font-semibold text-center">{cancelError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                disabled={cancelling}
                className="flex-1 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold disabled:opacity-60"
              >
                {t("sellerOrders.yandexModal.cancelConfirmBack")}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 h-11 rounded-xl bg-rose-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {cancelling ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                {t("sellerOrders.yandexModal.cancelConfirmAction")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTariffModal && (
        <YandexTariffModal
          busy={redispatching}
          onSelect={handleRedispatch}
          onClose={() => setShowTariffModal(false)}
        />
      )}
    </div>
  );
};

export default YandexDeliveryPage;
