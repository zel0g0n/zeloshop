import React from 'react'
import ProductItem from './ProductItem'
import { useFilterProducts } from "@/hooks/useFilterPriduct";

const ProductsList = () => {
  const products = useFilterProducts().filteredProducts;
  return (
    <div>
      {products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductItem key={product.id} prod={product} />
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

export default ProductsList