import { useParams } from "react-router";
import { useEffect } from "react";
import { useProductDetail } from "@/hooks/useProductDetails";
import { ProductDetailSkeleton } from "@/components/ui/Skeleton";
import {
  ProductGallery,
  ProductInfo,
  ProductPrice,
  RelatedProducts,
  BottomBuyBar,
  BundleOffer
} from "@/features/shop/components/productDetail/indexProductDetail";
import ProductReviews from "@/features/shop/components/productDetail/ProductReviews";
import ProductAssistant from "@/features/shop/components/productDetail/ProductAssistant";

const ProductDetailPage = () => {
  const { id } = useParams();
  const { getSingleProduct, handleClearProduct, product, loading } = useProductDetail();

  useEffect(() => {
    handleClearProduct();
    getSingleProduct(id);
    window.scrollTo(0, 0);

    return () => handleClearProduct();
  }, [id, getSingleProduct, handleClearProduct]);

  if (loading || !product) {
    return <ProductDetailSkeleton />;
  }

  return (
    <div className="pb-36 bg-white dark:bg-slate-950 min-h-screen animate-fadeIn">
      <ProductGallery product={product} />

      <div className="max-w-[440px] mx-auto px-4 space-y-6 mt-6">
        <ProductInfo info={product} />
        <ProductPrice priceData={product} />
        <BundleOffer product={product} />
        <BottomBuyBar price={product.price} product={product} />
        <ProductAssistant product={product} />
        <ProductReviews product={product} />
        <RelatedProducts />
      </div>
    </div>
  );
};

export default ProductDetailPage;