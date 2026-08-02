import { memo } from 'react';
import { useFilterProducts } from '@/hooks/useFilterPriduct';
import ProductList from '../product/ProductList.jsx'
import ProductSection from '../product/ProductSection.jsx'
import { productVerticalListStyle } from '@/constants/custom-css.jsx';
import Button from '@/components/ui/Button.jsx';
import { GridSkeleton } from '@/components/ui/Skeleton';

// OLDIN: yuklanayotganda yoki mahsulot umuman bo'lmaganda (masalan
// yangi ro'yxatdan o'tgan sotuvchi hali mahsulot qo'shmagan bo'lsa),
// bu bo'lim faqat "All Products" sarlavhasi bilan bo'sh joy qoldirib,
// hech qanday tushuntirishsiz ko'rinardi.
const AllProducts = () => {
  const { visibleProducts, loadMoreProducts, hasMore, loading } = useFilterProducts();

  return (
    <div className="mb-[100px]">
      <ProductSection title="All Products" />
      <div>
        {loading && visibleProducts.length === 0 && <GridSkeleton count={4} />}

        {!loading && visibleProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-4xl mb-2">🛍️</span>
            <p className="text-sm font-bold text-gray-700 dark:text-slate-200">Hozircha mahsulot yo'q</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Tez orada yangi mahsulotlar qo'shiladi</p>
          </div>
        )}

        {visibleProducts.length > 0 && (
          <>
            <ProductList
              products={visibleProducts}
              filterTypeStyle={productVerticalListStyle}
              isHorizontal={false}
            />
            {hasMore && (
              <Button buttonContent="Yana ko'rsatish" btnUsageFunc={loadMoreProducts} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default memo(AllProducts)
