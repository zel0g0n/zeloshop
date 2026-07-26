import { Route} from 'react-router-dom'
import HomePage from '@/pages/client/HomePage'
import Layout from '@/components/layout/Layout'
import ProductDetailsPage from '@/pages/client/ProductDetailPage';
import CatalogPage from '@/pages/client/CatalogPage';
import CartPage from '@/pages/client/CartPage';
import FavoritesPage from '@/pages/client/Saved';
import ProfilePage from '@/pages/client/Cabinet';
import CheckoutPage from '@/pages/client/Checkout';
import ProfileEditPage from '@/features/shop/components/cabinet/EditProfile';
import OrdersPage from '@/pages/client/OrdersPage';
export const ShopRoutes = () => {
  return (  
  <>
    <Route path="/" element={<Layout />}>
      <Route index element={<HomePage />} />
      <Route path="/catalog" element={<CatalogPage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/saved" element={<FavoritesPage />} />
      <Route path="/cabinet" element={<ProfilePage />}/>
      <Route path="/cabinet/edit" element={<ProfileEditPage />} />
      <Route path="/product/:id" element={<ProductDetailsPage />} />
      <Route path="/orders" element={<OrdersPage />} />

    </Route>
  </>)
}
