import { memo } from 'react';
import ProductList from '../product/ProductList.jsx'
import ProductSection from '../product/ProductSection.jsx'
import { productHorizontalListStyle } from '@/constants/custom-css.jsx';

const BestSeller = ({ products }) => {
  // Bo'sh bo'lsa, sarlavhasi bilan bo'sh joy qoldirish o'rniga
  // butunlay ko'rsatmaymiz (bo'sh dekorativ bo'lim — yomon UX).
  if (!products || products.length === 0) return null;

  return (
    <div>
      <ProductSection title="Best Seller Products" />
      <ProductList products={products} filterTypeStyle={productHorizontalListStyle} />
    </div>
  )
}

export default memo(BestSeller)
