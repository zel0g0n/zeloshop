import { memo } from 'react';
import ProductItem from './ProductItem'

// OLDIN: mahsulotlar 2 ustunli katakda (`sm:grid-cols-2`) ko'rsatilardi.
// Endi — spetsifikatsiyaga mos, YAGONA ustunli, ixcham ro'yxat (har
// bir mahsulot — o'zining, to'liq kenglikdagi qatorida).
// `staffId`/`staffName` - FAQAT xodim Mini App'idan (`StaffProductsSection.jsx`)
// beriladi, "ombor nazorati" (zaxira harakati audit jurnali) uchun
// (batafsil izoh: `ProductItem.jsx`).
const ProductsList = ({ products, selectedIds, onToggleSelect, onEditProduct, onDuplicate, onToggleActive, onDelete, onInlineUpdate, staffId, staffName }) => {
  return (
    <div>
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
          staffId={staffId}
          staffName={staffName}
        />
      ))}
    </div>
  )
}

export default memo(ProductsList)
