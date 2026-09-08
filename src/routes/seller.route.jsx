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
const ProductAnalytics = lazy(() => import('@/features/seller/components/products/ProductAnalytics'))
const ProductDraftReview = lazy(() => import('@/features/seller/components/products/ProductDraftReview'))
const MorePage = lazy(() => import('@/features/seller/components/more/More'))
const SellerOrdersPage = lazy(() => import('@/features/seller/components/order/OrderSection'))
const YandexDeliveryPage = lazy(() => import('@/features/seller/components/order/YandexDeliveryPage'))
const OrderAnalytics = lazy(() => import('@/features/seller/components/order/OrderAnalytics'))
const AddProductPage = lazy(() => import('../features/seller/components/add/AddProductPage'))
const EditProductPage = lazy(() => import('../features/seller/components/add/EditProductPage'))
// 2026-09 foydalanuvchi so'roviga ko'ra: "To'lov tizimlari" va "Tariflar"
// BITTA sahifaga (tab-filtr bilan) birlashtirildi — batafsil izoh:
// `PaymentAndTariffsPage.jsx`. Ikkala ESKI route ham ('payment-settings'
// va 'tariffs') pastda saqlangan (boshqa ko'p joydan '/seller/tariffs'ga
// havola beriladi), lekin ikkalasi ham AYNAN shu bitta komponentga
// ishora qiladi.
const PaymentAndTariffsPage = lazy(() => import('../features/seller/components/payment/PaymentAndTariffsPage'))
const ConnectionsPage = lazy(() => import('../features/seller/components/bot/ConnectionsPage'))
const SupportPage = lazy(() => import('../features/seller/components/support/SupportPage'))
const PnLDashboard = lazy(() => import('../features/seller/components/finance/PnLDashboard'))
const ProfitDeepDive = lazy(() => import('../features/seller/components/finance/ProfitDeepDive'))
const CrmHub = lazy(() => import('../features/seller/components/crm/CrmHub'))
const DeliverySettingsPage = lazy(() => import('../features/seller/components/logistics/DeliverySettingsPage'))
const CourierManagementPage = lazy(() => import('../features/seller/components/logistics/CourierManagementPage'))
const StaffManagementPage = lazy(() => import('../features/seller/components/staff/StaffManagementPage'))
const StoreSettingsPage = lazy(() => import('../features/seller/components/settings/StoreSettingsPage'))
const CategoryManagementPage = lazy(() => import('../features/seller/components/settings/CategoryManagementPage'))
const BannerSettingsPage = lazy(() => import('../features/seller/components/settings/BannerSettingsPage'))
const AiCeoInfoPage = lazy(() => import('../features/seller/components/dashboard/AiCeoInfoPage'))
const AiCeoSettingsPage = lazy(() => import('../features/seller/components/dashboard/AiCeoSettingsPage'))
// 2026-09 foydalanuvchi so'roviga ko'ra (8-band): "Marketing va
// Kuponlar", "Mahsulot bandllari" va "Aksiya yaratish" UCHTASI ham
// BITTA sahifaga (tab-filtr bilan) birlashtirildi — batafsil izoh:
// `MarketingHub.jsx`. UCHALA ESKI route ham ('marketing', 'bundles' va
// 'create-promotion') pastda saqlangan (navbar'ning markaziy "+"
// tugmasi va boshqa ko'p joy shu yo'llarga to'g'ridan-to'g'ri havola
// beradi), lekin barchasi AYNAN shu bitta komponentga ishora qiladi.
const MarketingHub = lazy(() => import('../features/seller/components/marketing/MarketingHub'))
const MarketingSettingsPage = lazy(() => import('../features/seller/components/marketing/MarketingSettingsPage'))
const PrivacySecurityPage = lazy(() => import('../features/seller/components/security/PrivacySecurityPage'))
const SellerReferralPage = lazy(() => import('../features/seller/components/marketing/SellerReferralPage'))
const AutomationRulesPage = lazy(() => import('../features/seller/components/marketing/AutomationRulesPage'))
const PricingSuggestionsPage = lazy(() => import('../features/seller/components/marketing/PricingSuggestionsPage'))
const BusinessCommandCenterPage = lazy(() => import('../features/seller/components/dashboard/BusinessCommandCenterPage'))
const InboxPage = lazy(() => import('../features/seller/components/inbox/InboxPage'))

export const SellerRoute = () => {
  return (
    <Route path='/seller' element={<SellerLayout/>} >
      <Route path='' index element={<Dashboard/>} />
      <Route path='products' element={<Products/>} />
      <Route path='products/analytics' element={<ProductAnalytics/>} />
      <Route path='products/drafts' element={<ProductDraftReview/>} />
      <Route path='products/:id/edit' element={<EditProductPage/>} />
      <Route path='add-product' element={<AddProductPage/>} />
      <Route path='orders' element={<SellerOrdersPage/>} />
      <Route path='orders/:orderId/yandex-delivery' element={<YandexDeliveryPage/>} />
      <Route path='orders/analytics' element={<OrderAnalytics/>} />
      <Route path='functions' element={<MorePage/>} />
      <Route path='payment-settings' element={<PaymentAndTariffsPage/>} />
      <Route path='tariffs' element={<PaymentAndTariffsPage/>} />
      <Route path='connections' element={<ConnectionsPage/>} />
      <Route path='support' element={<SupportPage/>} />
      <Route path='pnl' element={<PnLDashboard/>} />
      <Route path='analytics/profit-deep-dive' element={<ProfitDeepDive/>} />
      <Route path='crm' element={<CrmHub/>} />
      <Route path='delivery-settings' element={<DeliverySettingsPage/>} />
      <Route path='couriers' element={<CourierManagementPage/>} />
      <Route path='staff' element={<StaffManagementPage/>} />
      <Route path='store-settings' element={<StoreSettingsPage/>} />
      <Route path='category-settings' element={<CategoryManagementPage/>} />
      <Route path='banners' element={<BannerSettingsPage/>} />
      <Route path='ai-ceo' element={<AiCeoInfoPage/>} />
      <Route path='ai-ceo/settings' element={<AiCeoSettingsPage/>} />
      <Route path='marketing' element={<MarketingHub/>} />
      <Route path='marketing/settings' element={<MarketingSettingsPage/>} />
      <Route path='create-promotion' element={<MarketingHub/>} />
      <Route path='security' element={<PrivacySecurityPage/>} />
      <Route path='invite-sellers' element={<SellerReferralPage/>} />
      <Route path='bundles' element={<MarketingHub/>} />
      <Route path='automation-rules' element={<AutomationRulesPage/>} />
      <Route path='pricing-suggestions' element={<PricingSuggestionsPage/>} />
      <Route path='command-center' element={<BusinessCommandCenterPage/>} />
      <Route path='inbox' element={<InboxPage/>} />
    </Route>
  )
}
