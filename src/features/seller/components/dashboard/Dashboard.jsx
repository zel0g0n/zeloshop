import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Share2, Plus, Package as PackageIcon, Megaphone } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import useGetOrdersData from "@/hooks/seller/useFilterOrders";
import useGetProductsData from "@/hooks/seller/useGetSellerProducts";
import { buildShopLink } from "@/utils/shareLink";
import { getRangeStart } from "@/utils/dateRange";
import TimeframeTabs from "./TimeframeTabs";
import SalesSummaryCard from "./SalesSummaryCard";
import BentoGrid from "./BentoGrid";
import RecentOrdersList from "./RecentOrdersList";
import ShareStoreModal from "./ShareStoreModal";
import DashboardSkeleton from "./DashboardSkeleton";
import Toast from "@/components/ui/Toast";
import StatusModal from "@/components/ui/StatusModal";

// OLDIN: bu sahifa oddiy statistika ko'rsatuvchi sahifa edi — endi
// to'liq SaaS darajasidagi analitika: maxfiylik rejimi, real vaqtli
// grafik, foyda (P&L) hisob-kitobi (mahsulotlarning haqiqiy tannarxi
// asosida), va tezkor ulashish.
const Dashboard = () => {
  const { sellerId, store } = useSession();
  const [timeframe, setTimeframe] = useState("Bugun");
  const [showShareModal, setShowShareModal] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [comingSoon, setComingSoon] = useState(null);

  const { orders = [], loading: ordersLoading } = useGetOrdersData(sellerId);
  const { products = [], loading: productsLoading } = useGetProductsData(sellerId);

  const isLoading = ordersLoading || productsLoading;

  // MUHIM DIAGNOSTIKA (vaqtinchalik) — Dashboard HAQIQIY tarkibni
  // chizishga tayyor bo'lgan aniq daqiqani belgilaydi. Agar shu
  // qator bilan brauzerning haqiqiy LCP vaqti orasida katta farq
  // bo'lsa, demak muammo React render/commit jarayonining o'zida.
  const dashboardReadyLoggedRef = useRef(false);
  useEffect(() => {
    if (!isLoading && window.__appLoadStart !== undefined) {
      if (!dashboardReadyLoggedRef.current) {
        dashboardReadyLoggedRef.current = true;
        console.log(
          "7️⃣ Sahifa boshidan Dashboard RENDER qilishga tayyor bo'lgunicha (BIRINCHI):",
          (performance.now() - window.__appLoadStart).toFixed(2),
          "ms"
        );
      } else {
        console.log(
          "7️⃣❗ Dashboard isLoading QAYTA false bo'ldi (kutilmagan):",
          (performance.now() - window.__appLoadStart).toFixed(2),
          "ms"
        );
      }
    }
  }, [isLoading]);

  const costPriceMap = useMemo(() => {
    const map = new Map();
    products.forEach((p) => map.set(p.id, Number(p.costPrice) || 0));
    return map;
  }, [products]);

  const stats = useMemo(() => {
    const rangeStart = getRangeStart(timeframe);
    const rangeLength = Date.now() - rangeStart;
    const prevRangeStart = rangeStart - rangeLength;

    const currentOrders = orders.filter((o) => o.createdAt >= rangeStart);
    const previousOrders = orders.filter((o) => o.createdAt >= prevRangeStart && o.createdAt < rangeStart);

    const totalSales = currentOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
    const previousSales = previousOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
    const growthPercent = previousSales > 0 ? Math.round(((totalSales - previousSales) / previousSales) * 100) : null;

    let totalCost = 0;
    currentOrders.forEach((order) => {
      (order.orders || []).forEach((item) => {
        totalCost += (costPriceMap.get(item.id) || 0) * (Number(item.quantity) || 0);
      });
    });
    const netProfit = totalSales - totalCost;
    const profitMargin = totalSales > 0 ? Math.round((netProfit / totalSales) * 100) : 0;

    const pendingCount = currentOrders.filter((o) => o.status === "pending" || o.status === "new").length;
    const lowStockCount = products.filter((p) => Number(p.stock) <= 3).length;
    const activeProductsCount = products.filter((p) => p.isActive ?? true).length;

    return {
      totalSales,
      growthPercent,
      netProfit,
      profitMargin,
      ordersCount: currentOrders.length,
      pendingCount,
      activeProductsCount,
      lowStockCount,
    };
  }, [orders, products, timeframe, costPriceMap]);

  const handleQuickShare = useCallback(async () => {
    const link = buildShopLink(sellerId);
    try {
      await navigator.clipboard.writeText(link);
      setToastMessage("Link nusxalandi! 📋");
    } catch {
      // Clipboard API ishlamasa (ba'zi eski WebView'lar), to'liq
      // ulashish oynasini ochamiz — u yerda qo'lda nusxalash mumkin.
      setShowShareModal(true);
    }
  }, [sellerId]);

  return (
    <div className="h-screen flex flex-col bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased transition-colors duration-300">

      {/* Sticky yuqori qism */}
      <div className="shrink-0 sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-slate-800 dark:text-white tracking-tight">
              Boshqaruv paneli
            </span>
            <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[9px] font-black px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-500/20">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
              <span>LIVE</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsPrivate((v) => !v)}
              className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center active:scale-90 transition-transform"
              aria-label={isPrivate ? "Ko'rsatish" : "Yashirish"}
            >
              {isPrivate ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <button
              type="button"
              onClick={handleQuickShare}
              className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center active:scale-90 transition-transform"
              aria-label="Do'konni ulashish"
            >
              <Share2 size={14} />
            </button>
          </div>
        </div>

        <div className="px-5 pb-3">
          <TimeframeTabs timeframe={timeframe} onChange={setTimeframe} />
        </div>
      </div>

      {/* Faqat shu qism skroll bo'ladi */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <div className="p-4 space-y-4 pb-28 animate-fade-in">
            <SalesSummaryCard
              timeframe={timeframe}
              totalSales={stats.totalSales}
              growthPercent={stats.growthPercent}
              orders={orders}
              isPrivate={isPrivate}
            />

            <button
              onClick={() => setShowShareModal(true)}
              className="w-full h-12 bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-black text-xs rounded-2xl shadow-2xs flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <Share2 size={13} />
              <span>Do'konni ulashish</span>
            </button>

            <BentoGrid
              netProfit={stats.netProfit}
              profitMargin={stats.profitMargin}
              ordersCount={stats.ordersCount}
              pendingCount={stats.pendingCount}
              activeProductsCount={stats.activeProductsCount}
              lowStockCount={stats.lowStockCount}
              isPrivate={isPrivate}
            />

            <div>
              <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1">⚡️ Tezkor amallar</h3>
              <div className="grid grid-cols-3 gap-2">
                <Link to="/seller/add-product" className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-2xs flex flex-col items-center justify-center text-center gap-1.5 active:scale-95 transition-transform">
                  <Plus size={16} className="text-indigo-500" />
                  <span className="text-[9px] font-black text-slate-700 dark:text-slate-200 leading-tight">Yangi Tovar</span>
                </Link>
                <Link to="/seller/orders" className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-2xs flex flex-col items-center justify-center text-center gap-1.5 active:scale-95 transition-transform">
                  <PackageIcon size={16} className="text-indigo-500" />
                  <span className="text-[9px] font-black text-slate-700 dark:text-slate-200 leading-tight">Buyurtmalar</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setComingSoon("Aksiya yaratish")}
                  className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-2xs flex flex-col items-center justify-center text-center gap-1.5 active:scale-95 transition-transform"
                >
                  <Megaphone size={16} className="text-indigo-500" />
                  <span className="text-[9px] font-black text-slate-700 dark:text-slate-200 leading-tight">Aksiya Yaratish</span>
                </button>
              </div>
            </div>

            <RecentOrdersList orders={orders} />
          </div>
        )}
      </div>

      {showShareModal && (
        <ShareStoreModal sellerId={sellerId} storeName={store?.storeName} onClose={() => setShowShareModal(false)} />
      )}

      {toastMessage && (
        <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
      )}

      {comingSoon && (
        <StatusModal
          variant="info"
          title="Tez orada"
          message={`"${comingSoon}" bo'limi hali ishlab chiqilmoqda.`}
          onClose={() => setComingSoon(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
