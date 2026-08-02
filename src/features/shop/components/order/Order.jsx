import { memo, useState } from "react";
import { getOrderStatusInfo } from "@/constants/orderStatus";

const Order = ({order}) => {
  const [isOpen, setIsOpen] = useState(false);
  const statusInfo = getOrderStatusInfo(order.status);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-100/80 dark:border-slate-800 shadow-sm space-y-3 max-w-md mx-auto transition-all duration-300">
      
      <div className="flex justify-between items-start gap-2">
        <div className="space-y-1 max-w-[65%]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">
              {order.createdAt ? new Date(order.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : '12:34'}
            </span>
            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md inline-block ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
          
          <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
            Mijoz: <span className="font-bold text-gray-700 dark:text-slate-200">{order.customer?.fullName || 'Noma\'lum'}</span>
          </p>

          <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">
            📍 {order.customer?.address || 'Manzil ko\'rsatilmagan'}
          </p>
        </div>
        
        <div className="text-right flex flex-col items-end space-y-1.5 shrink-0">
          <span className="font-black text-[#514be3] dark:text-[#8b85f5] text-sm block font-mono">
            {Number(order.totalAmount).toLocaleString()} so'm
          </span>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="p-1 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-[#514be3] transition-all text-gray-500 dark:text-slate-400 active:scale-95"
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

      {isOpen && (
        <div className="pt-2 space-y-3 border-t border-dashed border-gray-100 dark:border-slate-700 transition-all">
          
          <div className="grid grid-cols-2 gap-2 bg-gray-50/60 dark:bg-slate-800/60 rounded-xl p-2.5 text-xs text-gray-600 dark:text-slate-300">
            <div>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase">Telefon</p>
              <p className="font-semibold text-gray-700 dark:text-slate-200 font-mono">{order.customer?.phone || 'Yo\'q'}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase">To'lov turi</p>
              <p className="font-semibold text-gray-700 dark:text-slate-200 uppercase font-mono">
                {order.paymentMethod === 'cash' ? 'Naqd pul' : order.paymentMethod}
              </p>
            </div>
          </div>

          <div className="bg-gray-50/60 dark:bg-slate-800/60 rounded-xl p-2.5 text-xs text-gray-600 dark:text-slate-300">
            <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase mb-0.5">To'liq Manzil</p>
            <p className="text-gray-700 dark:text-slate-200 font-medium whitespace-pre-line leading-relaxed">
              {order.customer?.address}
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase px-1">Buyurtma tarkibi ({order.orders?.length || 0} ta)</p>
            <div className="bg-gray-50/60 dark:bg-slate-800/60 rounded-xl p-2 text-xs text-gray-600 dark:text-slate-300 space-y-2">
              {order.orders?.map((item, index) => (
                <div
                  key={item.id || index}
                  className="flex items-center gap-3 rounded-xl bg-white dark:bg-slate-900 px-3 py-2 shadow-sm border border-gray-100 dark:border-slate-700"
                >
                  <img
                    src={item.image || "/placeholder.png"}
                    alt={item.name}
                    className="w-11 h-11 rounded-xl object-cover bg-gray-100 dark:bg-slate-800 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-bold text-gray-800 dark:text-white truncate">
                      {item.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">
                        x{item.quantity}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-slate-600" />
                      <span className="text-[10px] text-gray-500 dark:text-slate-400 font-medium font-mono">
                        {Number(item.price).toLocaleString()} so'm
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[12px] font-bold text-[#3B5BFF] dark:text-[#7c8fff] font-mono">
                      {(item.price * item.quantity).toLocaleString()} so'm
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default memo(Order)
