import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import { X, Search, UserCheck, Truck, PackageCheck, XCircle, PhoneCall, Loader2, Car, RotateCcw, MapPin, Copy, Check } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";

// Yandex'ning to'liq (texnik) status ro'yxatini, mijozga TUSHUNARLI
// 5 ta bosqichdan biriga moslashtiramiz - Yandex Go ilovasidagi
// "progress stepper" ko'rinishiga o'xshab.
const STAGE_ORDER = ["searching", "found", "onTheWay", "delivered"];

const STATUS_TO_STAGE = {
  new: "searching",
  estimating: "searching",
  ready_for_approval: "searching",
  accepted: "searching",
  performer_lookup: "searching",
  performer_draft: "searching",
  performer_found: "found",
  pickup_arrived: "found",
  ready_for_pickup_confirmation: "found",
  pickuped: "onTheWay",
  delivery_arrived: "onTheWay",
  ready_for_delivery_confirmation: "onTheWay",
  delivered: "delivered",
  delivered_finish: "delivered",
};

const CANCELLED_STATUSES = new Set([
  "cancelled", "cancelled_with_payment", "cancelled_by_taxi",
  "cancelled_with_items_on_hands", "failed", "performer_not_found", "estimating_failed",
]);

// MUHIM TUZATISH: rasmiy status-diagrammada ko'rsatilgan "Return"
// oqimi (agar QABUL QILUVCHI hech qanday javob bermasa - "no response
// from recipient" - mahsulot qaytariladi) uchun bu holatlar avval
// UMUMAN belgilanmagan edi, shuning uchun ular STATUS_TO_STAGE'da
// yo'qligi sababli "searching" (kuryer qidirilmoqda) bosqichiga
// noto'g'ri qaytib ketardi - garchi aslida mahsulot ALLAQACHON
// qaytarilayotgan bo'lsa ham. Endi bular alohida ko'rinishga ega.
const RETURNING_STATUSES = new Set([
  "returning", "return_arrived", "ready_for_return_confirmation", "returned", "returned_finish",
]);

const STAGE_ICONS = {
  searching: Search,
  found: UserCheck,
  onTheWay: Truck,
  delivered: PackageCheck,
};

/**
 * Yandex Go ilovasidagi "buyurtma holati" oynasiga o'xshab
 * qurilgan - vertikal progress-stepper (4 bosqich), kuryer
 * kartochkasi (ism, mashina, davlat raqami - mavjud bo'lganda),
 * va qo'ng'iroq tugmasi. Ochilganda darhol ENG YANGI holatni
 * so'raydi (10 daqiqalik fon-sinxronlashdan farqli, real vaqtda).
 */
