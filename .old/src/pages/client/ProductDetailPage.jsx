import { useParams } from "react-router";
import { useEffect } from "react";
import { useProductDetail } from "@/hooks/useProductDetails";
import { useAddFavorite } from "@/hooks/useAddFavourite";
import {
  ProductGallery,
  ProductInfo,
  ProductPrice,
  RelatedProducts,
  BottomBuyBar
} from "@/features/shop/components/productDetail/indexProductDetail";

const ProductDetailPage = () => {
  const { id } = useParams();
  const { getSingleProduct, handleClearProduct, product, loading } = useProductDetail();

  console.log(product)
  useEffect(() => {
    handleClearProduct();
    getSingleProduct(id);
    window.scrollTo(0, 0);

    return () => handleClearProduct();
  }, [id]);

  if (loading || !product) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="pb-[140px] bg-white min-h-screen animate-fadeIn">
      <ProductGallery product={product} image={product?.image} />

      <div className="max-w-[440px] mx-auto px-4 space-y-6 mt-6">
        <ProductInfo info={product} />
        <ProductPrice priceData={product} />
        <RelatedProducts />
      </div>

      <BottomBuyBar price={product.price} product={product} />
    </div>
  );
};

export default ProductDetailPage;