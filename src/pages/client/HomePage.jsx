import {Header} from "@/components/layout/Header";
import { HeroSlider } from "@/features/shop/components/hero";
import BestSeller from "@/features/shop/components/product-section/Best-Seller.jsx";
import OnSaleProducts from "@/features/shop/components/product-section/On-Sale-Products.jsx";
import NewArrivalProducts from "@/features/shop/components/product-section/New-Arrival-Products.jsx";
import AllProducts from "@/features/shop/components/product-section/All-Products.jsx";
import { useFilterProducts } from "../../hooks/useFilterPriduct";
import { useSession } from "@/context/SessionContext";

const HomePage = () => {
  const { store } = useSession();
  const { bestSellerProducts, onSaleProducts, newArrivalProducts } = useFilterProducts();
  return (
    <>
      <Header />
      <HeroSlider banners={store?.heroBanners} />
      <div className="max-w-[440px] mx-auto px-4 space-y-8 pb-36">
        <AllProducts />
        <BestSeller products={bestSellerProducts} />
        <OnSaleProducts products={onSaleProducts} />
        <NewArrivalProducts products={newArrivalProducts} />
      </div>
    </>
  )
}

export default  HomePage
