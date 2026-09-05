import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, BarChart3, ChevronRight } from 'lucide-react';
import useGetOrdersData from '@/hooks/seller/useFilterOrders';
import { useLanguage } from '@/context/LanguageContext';
import OrderRow from './OrderCard';
import OrdersBulkActionBar from './OrdersBulkActionBar';
import OrdersSkeleton from './OrdersSkeleton';
import Toast from '@/components/ui/Toast';
import { useSession } from '@/context/SessionContext';
import { ORDER_STATUS_TABS, getOrderStatusInfo } from '@/constants/orderStatus';
import bulkUpdateOrders, { bulkHideOrders } from '@/services/orders/bulkUpdateOrders';
import { filterOrders, computeOrderNumbers, computeDeliveredRevenue, computeActiveOrdersCount } from '@/utils/orderFilters';
import { getCourierList } from '@/services/couriers/getCourierList';
import { playNewOrderChime } from '@/utils/notificationSound';

// Har bir bo'limda (tab) bir vaqtning o'zida ko'rsatiladigan
// buyurtmalar soni - ro'yxat uzun bo'lib ketmasligi uchun. "Yana
// ko'rsatish" tugmasi bosilganda shu qadar ko'payadi. MUHIM: bu,
// `useFilterOrders.jsx`dagi SERVERDAN yuklash sahifalanishi
// (`hasMore`/`loadMore`) bilan bir XIL narsa EMAS - bu FAQAT allaqachon
// yuklab olingan (va joriy tab/qidiruvga mos) buyurtmalarni, mahalliy
// ravishda, bosqichma-bosqich ko'rsatish uchun.
const PAGE_SIZE = 8;