const YandexDeliveryStatusModal = ({ orderId, initialStatus, onClose }) => {
  const { t } = useLanguage();
  const [status, setStatus] = useState(initialStatus);
  const [performerInfo, setPerformerInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [phone, setPhone] = useState(null);
  const [phoneLoading, setPhoneLoading] = useState(false);

  useEscapeToClose(onClose);
  const [phoneError, setPhoneError] = useState(null);
  const [yandexErrors, setYandexErrors] = useState([]);
  const [trackingLink, setTrackingLink] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [position, setPosition] = useState(null);
  const [positionLoading, setPositionLoading] = useState(false);
  const [positionError, setPositionError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const getDetails = httpsCallable(functions, "getYandexClaimDetails");
        const { data } = await getDetails({ orderId });
        if (cancelled) return;
        setStatus(data.status);
        setPerformerInfo(data.performerInfo);
        setYandexErrors(data.errorMessages || []);
        setTrackingLink(data.trackingLink || null);
      } catch (err) {
        if (!cancelled) setError(err.message || t("sellerOrders.yandexModal.loadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orderId, t]);

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

  // "Kuryer qayerda?" — ATAYLAB avtomatik/doimiy so'ralmaydi, faqat
  // sotuvchi tugmani bosganda - Yandex API xarajatini nazorat ostida
  // ushlab turish uchun. Har bosishda YANGI so'rov (joylashuv doimo
  // o'zgarib turadi, keshlashning ma'nosi yo'q).
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

  const handleCopyLink = async () => {
    if (!trackingLink) return;
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

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-[440px] rounded-t-[28px] p-5 space-y-5 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-white">{t("sellerOrders.yandexModal.title")}</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">{t("sellerOrders.yandexModal.subtitle")}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 dark:text-slate-500 shrink-0">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={22} className="animate-spin text-blue-500" />
          </div>
        ) : isCancelled ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <XCircle size={36} className="text-rose-500" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{t("sellerOrders.yandexModal.cancelledTitle")}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{t("sellerOrders.yandexModal.cancelledSubtitle")}</p>
            {/* MUHIM QO'SHIMCHA: Yandex'ning texnik status kodi + aniq
                sabab (agar mavjud bo'lsa) - buni ko'rsatish orqali,
                nima uchun bekor qilinganini har safar server
                loglaridan qidirish shart bo'lmaydi. */}
            <div className="mt-2 bg-gray-50 dark:bg-slate-800/60 rounded-xl px-3 py-2 text-left w-full">
              <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500">status: {status}</p>
              {yandexErrors.map((e, i) => (
                <p key={i} className="text-[10px] font-mono text-rose-400 mt-0.5">{e.code}{e.message ? ` — ${e.message}` : ""}</p>
              ))}
            </div>
          </div>
        ) : isReturning ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <RotateCcw size={36} className="text-amber-500" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{t("sellerOrders.yandexModal.returningTitle")}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{t("sellerOrders.yandexModal.returningSubtitle")}</p>
          </div>
        ) : (
          <>
            {/* BOSQICHLAR (Yandex Go uslubidagi vertikal stepper) */}
            <div className="space-y-0">
              {STAGE_ORDER.map((stage, index) => {
                const Icon = STAGE_ICONS[stage];
                const isDone = index < currentStageIndex;
                const isCurrent = index === currentStageIndex;
                const isLast = index === STAGE_ORDER.length - 1;
                return (
                  <div key={stage} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                          isDone || isCurrent
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 dark:bg-slate-800 text-gray-300 dark:text-slate-600"
                        }`}
                      >
                        <Icon size={15} />
                      </div>
                      {!isLast && (
                        <div className={`w-0.5 flex-1 min-h-[22px] ${isDone ? "bg-blue-600" : "bg-gray-100 dark:bg-slate-800"}`} />
                      )}
                    </div>
                    <div className={`pb-6 ${isLast ? "pb-0" : ""}`}>
                      <p className={`text-xs font-bold ${isCurrent ? "text-blue-600 dark:text-blue-400" : isDone ? "text-slate-600 dark:text-slate-300" : "text-slate-300 dark:text-slate-600"}`}>
                        {t(`sellerOrders.yandexModal.stage.${stage}`)}
                      </p>
                      {isCurrent && (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {t(`sellerOrders.yandexModal.stageHint.${stage}`)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* KURYER KARTOCHKASI - faqat tayinlangandan keyin (performer_found+) mavjud */}
            {performerInfo ? (
              <div className="bg-blue-50 dark:bg-blue-500/10 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 font-black text-sm">
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
                <button
                  type="button"
                  onClick={handleCallCourier}
                  disabled={phoneLoading}
                  className="shrink-0 w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center disabled:opacity-60"
                  aria-label={t("sellerOrders.courierCallButton")}
                >
                  {phoneLoading ? <Loader2 size={15} className="animate-spin" /> : <PhoneCall size={15} />}
                </button>
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-slate-800/60 rounded-2xl p-4 text-center">
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">{t("sellerOrders.yandexModal.noCourierYet")}</p>
              </div>
            )}

            {/* KURYER JONLI JOYLASHUVI - faqat kuryer tayinlangandan keyin,
                va faqat tugma bosilganda (avtomatik emas). */}
            {performerInfo && (
              <div className="space-y-2">
                {position ? (
                  <a
                    href={`https://yandex.com/maps/?ll=${position.lon},${position.lat}&z=16&pt=${position.lon},${position.lat}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 h-11 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-bold"
                  >
                    <MapPin size={13} /> {t("sellerOrders.yandexModal.openInMaps")}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={handleShowPosition}
                    disabled={positionLoading}
                    className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl bg-gray-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 text-xs font-bold disabled:opacity-60"
                  >
                    {positionLoading ? <Loader2 size={13} className="animate-spin" /> : <MapPin size={13} />}
                    {positionLoading ? t("sellerOrders.yandexModal.positionLoading") : t("sellerOrders.yandexModal.showPositionButton")}
                  </button>
                )}
                {positionError && <p className="text-[11px] text-rose-500 font-semibold text-center">{positionError}</p>}
              </div>
            )}

            {/* MIJOZ UCHUN KUZATISH HAVOLASI - Yandex tomonidan boshqariladigan,
                tashqi (mijoz o'zi ochadigan) sahifa. */}
            {trackingLink && (
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold"
              >
                {linkCopied ? <Check size={12} /> : <Copy size={12} />}
                {linkCopied ? t("referral.copied") : t("sellerOrders.yandexModal.copyTrackingLink")}
              </button>
            )}

            {phone && (
              <a
                href={`tel:${phone}`}
                className="flex items-center justify-center gap-2 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm font-bold"
              >
                <PhoneCall size={14} /> {phone}
              </a>
            )}
            {phoneError && <p className="text-[11px] text-rose-500 font-semibold text-center">{phoneError}</p>}
          </>
        )}

        {error && <p className="text-[11px] text-rose-500 font-semibold text-center">{error}</p>}
      </div>
    </div>
  );
};

export default YandexDeliveryStatusModal;
