import { memo } from "react"
import ProductList from "./ProductList"
import { useCatalogSearch } from "@/context/CatalogFilterContext"
import { productVerticalListStyle } from "@/constants/custom-css.jsx";
import { SearchX } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const FilteredCatalogProducts = () => {
  const { filteredProducts, loading } = useCatalogSearch();
  const { t } = useLanguage();

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
        <SearchX size={36} className="text-gray-300 dark:text-slate-700 mb-2" />
        <p className="text-sm font-bold text-gray-700 dark:text-slate-200">{t("catalog.notFoundTitle")}</p>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{t("catalog.notFoundSubtitle")}</p>
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
