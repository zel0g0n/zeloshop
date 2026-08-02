import { Route } from 'react-router-dom'
import { lazy } from 'react'
import SellerLayout from '@/components/layout/SellerLayout'
import Dashboard from '@/features/seller/components/dashboard/Dashboard'

// OLDIN: sotuvchi panelining barcha sahifalari (Dashboard, Products,
// AddProductPage, Orders, More) mijoz uchun mo'ljallangan sahifalar
// bilan BIRGA, bitta katta JS faylga (~957 KB) yig'ilardi — hatto oddiy
// mijoz do'konni ko'rish uchun ilovani ochganda ham, u hech qachon
// ko'rmaydigan sotuvchi kodini yuklab olishga majbur bo'lardi. Bu
// birinchi ochilish tezligini sekinlashtiruvchi sabablardan biri edi.
// Endi bu sahifalar faqat KERAK bo'lganda (haqiqatan /seller/* ga
// o'tilganda) alohida yuklanadi.
//
// KEYINGI TUZATISH: Dashboard'ning O'ZI (yuqorida, oddiy import
// sifatida) endi LAZY EMAS. Aniq o'lchov shuni ko'rsatdiki, Dashboard
// — sotuvchi HAR DOIM birinchi ko'radigan sahifa (kirishdan keyin
// darhol) — lazy-loading tufayli, u sessiya tugagandan KEYIN, alohida,
// "sovuq" tarmoq so'rovi orqali yuklanishini kutishga majbur qilardi.
// Bu — LCP'dagi ~5 soniyalik tushuntirilmagan bo'shliqning aynan
// o'zi edi. Boshqa, kamroq tashrif buyuriladigan sahifalar (Products,
// Orders, PnL va h.k.) hali ham lazy holda qoladi — ular UCHUN
// code-splitting hali ham foydali.
const Products = lazy(() => import('@/features/seller/components/products/Products'))
const MorePage = lazy(() => import('@/features/seller/components/more/More'))
const SellerOrdersPage = lazy(() => import('@/features/seller/components/order/OrderSection'))
const AddProductPage = lazy(() => import('../features/seller/components/add/AddProductPage'))
const EditProductPage = lazy(() => import('../features/seller/components/add/EditProductPage'))
const PaymentSettingsPage = lazy(() => import('../features/seller/components/payment/PaymentSettingsPage'))
const PnLDashboard = lazy(() => import('../features/seller/components/finance/PnLDashboard'))
const CrmHub = lazy(() => import('../features/seller/components/crm/CrmHub'))
const LogisticsSettings = lazy(() => import('../features/seller/components/logistics/LogisticsSettings'))
const StoreSettingsPage = lazy(() => import('../features/seller/components/settings/StoreSettingsPage'))
const MarketingCoupons = lazy(() => import('../features/seller/components/marketing/MarketingCoupons'))
const PrivacySecurityPage = lazy(() => import('../features/seller/components/security/PrivacySecurityPage'))

export const SellerRoute = () => {
  return (
    <Route path='/seller' element={<SellerLayout/>} >
      <Route path='' index element={<Dashboard/>} />
      <Route path='products' element={<Products/>} />
      <Route path='products/:id/edit' element={<EditProductPage/>} />
      <Route path='add-product' element={<AddProductPage/>} />
      <Route path='orders' element={<SellerOrdersPage/>} />
      <Route path='functions' element={<MorePage/>} />
      <Route path='payment-settings' element={<PaymentSettingsPage/>} />
      <Route path='pnl' element={<PnLDashboard/>} />
      <Route path='crm' element={<CrmHub/>} />
      <Route path='logistics' element={<LogisticsSettings/>} />
      <Route path='store-settings' element={<StoreSettingsPage/>} />
      <Route path='marketing' element={<MarketingCoupons/>} />
      <Route path='security' element={<PrivacySecurityPage/>} />
    </Route>
  )
}
