import { Route } from 'react-router-dom'
import SellerLayout from '@/components/layout/SellerLayout'
import Dashboard from '@/features/seller/components/dashboard/Dashboard'
import Products from '@/features/seller/components/products/Products'
import MorePage from '@/features/seller/components/more/More'
import SellerOrdersPage from '@/features/seller/components/order/OrderSection'
import AddProductPage from '../features/seller/components/add/AddProductPage'
export const SellerRoute = () => {
  return (
    <Route path='/seller' element={<SellerLayout/>} >
      <Route path='' index element={<Dashboard/>} />
      <Route path='products' element={<Products/>} />
      <Route path='add-product' element={<AddProductPage/>} />
      <Route path='orders' element={<SellerOrdersPage/>} />
      <Route path='functions' element={<MorePage/>} />
    </Route>
  )
}