const SellerOrdersPage = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('new');
  const [searchQuery, setSearchQuery] = useState('');
  const { sellerId } = useSession();
  const { orders = [], loading, hasMore, loadMore } = useGetOrdersData(sellerId);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // KURYERLAR RO'YXATI (v39) — SHU YERDA, PARENT'DA obuna bo'linadi,
  // har bir `<OrderRow>` o'zicha alohida Firestore so'rovi
  // yubormasligi uchun (buyurtmalar ro'yxati o'nlab elementdan iborat
  // bo'lishi mumkin — N marta bir xil so'rovni takrorlash shart emas).
  const [couriers, setCouriers] = useState([]);
  useEffect(() => {
    if (!sellerId) return undefined;
    const unsubscribe = getCourierList(sellerId, setCouriers, () => {});
    return () => unsubscribe?.();
  }, [sellerId]);

  // YANGI BUYURTMA — OVOZLI SIGNAL (ilova OCHIQ turgan paytda, sotuvchi
  // shu sahifani ochib qo'ygan bo'lsa). `createdAt`ning ENG KATTA
  // qiymati kuzatiladi (ID to'plami EMAS) — MUHIM SABAB: "Yana
  // ko'rsatish"/`loadMore` sahifalash chegarasi kengaytirilganda
  // (`pageSize` oshganda) so'rov natijasiga ESKI (avval yuklanmagan)
  // buyurtmalar HAM qo'shiladi — agar ID to'plami solishtirilsa, ular
  // "yangi" deb, nototo'g'ri ovoz chalib yuborar edi. `createdAt`
  // buyurtmalar har doim vaqt bo'yicha KAMAYIB boruvchi tartibda
  // kelgani uchun, `loadMore` FAQAT eski (kichikroq `createdAt`)
  // buyurtmalarni qo'shadi — ular hech qachon joriy maksimal
  // qiymatdan OSHMAYDI, shuning uchun bu usul ishonchli.
  const lastMaxCreatedAtRef = useRef(null);
  useEffect(() => {
    if (!orders || orders.length === 0) return;
    const maxCreatedAt = orders.reduce((max, o) => Math.max(max, o.createdAt || 0), 0);
    if (lastMaxCreatedAtRef.current === null) {
      lastMaxCreatedAtRef.current = maxCreatedAt;
      return;
    }
    if (maxCreatedAt > lastMaxCreatedAtRef.current) {
      playNewOrderChime();
      lastMaxCreatedAtRef.current = maxCreatedAt;
    }
  }, [orders]);

  const isLoading = loading;

  const filteredOrders = useMemo(
    () => filterOrders(orders, { activeTab, searchQuery }),
    [orders, activeTab, searchQuery]
  );

  const visibleOrders = useMemo(
    () => filteredOrders.slice(0, visibleCount),
    [filteredOrders, visibleCount]
  );

  const orderNumbers = useMemo(() => computeOrderNumbers(orders), [orders]);
  const totalRevenue = useMemo(() => computeDeliveredRevenue(orders), [orders]);
  const activeOrdersCount = useMemo(() => computeActiveOrdersCount(orders), [orders]);

  // MUHIM TUZATISH (v34): OLDIN tanlangan buyurtmalar (`selectedIds`)
  // bo'lim (tab) yoki qidiruv o'zgarganda ham SAQLANIB QOLARDI -
  // masalan "Yangi"da 2 ta buyurtma tanlab, "Yig'ilmoqda"ga o'tilsa,
  // o'sha ESKI (joriy ro'yxatda umuman yo'q) ID'lar "2 ta tanlandi"
  // deb ko'rsatilishda davom etar edi. Endi tab yoki qidiruv
  // o'zgarganda tanlov avtomatik tozalanadi - har bir bo'lim/qidiruv
  // natijasi o'z holicha, mustaqil tanlov konteksti hisoblanadi.
  // Ko'rinadigan buyurtmalar sonini ham (sahifalash) shu bilan birga
  // boshidan boshlaymiz.
  // MUHIM: `useEffect` EMAS - React'ning "render paytida state'ni
  // moslashtirish" naqshi ishlatildi (rasmiy tavsiya: activeTab/
  // searchQuery o'zgarishini kuzatib, RENDER vaqtida qayta o'rnatish) -
  // bu, effektdan keyingi qo'shimcha (eski holatni bir lahza
  // ko'rsatadigan) render bosqichini oldini oladi.
  const filterKey = `${activeTab}::${searchQuery}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setSelectedIds(new Set());
    setVisibleCount(PAGE_SIZE);
  }

  const handleToggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkAction = useCallback(async (newStatus) => {
    setBulkBusy(true);
    setBulkError(null);
    try {
      await bulkUpdateOrders(Array.from(selectedIds), newStatus);
      setSelectedIds(new Set());
    } catch (err) {
      setBulkError(err.message);
    } finally {
      setBulkBusy(false);
    }
  }, [selectedIds]);

  const handleBulkHide = useCallback(async () => {
    setBulkBusy(true);
    setBulkError(null);
    try {
      await bulkHideOrders(Array.from(selectedIds));
      setSelectedIds(new Set());
    } catch (err) {
      setBulkError(err.message);
    } finally {
      setBulkBusy(false);
    }
  }, [selectedIds]);

  return (
    <div className="h-screen flex flex-col bg-[#f8fafc] dark:bg-slate-950 transition-colors duration-300">

      <div className="shrink-0 sticky top-0 z-40 bg-[#f8fafc]/95 dark:bg-slate-950/95 border-b border-gray-100 dark:border-slate-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-[#1e293b] dark:text-white">{t("sellerOrders.title")}</h1>
            <p className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t("sellerOrders.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/seller/orders/analytics")}
            className="group shrink-0 flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 dark:from-indigo-500/15 dark:to-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20 active:scale-95 transition-transform"
          >
            <span className="relative w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-sm shadow-indigo-600/30">
              <BarChart3 size={14} className="text-white" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-950 animate-pulse" />
            </span>
            <div className="text-right leading-tight">
              <span className="block text-xs font-black text-slate-800 dark:text-white">{totalRevenue.toLocaleString()} so'm</span>
              <span className="block text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{activeOrdersCount} {t("sellerOrders.activeSuffix")}</span>
            </div>
            <ChevronRight size={13} className="text-indigo-400 dark:text-indigo-500 shrink-0 group-active:translate-x-0.5 transition-transform" />
          </button>
        </div>

        <div className="relative">
          <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 dark:text-slate-500">
            <Search size={15} />
          </span>
          <input
            type="text"
            placeholder={t("sellerOrders.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs font-semibold text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-gray-400 dark:placeholder:text-slate-500"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide -mx-4 px-4">
          {ORDER_STATUS_TABS.map((status) => {
            const info = getOrderStatusInfo(status);
            // `hiddenAt` bilan tarixdan yashirilgan buyurtmalar tab
            // sonidan ham chiqarib tashlanadi - ro'yxatda ko'rinmasa,
            // hisoblagichda ham ko'rinmasligi kerak (bu faqat KO'RINISH
            // hisoblagichi, daromad/analitika hisob-kitobi EMAS).
            const count = orders.filter((o) => o.status === status && !o.hiddenAt).length;
            const isActive = activeTab === status;
            return (
              <button
                key={status}
                onClick={() => setActiveTab(status)}
                className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-300 border border-gray-100 dark:border-slate-800'
                }`}
              >
                <span>{t(`orderStatus.${info.key}`)}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-36 pt-3 max-w-md mx-auto w-full">
        {bulkError && <div className="text-center py-2 text-rose-500 dark:text-rose-400 text-xs font-semibold">{bulkError}</div>}

        {selectedIds.size > 0 && (
          <OrdersBulkActionBar
            selectedCount={selectedIds.size}
            activeTab={activeTab}
            busy={bulkBusy}
            onCancelReset={() => setSelectedIds(new Set())}
            onApprove={() => handleBulkAction("processing")}
            onShip={() => handleBulkAction("shipped")}
            onCancel={() => handleBulkAction("cancel")}
            onHide={handleBulkHide}
          />
        )}

        {isLoading && <OrdersSkeleton />}

        {!isLoading && filteredOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex items-center justify-center text-gray-400 dark:text-slate-500">
              <ShoppingBag size={24} />
            </div>
            <p className="text-sm font-bold text-gray-700 dark:text-slate-200">{t("sellerOrders.emptyState")}</p>
          </div>
        )}

        {!isLoading && filteredOrders.length > 0 && (
          <div className="space-y-3">
            {visibleOrders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                orderNumber={orderNumbers.get(order.id)}
                isSelected={selectedIds.has(order.id)}
                onToggleSelect={handleToggleSelect}
                onCopied={() => setToastMessage(t("sellerOrders.copied"))}
                couriers={couriers}
              />
            ))}
          </div>
        )}

        {/* FOYDALANUVCHI SO'ROVI BILAN QO'SHILDI (v34): joriy bo'lim/
            qidiruvga mos buyurtmalar ro'yxati juda uzun bo'lib
            ketmasligi uchun, avval faqat `PAGE_SIZE` (8) tasi
            ko'rsatiladi - "Yana ko'rsatish" bosilganda yana shuncha
            ochiladi. Bu, allaqachon yuklangan `orders` massivi
            ICHIDA sahifalash - agar SHU ro'yxat ham tugab, lekin
            serverda yana buyurtma bo'lsa (`hasMore`), o'shandagina
            asl "Yana yuklash" (serverdan) tugmasi ko'rsatiladi. */}
        {!isLoading && filteredOrders.length > visibleCount && (
          <button
            type="button"
            onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
            className="w-full h-11 mt-3 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 font-bold text-xs rounded-2xl active:scale-95 transition-transform"
          >
            {t("sellerOrders.showMore")}
          </button>
        )}

        {!isLoading && filteredOrders.length <= visibleCount && hasMore && (
          <button
            type="button"
            onClick={loadMore}
            className="w-full h-11 mt-3 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 font-bold text-xs rounded-2xl active:scale-95 transition-transform"
          >
            {t("sellerOrders.loadMore")}
          </button>
        )}
      </div>

      {toastMessage && <Toast message={toastMessage} onDone={() => setToastMessage(null)} />}
    </div>
  );
};

export default SellerOrdersPage;
