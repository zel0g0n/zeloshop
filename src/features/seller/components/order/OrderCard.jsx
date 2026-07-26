import { memo, useState } from 'react';
import useChangeOrderStatus from '@/hooks/seller/useChangeOrderStatus';
const OrderRow = ({ order, count }) => {
  const [isOpen, setIsOpen] = useState(false);
  const {changeOrderStatus} = useChangeOrderStatus()
 


  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100/80 shadow-sm space-y-3 max-w-md mx-auto transition-all duration-300">
      
      {/* 1. DOIMO KO'RINIB TURADIGAN QISQA KO'RINISH */}
      <div className="flex justify-between items-start gap-2">
        <div className="space-y-1 max-w-[65%]">
          {/* ID va Vaqt */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-800 text-sm">#{count}</span>
            <span className="text-[11px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded font-mono">
              {order.createdAt ? new Date(order.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : '12:34'}
            </span>
          </div>
          
          {/* Mijoz ismi */}
          <p className="text-xs text-gray-500 truncate">
            Mijoz: <span className="font-bold text-gray-700">{order.customer?.fullName || 'Noma\'lum'}</span>
          </p>

          {/* Qisqacha joylashuv ma'lumoti */}
          <p className="text-[11px] text-gray-400 truncate">
            📍 {order.customer?.address || 'Manzil ko\'rsatilmagan'}
          </p>
        </div>
        
        {/* Summa, Status va Ochish Tugmasi */}
        <div className="text-right flex flex-col items-end space-y-1.5 shrink-0">
          <span className="font-black text-[#514be3] text-sm block font-mono">
            {Number(order.totalAmount).toLocaleString()} so'm
          </span>
          
          <div className="flex items-center gap-2">

            {/* Pastga/Tepaga ishora qiluvchi chiroyli Arrow Button */}
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="p-1 rounded-lg bg-gray-50 border border-gray-100 hover:bg-indigo-50 hover:text-[#514be3] transition-all text-gray-500 active:scale-95"
            >
              <svg 
                className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#514be3]' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 2. BATAFSIL KO'RINISH (Faqat isOpen true bo'lganda silliq ochiladi) */}
      {isOpen && (
        <div className="pt-2 space-y-3 border-t border-dashed border-gray-100 transition-all">
          
          {/* Aloqa va To'lov bloklari */}
          <div className="grid grid-cols-2 gap-2 bg-gray-50/60 rounded-xl p-2.5 text-xs text-gray-600">
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase">Telefon</p>
              <p className="font-semibold text-gray-700 font-mono">{order.customer?.phone || 'Yo\'q'}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase">To'lov turi</p>
              <p className="font-semibold text-gray-700 uppercase font-mono">
                {order.paymentMethod === 'cash' ? 'Naqd pul' : order.paymentMethod}
              </p>
            </div>
          </div>

          {/* To'liq Manzil Bloki */}
          <div className="bg-gray-50/60 rounded-xl p-2.5 text-xs text-gray-600">
            <p className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">To'liq Manzil</p>
            <p className="text-gray-700 font-medium whitespace-pre-line leading-relaxed">
              {order.customer?.address}
            </p>
          </div>

          {/* Mahsulotlarning rasmli ro'yxati */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-gray-400 font-bold uppercase px-1">Buyurtma tarkibi ({order.orders?.length || 0} ta)</p>
            <div className="bg-gray-50/60 rounded-xl p-2 text-xs text-gray-600 space-y-2">
              {order.orders?.map((item, index) => (
                <div
                  key={item.id || index}
                  className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 shadow-sm border border-gray-100"
                >
                  <img
                    src={item.image || "/placeholder.png"}
                    alt={item.name}
                    className="w-11 h-11 rounded-xl object-cover bg-gray-100 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-bold text-gray-800 truncate">
                      {item.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-400 font-mono">
                        x{item.quantity}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-gray-300" />
                      <span className="text-[10px] text-gray-500 font-medium font-mono">
                        {Number(item.price).toLocaleString()} so'm
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[12px] font-bold text-[#3B5BFF] font-mono">
                      {(item.price * item.quantity).toLocaleString()} so'm
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            {order.status === 'new' && (
              <button
                onClick={() => changeOrderStatus(order.id, 'approved')}
                className="flex-1 py-2 bg-[#514be3] text-white rounded-xl text-xs font-semibold hover:bg-[#433cc7] active:scale-[0.98] transition-all shadow-md shadow-indigo-100"
              >
                Jo'natish
              </button>
            )}
            
            {order.status !== 'cancel' && order.status !== 'approved' && (
              <button
                onClick={() => changeOrderStatus(order.id, 'cancel')}
                className="px-3 py-2 border border-red-100 text-red-500 rounded-xl text-xs font-medium hover:bg-rose-50 transition-colors"
              >
                Bekor qilish
              </button>
            )}
          </div>

        </div>
      )}

    </div>
  );
};

export default memo(OrderRow);