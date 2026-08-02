import { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, ShoppingBag } from 'lucide-react';
import useGetOrdersData from '@/hooks/seller/useFilterOrders';
import OrderRow from './OrderCard';
import OrdersBulkActionBar from './OrdersBulkActionBar';
import OrdersSkeleton from './OrdersSkeleton';
import Toast from '@/components/ui/Toast';
import { useSession } from '@/context/SessionContext';
import { ORDER_STATUS_TABS, getOrderStatusInfo } from '@/constants/orderStatus';
import bulkUpdateOrders from '@/services/orders/bulkUpdateOrders';

const SellerOrdersPage = () => {
  const [activeTab, setActiveTab] = useState('new');
  const [searchQuery, setSearchQuery] = useState('');
  const { sellerId } = useSession();
  const { orders = [], loading } = useGetOrdersData(sellerId);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const isLoading = loading;

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesTab = order.status === activeTab;
      if (!query) return matchesTab;
      const idMatch = String(order.id || "").toLowerCase().includes(query);
      const nameMatch = (order.customer?.fullName || "").toLowerCase().includes(query);
      const phoneMatch = (order.customer?.phone || "").toLowerCase().includes(query);
      return matchesTab && (idMatch || nameMatch || phoneMatch);
    });
  }, [orders, activeTab, searchQuery]);

  const orderNumbers = useMemo(() => {
    const sorted = [...orders].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const map = new Map();
    sorted.forEach((o, index) => map.set(o.id, index + 1));
    return map;
  }, [orders]);

  const totalRevenue = useMemo(
    () => orders.filter((o) => o.status === "delivered").reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0),
    [orders]
  );
  const activeOrdersCount = useMemo(
    () => orders.filter((o) => !["delivered", "cancel"].includes(o.status)).length,
    [orders]
  );

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

  return (
    <div className="h-screen flex flex-col bg-[#f8fafc] dark:bg-slate-950 transition-colors duration-300">

      <div className="shrink-0 sticky top-0 z-40 backdrop-blur-md bg-[#f8fafc]/90 dark:bg-slate-950/90 border-b border-gray-100 dark:border-slate-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-[#1e293b] dark:text-white">Buyurtmalar</h1>
            <p className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Tizimdagi barcha buyurtmalar</p>
          </div>
          <div className="text-right">
            <span className="block text-xs font-black text-emerald-600 dark:text-emerald-400">{totalRevenue.toLocaleString()} so'm</span>
            <span className="block text-[10px] font-medium text-gray-500 dark:text-slate-400">{activeOrdersCount} ta faol</span>
          </div>
        </div>

        <div className="relative">
          <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 dark:text-slate-500">
            <Search size={15} />
          </span>
          <input
            type="text"
            placeholder="ID, mijoz ismi yoki telefon bo'yicha qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs font-semibold text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-gray-400 dark:placeholder:text-slate-500"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide -mx-4 px-4">
          {ORDER_STATUS_TABS.map((status) => {
            const info = getOrderStatusInfo(status);
            const count = orders.filter((o) => o.status === status).length;
            const isActive = activeTab === status;
            return (
              <button
                key={status}
                onClick={() => setActiveTab(status)}
                className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/10'
                    : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-300 border border-gray-100 dark:border-slate-800'
                }`}
              >
                <span>{info.shortLabel}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-32 pt-3 max-w-md mx-auto w-full">
        {bulkError && <div className="text-center py-2 text-rose-500 dark:text-rose-400 text-xs font-semibold">{bulkError}</div>}

        {selectedIds.size > 0 && (
          <OrdersBulkActionBar
            selectedCount={selectedIds.size}
            busy={bulkBusy}
            onCancelReset={() => setSelectedIds(new Set())}
            onApprove={() => handleBulkAction("processing")}
            onShip={() => handleBulkAction("shipped")}
            onCancel={() => handleBulkAction("cancel")}
          />
        )}

        {isLoading && <OrdersSkeleton />}

        {!isLoading && filteredOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex items-center justify-center text-gray-400 dark:text-slate-500">
              <ShoppingBag size={24} />
            </div>
            <p className="text-sm font-bold text-gray-700 dark:text-slate-200">Ushbu bo'limda buyurtmalar yo'q</p>
          </div>
        )}

        {!isLoading && filteredOrders.length > 0 && (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                orderNumber={orderNumbers.get(order.id)}
                isSelected={selectedIds.has(order.id)}
                onToggleSelect={handleToggleSelect}
                onCopied={() => setToastMessage("Nusxalandi! 📋")}
              />
            ))}
          </div>
        )}
      </div>

      {toastMessage && <Toast message={toastMessage} onDone={() => setToastMessage(null)} />}
    </div>
  );
};

export default SellerOrdersPage;
