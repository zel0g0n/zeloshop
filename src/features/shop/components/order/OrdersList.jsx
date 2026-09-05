import { useNavigate } from 'react-router-dom'
import Order from './Order'
import useGetClientOrdersData from "@/hooks/seller/useClientOrder";
import { useSession } from '@/context/SessionContext';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ArrowLeft, ReceiptText } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const OrdersList = () => {
  const { clientId, sellerId } = useSession();
  const { orders, loading, error } = useGetClientOrdersData(clientId, sellerId)
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="z-20 border-b border-gray-100 dark:border-slate-800 p-4 pb-36 min-h-screen bg-gray-50/50 dark:bg-slate-950 transition-colors duration-300">
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center shrink-0 active:scale-95 transition-transform"
        >
          <ArrowLeft size={16} className="text-gray-600 dark:text-slate-300" />
        </button>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight">{t("ordersPage.title")}</h1>
      </div>

      {loading && (
        <div className="max-w-md mx-auto">
          <ListSkeleton count={3} />
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-16 text-sm text-rose-500 font-medium">{t("ordersPage.error")} {error}</div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ReceiptText size={36} className="text-gray-300 dark:text-slate-700 mb-2" />
          <p className="text-sm font-bold text-gray-700 dark:text-slate-200">{t("ordersPage.emptyTitle")}</p>
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
