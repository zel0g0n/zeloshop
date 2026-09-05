import { useEffect, useMemo, useRef, useState } from "react";
import { Bike, Store, Search, Settings } from "lucide-react";
import { useCourierSession } from "@/context/CourierSessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { getCourierOrderData } from "@/services/orders/getOrderData";
import { triggerHaptic } from "@/config/telegram";
import { subscribeToCourierStatus } from "@/services/couriers/getCourierList";
import { setCourierActive } from "@/services/couriers/courierManagement";
import { updateCourierLocation } from "@/services/couriers/courierOrderActions";
import { playNewOrderChime } from "@/utils/notificationSound";
import { toMillis } from "@/utils/firestoreTime";
import { watchCourierLocation, openCourierLocationSettings, isLocationSettingsShortcutAvailable } from "@/utils/geolocation";
import {
  COURIER_TABS,
  NEW_STATUSES,
  getCourierTab,
  filterCourierOrdersForTab,
  computeCourierTabCounts,
  findActiveCourierOrderId,
} from "@/utils/courierOrderFilters";
import CourierOrderCard from "./CourierOrderCard";
import CourierProfileModal from "./CourierProfileModal";

/**
 * KURYER Mini App'ining YAGONA sahifasi. Dizayn — mavjud sotuvchi
 * ilovasi bilan BIR XIL "til" (yumaloq kartochkalar, `lucide-react`
 * ikonkalar, dark-mode qo'llab-quvvatlashi), lekin ATAYLAB indigo/blue
 * o'rniga TEAL (`#0d9488`) urg'u rangi bilan — kuryer, sotuvchi yoki
 * mijoz EMASLIGINI, birinchi qarashda vizual ravishda aniq ajratish
 * uchun (loyihaning "har bir rol o'z rangiga ega" konventsiyasi:
 * sotuvchi=indigo, mijoz=blue).
 *
 * YANGI, IKKINCHI ROUND (foydalanuvchi live-test skrinshotlaridan
 * keyin so'ragan tuzatishlar): (1) "Jarayonda" ALOHIDA yorliq —
 * faqat BITTA, HAQIQATAN yo'ldagi yetkazmani ko'rsatadi (bir vaqtning
 * o'zida ikkitasini olib borish mantiqan noto'g'ri — manzillar har
 * xil); (2) dastlabki holatda ("assigned") FAQAT "Boshlash"/"Bekor
 * qilish" tugmalari — "Yetkazildi"/"Yetkaza olmadim" endi FAQAT
 * "Boshlash" bosilgach ko'rinadi, va kuryer bir vaqtning o'zida
 * FAQAT BITTA yetkazmani boshlashi mumkin (`canStart` — boshqa
 * hech qanday buyurtma "picked_up" bo'lmasa `true`); (3) "Boshlash"
 * bosilgach, jonli joylashuv ~8 soniyada bir marta buyurtma hujjatiga
 * yoziladi (`updateCourierLocation`) — bu ma'lumotdan HAM kuryerning
 * o'z jonli xaritasi (`CourierOrderCard.jsx`), HAM mijozning kuzatuv
 * sahifasi (`CourierTrackingPage.jsx`) foydalanadi.
 *
 * ISHONCHLILIK TUZATISHI (UX/kod sifati bo'yicha qayta ko'rib
 * chiqishdan keyin): joylashuv endi oddiy `navigator.geolocation`
 * O'RNIGA `src/utils/geolocation.js`dagi `watchCourierLocation` orqali
 * olinadi — bu AVVAL Telegramning O'ZINING `LocationManager` API'sini
 * sinab ko'radi (Telegram WebView'da brauzer geolokatsiyasidan
 * ANCHA ishonchli), faqat u mavjud bo'lmasa brauzerga qaytadi. Ruxsat
 * ANIQ rad etilganda, Telegram ichida bo'lsa, "Sozlamalarni ochish"
 * tugmasi ham ko'rsatiladi (`openCourierLocationSettings`).
 */
