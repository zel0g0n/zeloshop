import { memo } from "react"
import ProductList from "./ProductList"
import { useCatalogFilter } from "@/context/CatalogFilterContext"
import { productVerticalListStyle } from "@/constants/custom-css.jsx";

const FilteredCatalogProducts = () => {
  const { filteredProducts, loading } = useCatalogFilter();

  if (loading && filteredProducts.length === 0) {
    return (
      <div className="p-4 grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-full aspect-[3/4] rounded-2xl bg-gray-100 dark:bg-slate-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (filteredProducts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <span className="text-4xl mb-2">🔍</span>
        <p className="text-sm font-bold text-gray-700 dark:text-slate-200">Hech qanday mahsulot topilmadi</p>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Boshqa kalit so'z bilan qidirib ko'ring</p>
      </div>
    );
  }

  return (
      <div className="p-4">
        <ProductList
          products={filteredProducts} 
          filterTypeStyle={productVerticalListStyle} 
          isHorizontal={false}
        />
      </div>
  )
}

export default memo(FilteredCatalogProducts)
