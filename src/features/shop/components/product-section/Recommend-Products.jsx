import { memo } from 'react';
import ProductList from '../product/ProductList.jsx'
import ProductSection from '../product/ProductSection.jsx'
import { productHorizontalListStyle } from '@/constants/custom-css.jsx';

const RecommendProducts = ({ products }) => {
  if (!products || products.length === 0) return null;

  return (
    <div className="mx-auto">
      <ProductSection title="Recommended Products" />
      <ProductList products={products} filterTypeStyle={productHorizontalListStyle} />
    </div>
  )
}

export default memo(RecommendProducts)