const CourierOrdersPage = () => {
  const { t } = useLanguage();
  const { courierId, courierName, store } = useCourierSession();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("new");
  const [searchQuery, setSearchQuery] = useState("");

  const [courierActive, setCourierActiveState] = useState(null); // null = hali yuklanmoqda
  const [togglePending, setTogglePending] = useState(false);
  const [toggleError, setToggleError] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // YANGI — kuryerning O'ZINING to'liq hujjati (`ism`/`telefon`/`status`),
  // "Profil" modali uchun JONLI qiymatlar sifatida ishlatiladi.
  // MUHIM: alohida Firestore o'qish QILINMAYDI — pastdagi
  // `subscribeToCourierStatus` obunasi ALLAQACHON to'liq hujjatni
  // qaytaradi (faqat `status` maydoni emas), shuning uchun profil
  // modalidagi tahrirlar ham SHU obuna orqali avtomatik yangilanadi.
  const [liveCourierData, setLiveCourierData] = useState(null);

  // Ilgari ko'rilgan buyurtma ID'lari — YANGI biriktirilgan
  // topshiriqni aniqlash uchun (ovozli signal qachon chalinishi
  // kerakligini bilish). `null` = hali BIRINCHI marta yuklanmagan
  // (birinchi yuklashda HECH QACHON ovoz chalinmasligi kerak — aks
  // holda ilova har ochilganda mavjud barcha buyurtmalar uchun ovoz
  // chalinib ketardi).
  const seenOrderIdsRef = useRef(null);

  useEffect(() => {
    if (!courierId) return undefined;
    const unsubscribe = getCourierOrderData(
      courierId,
      (data) => {
        if (seenOrderIdsRef.current) {
          const hasNewAssignment = data.some(
            (o) => NEW_STATUSES.includes(o.courierDeliveryStatus) && !seenOrderIdsRef.current.has(o.id)
          );
          if (hasNewAssignment) {
            playNewOrderChime();
            triggerHaptic("notification", "success");
          }
        }
        seenOrderIdsRef.current = new Set(data.map((o) => o.id));
        setOrders(data);
        setLoading(false);
      },
      (err) => { console.error("Kuryer buyurtmalarini yuklashda xatolik:", err); setLoading(false); }
    );
    return () => unsubscribe?.();
  }, [courierId]);

  useEffect(() => {
    if (!courierId) return undefined;
    const unsubscribe = subscribeToCourierStatus(
      courierId,
      (data) => {
        setCourierActiveState(data ? data.status !== "inactive" : true);
        setLiveCourierData(data);
      },
      (err) => console.error("Kuryer holatiga obuna bo'lishda xatolik:", err)
    );
    return () => unsubscribe?.();
  }, [courierId]);

  // HOZIR "picked_up" (Jarayonda) bosqichidagi YAGONA buyurtma ID'si
  // — bo'lsa, jonli joylashuv shunga yuboriladi; bo'lmasa, boshqa
  // "assigned" buyurtmalar "Boshlash"ni bosishi mumkin.
  const activeOrderId = useMemo(() => findActiveCourierOrderId(orders), [orders]);

  useEffect(() => {
    if (!activeOrderId) return undefined;
    const stopWatching = watchCourierLocation(
      (coords) => {
        setLocationError(null);
        updateCourierLocation(activeOrderId, coords.lat, coords.lng).catch(() => {});
      },
      () => setLocationError(t("courierApp.locationPermissionError")),
      8000
    );
    return stopWatching;
  }, [activeOrderId, t]);

  const filteredOrders = useMemo(
    () => filterCourierOrdersForTab(orders, activeTab, searchQuery),
    [orders, activeTab, searchQuery]
  );

  const tabCounts = useMemo(() => computeCourierTabCounts(orders), [orders]);

  const stats = useMemo(() => {
    const delivered = orders.filter((o) => o.courierDeliveryStatus === "delivered");
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startMs = startOfToday.getTime();
    const today = delivered.filter((o) => {
      const ms = toMillis(o.updatedAt);
      return ms !== null && ms >= startMs;
    }).length;
    return { today, total: delivered.length };
  }, [orders]);

  const handleTabChange = (tab) => {
    if (tab === activeTab) return;
    triggerHaptic("selection");
    setActiveTab(tab);
  };

  const handleToggleActive = async () => {
    if (togglePending || courierActive === null) return;
    triggerHaptic("impact", "medium");
    setTogglePending(true);
    setToggleError(null);
    const nextActive = !courierActive;
    try {
      await setCourierActive(courierId, nextActive);
      triggerHaptic("notification", "success");
      // MUHIM: optimistik o'rnatish SHART EMAS — `subscribeToCourierStatus`
      // allaqachon jonli, o'zgarish bir zumda o'zi keladi. Lekin
      // biroz "sekinroq" tarmoqlarda tugma darhol javob bergandek
      // ko'rinishi uchun baribir mahalliy holatni ham yangilaymiz.
      setCourierActiveState(nextActive);
    } catch (err) {
      console.error("Kuryer holatini o'zgartirishda xatolik:", err);
      triggerHaptic("notification", "error");
      setToggleError(err.message || t("courierApp.toggleError"));
    } finally {
      setTogglePending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-950 font-sans">
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-11 h-11 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0">
            <Bike size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-black text-slate-800 dark:text-white truncate">{courierName || t("courierApp.defaultCourierName")}</h1>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 truncate">
              <Store size={11} /> {store?.storeName || t("courierApp.defaultStoreName")}
            </p>
          </div>

          {/* YANGI, IXCHAM aktivlik ko'rsatkichi — avvalgi "Yopish"
              tugmasi o'rnida, yuqorida (foydalanuvchi so'rovi bo'yicha:
              kuryer ilovani yopish o'rniga faqat aktiv/band holatini
              tez almashtira olishi kerak, alohida katta panelga hojat
              yo'q). */}
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={togglePending || courierActive === null}
            aria-label={courierActive ? t("courierApp.statusOnline") : t("courierApp.statusOffline")}
            className={`shrink-0 flex items-center gap-1.5 h-8 pl-2.5 pr-1 rounded-full border transition-colors disabled:opacity-60 ${
              courierActive
                ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20"
                : "bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${courierActive ? "bg-emerald-500 animate-pulse" : "bg-gray-400 dark:bg-slate-600"}`} />
            <span className={`text-[9px] font-black uppercase tracking-wide whitespace-nowrap ${courierActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"}`}>
              {courierActive ? t("courierApp.statusOnline") : t("courierApp.statusOffline")}
            </span>
            <span className={`relative w-7 h-4 rounded-full ml-0.5 transition-colors ${courierActive ? "bg-teal-600" : "bg-gray-300 dark:bg-slate-700"}`}>
              <span
                className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
                  courierActive ? "translate-x-3" : ""
                }`}
              />
            </span>
          </button>

          {/* YANGI — Profil (ism/telefon tahrirlash, til, ko'rinish
              rejimi, "kuryerlikni to'xtatish") modalini ochish tugmasi. */}
          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            aria-label={t("courierApp.profileAria")}
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 flex items-center justify-center shrink-0 active:scale-95 transition-transform"
          >
            <Settings size={16} />
          </button>
        </div>
        {toggleError && <p className="mt-1.5 text-[10px] text-rose-500 font-semibold">{toggleError}</p>}
        {locationError && (
          <div className="mt-1.5 flex items-center justify-between gap-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-2.5 py-1.5">
            <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">{locationError}</p>
            {isLocationSettingsShortcutAvailable() && (
              <button
                type="button"
                onClick={openCourierLocationSettings}
                className="shrink-0 text-[10px] font-bold text-amber-700 dark:text-amber-400 underline underline-offset-2 flex items-center gap-1"
              >
                <Settings size={11} /> {t("courierApp.openLocationSettings")}
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-1.5 mt-3">
          {COURIER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`h-9 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-colors ${
                activeTab === tab.key ? "bg-teal-600 text-white" : "bg-gray-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
              }`}
            >
              {t(`courierApp.${tab.labelKey}`)} {tabCounts[tab.key] > 0 ? `(${tabCounts[tab.key]})` : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3 pb-24">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-900 border border-gray-100/80 dark:border-slate-800 rounded-2xl p-3">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("courierApp.statsDeliveredToday")}</p>
            <p className="text-xl font-black text-teal-600 dark:text-teal-400 mt-0.5">{stats.today}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-gray-100/80 dark:border-slate-800 rounded-2xl p-3">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("courierApp.statsDeliveredTotal")}</p>
            <p className="text-xl font-black text-slate-800 dark:text-white mt-0.5">{stats.total}</p>
          </div>
        </div>

        <div className="relative">
          <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 dark:text-slate-500">
            <Search size={15} />
          </span>
          <input
            type="text"
            placeholder={t("courierApp.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs font-semibold text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 placeholder:text-gray-400 dark:placeholder:text-slate-500"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
            <Bike size={36} className="text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
              {t(`courierApp.${getCourierTab(activeTab).emptyKey}`)}
            </p>
          </div>
        ) : (
          filteredOrders.map((order, index) => (
            <CourierOrderCard
              key={order.id}
              order={order}
              orderNumber={filteredOrders.length - index}
              canStart={!activeOrderId}
              defaultOpen={order.courierDeliveryStatus === "picked_up"}
            />
          ))
        )}
      </div>

      {showProfileModal && (
        <CourierProfileModal
          courierId={courierId}
          name={liveCourierData?.name || courierName || ""}
          phone={liveCourierData?.phone || ""}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </div>
  );
};

export default CourierOrdersPage;
