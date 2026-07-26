import Navbar from '@/components/layout/Navbar'
import {Outlet} from 'react-router-dom'



const Layout = () => {
  return (
    <div className='w-full h-full layout'>
      <main className="w-full h-full">
        <Outlet/>
      </main>
      <Navbar/>
    </div>
  )
}

export default Layout