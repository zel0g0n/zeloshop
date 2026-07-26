import SearchCatalog from "@/features/shop/components/hero/search/SearchCatalog";
import FilterBadges from "@/features/shop/components/hero/filter/FilterBadges";
import FilterType from "@/features/shop/components/hero/filter/FilterType";
import FilteredCatalogProducts from "@/features/shop/components/product/FilteredCatalogProducts";
const CatalogPage = () => {
  return (
    <div className="bg-gray-50/50 min-h-screen pb-24">
      <SearchCatalog />
      <FilterBadges />
      {/* <FilterType /> */}
      <FilteredCatalogProducts />
    </div>
  );
};

export default CatalogPage;