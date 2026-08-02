import { memo } from "react";
import { useRelatedProducts } from "@/hooks/useRelatedProducts";
import { useProductDetail } from "@/hooks/useProductDetails";
import {productHorizontalListStyle} from "@/constants/custom-css";
import { useNavigate } from "react-router";
import ProductList from "../product/ProductList";

export const RelatedProducts = memo(() => {
  const { product } = useProductDetail();
  const relatedProducts = useRelatedProducts(product);
  const navigate = useNavigate();

  // Bo'sh bo'lsa, sarlavhasi bilan bo'sh joy qoldirish o'rniga butunlay yashiramiz
  if (relatedProducts.length === 0) return null;

  return (
    <section className="mt-6 mb-[120px]">
      <div className="flex items-center justify-between">
        
        <h3 className="text-[24px] font-bold text-slate-900 dark:text-white">
          O'xshash mahsulotlar
        </h3>

        <button onClick={() => navigate('/catalog')} className="text-sm font-semibold text-blue-600 dark:text-blue-400">
          Barchasi
        </button>
      </div>

      <div className={productHorizontalListStyle}>
        {relatedProducts.map((item) => (
          <ProductList key={item.id} products={[item]} />
        ))}
      </div>
    </section>
  );
});
