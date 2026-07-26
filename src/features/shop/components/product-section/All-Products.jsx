import { useFilterProducts } from '@/hooks/useFilterPriduct';
import ProductList from '../product/ProductList.jsx'
import ProductSection from '../product/ProductSection.jsx'
import { productVerticalListStyle  } from '@/constants/custom-css.jsx';
import Button from '@/components/ui/Button.jsx';
const AllProducts = () => {
  
  const { visibleProducts, loadMoreProducts, hasMore } = useFilterProducts();
  return (
    <div className="mb-[100px]">
      <ProductSection title="All Products" />
      <div>
        <ProductList 
          products={visibleProducts} 
          filterTypeStyle={productVerticalListStyle} 
          isHorizontal={false} 
        />
        {hasMore && (
          <Button buttonContent="Yana ko'rsatish" btnUsageFunc={loadMoreProducts} />
        )}
      </div>
    </div>
  )
}

export default AllProducts