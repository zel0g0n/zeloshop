import { Route } from 'react-router-dom'
import { lazy } from 'react'
import RootEntry from '@/routes/RootEntry'
import Layout from '@/components/layout/Layout'

// OLDIN: quyidagi barcha sahifalar (Katalog, Savat, Checkout, Profil,
// Buyurtmalar va h.k.) HomePage bilan BIRGA bitta katta boshlang'ich
// JS faylida yuklanardi — foydalanuvchi hali ularning birortasiga ham
// kirmasdan turib. Faqat eng ko'p, birinchi bo'lib kerak bo'ladigan
// sahifalar (bosh sahifa, savat) darhol yuklanadi; qolganlari FAQAT
// o'sha sahifaga o'tilganda alohida yuklanadi.
import CartPage from '@/pages/client/CartPage'

const ProductDetailsPage = lazy(() => import('@/pages/client/ProductDetailPage'))
const CatalogPage = lazy(() => import('@/pages/client/CatalogPage'))
const FavoritesPage = lazy(() => import('@/pages/client/Saved'))
const ProfilePage = lazy(() => import('@/pages/client/Cabinet'))
const CheckoutPage = lazy(() => import('@/pages/client/Checkout'))
const ProfileEditPage = lazy(() => import('@/features/shop/components/cabinet/EditProfile'))
const OrdersPage = lazy(() => import('@/pages/client/OrdersPage'))

export const ShopRoutes = () => {
  return (  
  <>
    <Route path="/" element={<Layout />}>
      <Route index element={<RootEntry />} />
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
