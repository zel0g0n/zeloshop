import React, { memo } from 'react'
import ProductItem from './ProductItem'

// OLDIN: bu komponent useFilterProducts() orqali "products" Redux slice'ini
// (ya'ni BARCHA sotuvchilarning mahsulotlari, getProducts() to'liq
// kolleksiya so'rovi) chaqirardi — sotuvchi boshqa sotuvchilarning
// mahsulotlarini ham ko'rardi va bunga qo'shimcha keraksiz Firestore
// so'rovi ham bo'lardi. Endi haqiqiy (sellerId bo'yicha filtrlangan)
// ro'yxat props orqali beriladi.
const ProductsList = ({ products, onEditProduct }) => {
  return (
    <div>
      {products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product) => (
            <div key={product.id} onClick={() => onEditProduct?.(product)} className="cursor-pointer">
              <ProductItem prod={product} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400 text-xs">
          Hech qanday maxsulot topilmadi.
        </div>
      )}
    </div>
  )
}

export default memo(ProductsList)
