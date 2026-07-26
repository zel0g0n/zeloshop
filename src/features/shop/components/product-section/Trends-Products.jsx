import ProductList from '../product/ProductList.jsx'
import ProductSection from '../product/ProductSection.jsx'
import { productHorizontalListStyle } from '@/constants/custom-css.jsx';

const TrendsProducts = ({ products }) => {

  return (
    <div>
      <ProductSection title="Trends Products" />
      <ProductList products={products} filterTypeStyle={productHorizontalListStyle} />
    </div>
  )
}

export default TrendsProducts