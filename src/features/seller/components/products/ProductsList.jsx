import React, { memo } from 'react'
import ProductItem from './ProductItem'

const ProductsList = ({ products, selectedIds, onToggleSelect, onEditProduct, onDuplicate, onToggleActive, onDelete, onInlineUpdate }) => {
  return (
    <div>
      {products.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {products.map((product) => (
            <ProductItem
              key={product.id}
              prod={product}
              isSelected={selectedIds.has(product.id)}
              onToggleSelect={onToggleSelect}
              onEdit={onEditProduct}
              onDuplicate={onDuplicate}
              onToggleActive={onToggleActive}
              onDelete={onDelete}
              onInlineUpdate={onInlineUpdate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default memo(ProductsList)
