import { memo } from 'react';
import ProductList from '../product/ProductList.jsx'
import ProductSection from '../product/ProductSection.jsx'
import { productHorizontalListStyle } from '@/constants/custom-css.jsx';
import { useLanguage } from '@/context/LanguageContext';

const TrendsProducts = ({ products }) => {
  const { t } = useLanguage();
  if (!products || products.length === 0) return null;

  return (
    <div>
      <ProductSection title={t("home.trending")} />
      <ProductList products={products} filterTypeStyle={productHorizontalListStyle} />
    </div>
  )
}

export default memo(TrendsProducts)
