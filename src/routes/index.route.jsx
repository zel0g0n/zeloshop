import { Routes } from "react-router-dom";
import { ShopRoutes } from "@/routes/shop.route";
import { SellerRoute } from "@/routes/seller.route";
export const AppRoutes = () => {
  return (
    <Routes>
      {ShopRoutes()}
      {SellerRoute()}
    </Routes>
  )
}