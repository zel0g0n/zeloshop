import { useState, useMemo } from 'react';
import useGetOrdersData from '@/hooks/seller/useFilterOrders';
import OrderRow from './OrderCard';
import { useSession } from '@/context/SessionContext';
const SellerOrdersPage = () => {
  const [activeTab, setActiveTab] = useState('Yangi');
  const { sellerId } = useSession();
  const { orders = [], loading, error } = useGetOrdersData(sellerId);
  const statusMap = {
    'Yangi': 'new',
    'Bekor qilingan': 'cancel',
    'Tasdiqlandi': 'approved'
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => order.status === statusMap[activeTab]);
  }, [orders, activeTab]);

  

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="text-center py-20 text-gray-400 text-xs animate-pulse">Buyurtmalar yuklanmoqda...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] text-red-500 text-xs font-medium">
        Xatolik yuz berdi: {error}
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24 pt-4">
      {/* Sahifa sarlavhasi */}
      <div className="max-w-md mx-auto px-4 mb-5">
        <h1 className="text-2xl font-black text-[#1e293b]">Buyurtmalar</h1>
        <p className="text-xs text-gray-400 mt-1">Tizimdagi barcha buyurtmalar ro'yxati</p>
      </div>

      {/* TABS PANEL */}
      <div className="max-w-md mx-auto px-4 mb-6">
        <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 flex justify-between gap-1">
          {['Yangi', 'Bekor qilingan', 'Tasdiqlandi'].map((status) => (
            <button
              key={status}
              onClick={() => setActiveTab(status)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                activeTab === status 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/10' 
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <span>{status}</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === status ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {orders.filter(o => o.status === statusMap[status]).length}
              </span>
            </button>
          ))}
        </div>
        {filteredOrders.map((order, index) => (
          <OrderRow key={order.id} count={index} order={order} />
        ))}
      </div>
      

      
    </div>
  );
};

export default SellerOrdersPage;