import { memo } from 'react';
import ProductCard from './ProductCard';

const ProductList = memo(({ products, filterTypeStyle, isHorizontal = true }) => {
  return (
    <div className="w-full mb-8">
      <div className={filterTypeStyle}>
        {products.map((product) => (
          <div 
            key={product.id} 
            className={`
              content-visibility-auto 
              contain-intrinsic-size-[280px_420px] 
              ${isHorizontal 
                ? "min-w-[240px] xs:min-w-[280px] snap-start snap-always" 
                : "w-full"
              }
            `}
          >
            <ProductCard product={product} />
          </div>
        ))}
        {isHorizontal && <div className="min-w-[20px] h-full flex-shrink-0" />}
      </div>
    </div>
  );
});

ProductList.displayName = "ProductList";
export default ProductList;