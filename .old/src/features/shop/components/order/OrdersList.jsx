import React from 'react'
import Order from './Order'
import useGetClientOrdersData from "@/hooks/seller/useClientOrder";

const OrdersList = () => {
  const clientId = 'QdPK91xipZh6c6JHaupV'
  const {orders} = useGetClientOrdersData(clientId)

  return (
    <div className="backdrop-blur-md z-20 border-b border-gray-100 p-4">
      <h1 className="text-xl font-bold text-gray-800 tracking-tight mb-4">Mening Buyurtmalarim</h1>

      <div className="p-4 space-y-3 bg-white rounded-2xl p-4 border border-gray-100/80 shadow-sm space-y-3 max-w-md mx-auto transition-all duration-300">
        {orders.map((order) => (
          <Order key={order.id} order={order} />
        ))}
      </div>
    </div>
  )
}

export default OrdersList