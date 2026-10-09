import { useState } from 'react'
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom'
import { ShieldAlert, CreditCard } from 'lucide-react'
import SellerNavbar from './SellerNavbar'
import SellerSidebar from './SellerSidebar'
import SellerTopbar from './SellerTopbar'
import PinLockScreen from '@/components/ui/PinLockScreen'
import { useSession } from '@/context/SessionContext'
import { isTariffPastDue } from '@/utils/tariffLimits'

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
//
// MUHIM TUZATISH (rol himoyasi): oldin bu yerda faqat PIN
// tekshirilardi — hatto ODDIY MIJOZ (masalan sotuvchining referal
// havolasi orqali kirgan xaridor) ham qo'lda `/seller/...` manziliga
// o'tsa, sotuvchi panelining UI QOBIG'INI ko'ra olardi (Firestore
// qoidalari haqiqiy ma'lumotni bloklaydi, lekin natija — chalkash,
// "bo'sh"/xato ko'rinishdagi sahifa bo'lardi, toza yo'naltirish
// o'rniga). Endi `isSeller`/`isAdmin` BO'LMAGAN har qanday
// foydalanuvchi butun sotuvchi bo'limidan bosh sahifaga qaytariladi.
// Kompyuter uchun ALOHIDA loyihalangan sahifalar — to'liq kenglikdagi
// ish maydoni oladi; qolganlari markazlashtirilgan ustunda qoladi.
const DESKTOP_DESIGNED_PATHS = new Set([
  '/seller', '/seller/orders', '/seller/products', '/seller/functions',
  '/seller/pnl', '/seller/crm', '/seller/marketing', '/seller/store-settings',
])

// Keng grafik/jadval sahifalari (analitika) — to'liq kenglikdagi ish
// maydoni emas, lekin 3xl ustun ham torlik qiladi: o'rtacha (6xl) kenglik.
const WIDE_PATHS = new Set([
  '/seller/analytics/profit-deep-dive', '/seller/orders/analytics', '/seller/products/analytics',
  '/seller/marketing/settings',
])

const SellerLayout = () => {
  const { pathname } = useLocation();
  const cleanPath = pathname.replace(/\/+$/, '') || '/seller';
  const isDesktopPage = DESKTOP_DESIGNED_PATHS.has(cleanPath);
  const isWidePage = WIDE_PATHS.has(cleanPath);
  // `page-tier-*` — `styles/index.css`dagi kompyuter qoidalari uchun belgi:
  // "designed" sahifalar o'zining lg: sinflari bilan boshqariladi, qolganlari
  // (default/wide) uchun yagona sarlavha/skroll qoidalari qo'llanadi.
  const tier = isDesktopPage ? 'designed' : isWidePage ? 'wide' : 'default';
  const { security, isSeller, isAdmin, store } = useSession();
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem("zeloshop_pin_unlocked") === "true"
  );

  if (!isSeller && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  // MUHIM TUZATISH: super-admin panelidagi "To'xtatish" (faolsizlantirish)
  // tugmasi OLDIN faqat `sellers/{id}.status`ni "suspended"ga
  // o'zgartirardi, lekin HECH QAYERDA (na backend, na frontend) haqiqatan
  // tekshirilmasdi - do'kon sotuvchi panelida ISHLASHDA DAVOM ETARDI.
  // Endi: agar do'kon to'xtatilgan bo'lsa (va bu ADMIN emas, aynan
  // to'xtatilgan do'konning O'ZI bo'lsa), butun sotuvchi panelidan
  // oldin, aniq tushunarli xabar bilan to'xtatiladi.
  if (isSeller && !isAdmin && store?.status === "suspended") {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center gap-3 px-6 text-center bg-white dark:bg-slate-950">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center">
          <ShieldAlert size={26} />
        </div>
        <h1 className="text-base font-black text-slate-800 dark:text-white">Do'koningiz vaqtincha to'xtatilgan</h1>
        <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">
          Sizning do'koningiz administrator tomonidan vaqtincha faolsizlantirilgan. Sabab va qayta faollashtirish
          bo'yicha ZeloShop administratoriga murojaat qiling.
        </p>
      </div>
    );
  }

  // YANGI (2026-09): to'lanadigan tariflar tizimi (to'lov hozircha
  // qo'lda, chek orqali tasdiqlanadi). `isTariffPastDue` — sotuvchi 2026-09-11dan KEYIN
  // ro'yxatdan o'tgan (eski sotuvchilar butunlay "grandfathered" —
  // bepul Z-Start abadiy) VA 7 kunlik sinov/oxirgi to'lov muddati
  // tugagan bo'lsa TRUE qaytaradi. Bu yerda ATAYLAB faqat SOTUVCHI
  // PANELI (buyurtmalar, mahsulotlar, sozlamalar) bloklanadi — do'kon
  // vitrinasi, xaridorlar va ularning buyurtmalari BUTUNLAY teginilmay
  // qoladi, va to'lov qilingan zahoti (keyingi `store` yangilanishida)
  // avtomatik ochiladi. `status:"suspended"` maydonidan ATAYLAB
  // foydalanilmadi — bu ADMIN tomonidan qo'lda to'xtatish uchun,
  // to'lov holatidan mustaqil bo'lishi kerak.
  if (isSeller && !isAdmin && isTariffPastDue(store)) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center gap-3 px-6 text-center bg-white dark:bg-slate-950">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center">
          <CreditCard size={26} />
        </div>
        <h1 className="text-base font-black text-slate-800 dark:text-white">To'lov muddati tugagan</h1>
        <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">
          Tarif uchun to'lov muddati o'tib ketgan. Sotuvchi panelidan foydalanishni davom ettirish uchun
          to'lovni amalga oshiring — do'koningiz va buyurtmalaringiz xaridorlar uchun ochiq qoladi.
        </p>
        <Link
          to="/seller/tariffs"
          className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-colors"
        >
          <CreditCard size={14} />
          To'lovni amalga oshirish
        </Link>
      </div>
    );
  }

  const isLocked = Boolean(security?.pinLockEnabled) && security?.pinCode && !unlocked;

  if (isLocked) {
    return <PinLockScreen correctPin={security.pinCode} onUnlock={() => setUnlocked(true)} />;
  }

  return (
    // RESPONSIVE (2026-10, veb-kirish): telefonda — pastki suzuvchi navbar
    // (avvalgidek); lg+ (kompyuter) — chap yon panel (`SellerSidebar`) va
    // markazlashtirilgan, cheklangan kenglikdagi kontent. Sahifalarning
    // o'zi o'zgarmagan — ular shu ustun ichida to'liq kenglikda ishlaydi.
    // Fon rangi shu yerda ham beriladi, shunda sahifa ustunidan tashqaridagi
    // maydon (keng ekranda) sahifa fonidan farq qilmaydi.
    <div className='w-full h-full seller-layout bg-[#F4F5F9] dark:bg-slate-950'>
      <SellerSidebar/>
      <main className='seller-main lg:pl-64 min-h-screen'>
        <SellerTopbar/>
        <div className={`page-tier-${tier} ` + (isDesktopPage
          ? 'lg:px-8 lg:py-6 lg:max-w-[1600px] lg:mx-auto'
          : isWidePage
            ? 'md:max-w-2xl md:mx-auto lg:max-w-6xl lg:px-8 lg:py-6'
            : 'md:max-w-2xl lg:max-w-3xl md:mx-auto lg:py-6')}>
          <Outlet/>
        </div>
      </main>
      <SellerNavbar/>
    </div>
  )
}

export default SellerLayout