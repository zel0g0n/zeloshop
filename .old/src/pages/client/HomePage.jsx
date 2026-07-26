import {Header} from "@/components/layout/Header";
import { HeroSlider } from "@/features/shop/components/hero";
import BestSeller from "@/features/shop/components/product-section/Best-Seller.jsx";
import TrendsProducts from "@/features/shop/components/product-section/Trends-Products.jsx";
import RecommendProducts from "@/features/shop/components/product-section/Recommend-Products.jsx";
import AllProducts from "@/features/shop/components/product-section/All-Products.jsx";
import { useFilterProducts } from "../../hooks/useFilterPriduct";
const HomePage = () => {
  const { recommendedProducts, trendingProducts, bestSellerProducts } = useFilterProducts();
  return (
    <>
      <Header />
      <HeroSlider />
      <div className="max-w-[440px] mx-auto px-4">
        <BestSeller products={bestSellerProducts} />
        <TrendsProducts products={trendingProducts} />
        <RecommendProducts products={recommendedProducts} /> 
        <AllProducts />
      </div>
    </>
  )
}

export default  HomePage