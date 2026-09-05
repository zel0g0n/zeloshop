import { memo } from 'react';
import ProductList from '../product/ProductList.jsx'
import ProductSection from '../product/ProductSection.jsx'
import { productHorizontalListStyle } from '@/constants/custom-css.jsx';
import { useLanguage } from '@/context/LanguageContext';

const RecommendProducts = ({ products }) => {
  const { t } = useLanguage();
  if (!products || products.length === 0) return null;

  return (
    <div className="mx-auto">
      <ProductSection title={t("home.recommended")} />
      <ProductList products={products} filterTypeStyle={productHorizontalListStyle} />
    </div>
  )
}

export default memo(RecommendProducts)
