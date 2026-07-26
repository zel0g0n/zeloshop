import { useRelatedProducts } from "@/hooks/useRelatedProducts";
import { useProductDetail } from "@/hooks/useProductDetails";
import {productHorizontalListStyle} from "@/constants/custom-css";
import { useNavigate } from "react-router";
import ProductList from "../product/ProductList";
export const RelatedProducts = () => {
  const { product } = useProductDetail();
  const relatedProducts = useRelatedProducts(product);
  const navigate = useNavigate();

  return (
    <section className="mt-6 mb-[120px]">
      <div className="flex items-center justify-between">
        
        <h3 className="text-[24px] font-bold text-slate-900">
          Related Products
        </h3>

        <button onClick={() => navigate('/catalog')} className="text-sm font-semibold text-blue-600">
          See All
        </button>
      </div>

      <div className={productHorizontalListStyle}>
        {relatedProducts.map((item) => (
          <ProductList key={item.id} products={[item]} />
        ))}
      </div>
    </section>
  );
};