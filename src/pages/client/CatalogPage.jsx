import SearchCatalog from "@/features/shop/components/hero/search/SearchCatalog";
import FilterBadges from "@/features/shop/components/hero/filter/FilterBadges";
import FilterType from "@/features/shop/components/hero/filter/FilterType";
import FilteredCatalogProducts from "@/features/shop/components/product/FilteredCatalogProducts";
import { CatalogFilterProvider } from "@/context/CatalogFilterContext";

// Qidiruv/filtr holati endi `CatalogFilterProvider` ichida yashaydi —
// bu Provider faqat shu daraxt uchun, va Katalogdan chiqilganda
// (marshrut o'zgarganda) o'zi bilan birga tabiiy ravishda demontaj
// qilinadi. Bosh sahifa bu holatdan mustaqil.
const CatalogPage = () => {
  return (
    <CatalogFilterProvider>
      <div className="bg-gray-50/50 dark:bg-slate-950 min-h-screen pb-24 transition-colors duration-300">
        <SearchCatalog />
        <FilterType />
        <FilterBadges />
        <FilteredCatalogProducts />
      </div>
    </CatalogFilterProvider>
  );
};

export default CatalogPage;
