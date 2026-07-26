import ProductList from "./ProductList"
import { useFilterProducts } from "@/hooks/useFilterPriduct"
import { productVerticalListStyle } from "@/constants/custom-css.jsx";
const FilteredCatalogProducts = () => {
  const {filteredProducts } = useFilterProducts();

  
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

export default FilteredCatalogProducts