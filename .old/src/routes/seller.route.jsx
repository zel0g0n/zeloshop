import { Route } from 'react-router-dom'
import SellerLayout from '@/components/layout/SellerLayout'
import Dashboard from '@/features/seller/components/dashboard/Dashboard'
// import Products from '@/features/seller/components/products/Products'
// import AddProductPage from '@/features/seller/components/add/Add'
import SellerProductsPage from '@/features/seller/components/products/SellerProductsPage'
import MorePage from '@/features/seller/components/more/More'
import SellerOrdersPage from '@/features/seller/components/order/OrderSection'
import AddProductPage from '../features/seller/components/add/AddProductPage'
export const SellerRoute = () => {
  return (
    <Route path='/seller' element={<SellerLayout/>} >
      <Route path='' index element={<Dashboard/>} />
      <Route path='products' element={<SellerProductsPage sellerID={"yGsq7Cmn2C3IF103gtGm"}/>} />
      <Route path='add-product' element={<AddProductPage/>} />
      <Route path='orders' element={<SellerOrdersPage/>} />
      <Route path='functions' element={<MorePage/>} />
    </Route>
  )
}
