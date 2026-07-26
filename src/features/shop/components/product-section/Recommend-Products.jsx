import ProductList from '../product/ProductList.jsx'
import ProductSection from '../product/ProductSection.jsx'
import { productHorizontalListStyle } from '@/constants/custom-css.jsx';

const RecommendProducts = ({ products }) => {

  return (
    <div className="mx-auto">
      <ProductSection title="Recommended Products" />
      <ProductList  products={products} filterTypeStyle={productHorizontalListStyle} />
    </div>
  )
}

export default RecommendProducts