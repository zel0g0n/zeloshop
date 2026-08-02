import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import SellerNavbar from './SellerNavbar'
import PinLockScreen from '@/components/ui/PinLockScreen'
import { useSession } from '@/context/SessionContext'

// OLDIN: PIN kod sozlamasi (Maxfiylik va Xavfsizlik) faqat saqlanardi,
// lekin hech qayerda HAQIQATAN talab qilinmasdi. Endi, agar sotuvchi
// buni yoqqan bo'lsa, butun sotuvchi paneli shu qulf ortida —
// sessiya davomida (sessionStorage) bir marta to'g'ri kod kiritilgach,
// qayta so'ralmaydi.
//
// KEYINGI TUZATISH: OLDIN, bu komponent PIN holatini `sellers/{id}/
// private/security`dan O'ZI, ALOHIDA `getDoc()` so'rovi orqali
// yuklardi — bu, Dashboard render bo'lishidan OLDIN kutilishi kerak
// bo'lgan, diagnostikada aniqlanmagan UCHINCHI Firestore so'rovi edi
// (aynan shu "ikkinchi loader" sifatida ko'rinar edi). Endi bu
// ma'lumot `verifyTelegramAuth` javobining o'zida (server tomonida)
// allaqachon keladi — SessionContext orqali, qo'shimcha so'rovsiz.
const SellerLayout = () => {
  const { security } = useSession();
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem("zeloshop_pin_unlocked") === "true"
  );

  const isLocked = Boolean(security?.pinLockEnabled) && security?.pinCode && !unlocked;

  if (isLocked) {
    return <PinLockScreen correctPin={security.pinCode} onUnlock={() => setUnlocked(true)} />;
  }

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