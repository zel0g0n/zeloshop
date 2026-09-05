import { memo } from 'react';
import ProductList from '../product/ProductList.jsx'
import ProductSection from '../product/ProductSection.jsx'
import { productHorizontalListStyle } from '@/constants/custom-css.jsx';
import { useLanguage } from '@/context/LanguageContext';

/**
 * "AKSIYADAGI" bo'limi - faqat HAQIQIY chegirma bor mahsulotlar
 * (`useFilterPriduct.jsx`dagi `onSaleProducts`). Bo'sh bo'lsa
 * (hech qanday mahsulotda chegirma yo'q bo'lsa), bu bo'lim
 * BUTUNLAY ko'rsatilmaydi - "bo'sh aksiya bo'limi" ko'rsatishning
 * ma'nosi yo'q.
 */
const OnSaleProducts = ({ products }) => {
  const { t } = useLanguage();
  if (!products || products.length === 0) return null;

  return (
    <div>
      <ProductSection title={t("home.onSale")} />
      <ProductList products={products} filterTypeStyle={productHorizontalListStyle} />
    </div>
  )
}

export default memo(OnSaleProducts)
