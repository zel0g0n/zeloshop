import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFilterProducts } from '@/hooks/useFilterPriduct';
import ProductList from '../product/ProductList.jsx'
import ProductSection from '../product/ProductSection.jsx'
import { productVerticalListStyle } from '@/constants/custom-css.jsx';
import Button from '@/components/ui/Button.jsx';
import { GridSkeleton } from '@/components/ui/Skeleton';
import { PackageSearch } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

// OLDIN: bu bo'lim BARCHA mahsulotni, ichki "ko'proq yuklash"
// (load more) tugmasi bilan ko'rsatardi - Bosh sahifa cheksiz
// uzayib ketishi mumkin edi. Foydalanuvchi bilan muhokamadan keyin:
// Bosh sahifada FAQAT dastlabki 8 tasi ko'rsatiladi, "Ko'proq
// ko'rish" tugmasi esa TO'LIQ Katalog sahifasiga (`/catalog`) olib
// boradi - u yerda qidiruv/filtr/kategoriya bo'yicha to'liq
// ko'rib chiqish imkoniyati bor.
const AllProducts = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { homePreviewProducts, hasMoreThanPreview, loading } = useFilterProducts();

  return (
    <div className="pb-10">
      <ProductSection title={t("home.allProducts")} />
      <div>
        {loading && homePreviewProducts.length === 0 && <GridSkeleton count={4} />}

        {!loading && homePreviewProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <PackageSearch size={36} className="text-gray-300 dark:text-slate-700 mb-2" />
            <p className="text-sm font-bold text-gray-700 dark:text-slate-200">{t("home.emptyTitle")}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{t("home.emptySubtitle")}</p>
          </div>
        )}

        {homePreviewProducts.length > 0 && (
          <>
            <ProductList
              products={homePreviewProducts}
              filterTypeStyle={productVerticalListStyle}
              isHorizontal={false}
            />
            {hasMoreThanPreview && (
              <Button buttonContent={t("home.showMore")} btnUsageFunc={() => navigate("/catalog")} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default memo(AllProducts)
