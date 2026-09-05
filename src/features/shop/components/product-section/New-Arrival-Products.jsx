import { memo } from 'react';
import ProductList from '../product/ProductList.jsx'
import ProductSection from '../product/ProductSection.jsx'
import { productHorizontalListStyle } from '@/constants/custom-css.jsx';
import { useLanguage } from '@/context/LanguageContext';

/**
 * "YANGI QO'SHILGAN" bo'limi - `createdAt` bo'yicha eng so'nggi
 * mahsulotlar (`useFilterPriduct.jsx`dagi `newArrivalProducts`).
 */
const NewArrivalProducts = ({ products }) => {
  const { t } = useLanguage();
  if (!products || products.length === 0) return null;

  return (
    <div>
      <ProductSection title={t("home.newArrivals")} />
      <ProductList products={products} filterTypeStyle={productHorizontalListStyle} />
    </div>
  )
}

export default memo(NewArrivalProducts)
