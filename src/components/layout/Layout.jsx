import Navbar from '@/components/layout/Navbar'
import {Outlet} from 'react-router-dom'
import { useHydrateClientStorage } from '@/hooks/useHydrateClientStorage'
import { useCartSync } from '@/hooks/useCartSync'
import { useFavoritesSync } from '@/hooks/useFavoritesSync'

const Layout = () => {
  // MUHIM: savat/sevimlilarni JORIY sotuvchiga tegishli
  // localStorage'dan yuklaydi — bu, boshqa sotuvchining eski
  // ma'lumotlari aralashib qolishining oldini oladi.
  useHydrateClientStorage();
  // "Tashlab ketilgan savat" eslatmasi uchun - savatni fonda,
  // debounce qilingan holda Firestore'ga sinxronlaydi.
  useCartSync();
  // "Like bosilgan mahsulotga eslatma" uchun - xuddi shu naqshda.
  useFavoritesSync();

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