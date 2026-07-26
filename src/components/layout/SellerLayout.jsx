import {Outlet} from 'react-router-dom'
import SellerNavbar from './SellerNavbar'
const SellerLayout = () => {
  return (
    <div className='w-full h-full seller-layout'>
      <main>
        <Outlet/>
      </main>
      <SellerNavbar/>
    </div>
  )
}

export default SellerLayout