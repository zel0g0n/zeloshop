import Order from './Order'
import useGetClientOrdersData from "@/hooks/seller/useClientOrder";
import { useSession } from '@/context/SessionContext';
import { ListSkeleton } from '@/components/ui/Skeleton';

const OrdersList = () => {
  const { clientId, sellerId } = useSession();
  const { orders, loading, error } = useGetClientOrdersData(clientId, sellerId)

  return (
    <div className="backdrop-blur-md z-20 border-b border-gray-100 dark:border-slate-800 p-4 min-h-screen bg-gray-50/50 dark:bg-slate-950 transition-colors duration-300">
      <h1 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight mb-4">Mening Buyurtmalarim</h1>

      {loading && (
        <div className="max-w-md mx-auto">
          <ListSkeleton count={3} />
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-16 text-sm text-rose-500 font-medium">Xatolik: {error}</div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-4xl mb-2">🧾</span>
          <p className="text-sm font-bold text-gray-700 dark:text-slate-200">Hali buyurtmalar yo'q</p>
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="space-y-3 bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-100/80 dark:border-slate-800 shadow-sm max-w-md mx-auto transition-all duration-300">
          {orders.map((order) => (
            <Order key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  )
}

export default OrdersList
