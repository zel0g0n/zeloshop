import {AppRoutes} from "@/routes/index.route";
import { store } from "@/store/store";
import { Provider } from "react-redux";
import { SessionProvider } from "@/context/SessionContext";
import SessionGate from "@/context/SessionGate";
import { ThemeProvider } from "@/context/ThemeContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { Suspense, lazy } from "react";
import FullScreenSpinner from "@/components/ui/FullScreenSpinner";

// Kuryer Mini App'i alohida Telegram botidan (`zeloshop_kuryer_bot`) ochiladi
// va sotuvchi/mijoz/admin'dan mustaqil autentifikatsiya yo'liga ega (qarang:
// `CourierSessionContext.jsx`). Shu sababli bu yerda, eng yuqori darajada,
// URL yo'liga qarab ikki alohida daraxtdan biri tanlanadi: `/courier`
// bo'lganda asosiy `SessionProvider` umuman mount qilinmaydi, shunda u xato
// bot tokeni bilan ishga tushib kuryer sessiyasiga xalaqit bermaydi. Redux
// `store` ham kuryer ilovasiga kerak emas, chunki u yerda savat/sevimlilar
// mantig'i yo'q.
//
// Kuryer daraxti (`CourierApp.jsx`) lazy import qilinadi, aks holda uning
// kodi bosh sahifa bilan birga barcha foydalanuvchilar uchun ham yuklanib,
// sahifa yuklanish tezligiga (LCP) salbiy ta'sir qilardi.
const CourierApp = lazy(() => import("./CourierApp"));

// Xodim Mini App'i ham (kuryer kabi) alohida Telegram botidan (sotuvchi
// o'zi yaratadigan "xodim boti") ochiladi va mustaqil autentifikatsiya
// yo'liga ega (qarang: `StaffSessionContext.jsx`) — shuning uchun xuddi
// kuryernikiga o'xshash, alohida, lazy-import qilinadigan daraxt.
const StaffApp = lazy(() => import("./StaffApp"));

// "Do'konlarni kashf eting" — ilovaning YAGONA haqiqiy jamoat
// (Telegram autentifikatsiyasiz) sahifasi, `/courier`ga o'xshash
// mustaqil daraxt sifatida qurilgan: hech qanday Redux `store`/
// `SessionProvider` kerak emas, chunki bu yerda savat/sotuvchi
// paneli mantig'i UMUMAN yo'q - faqat `sellers` kolleksiyasining
// allaqachon ochiq (`firestore.rules`) qismini o'qiydigan, oddiy
// statik sahifa (batafsil izoh: `features/discover/DiscoverPage.jsx`).
const DiscoverPage = lazy(() => import("../features/discover/DiscoverPage"));

const isCourierPath = typeof window !== "undefined" && window.location.pathname.startsWith("/courier");
const isStaffPath = typeof window !== "undefined" && window.location.pathname.startsWith("/staff");
const isDiscoverPath = typeof window !== "undefined" && window.location.pathname.startsWith("/discover");

const App = () => {
  if (isCourierPath) {
    return (
      <ThemeProvider>
        <LanguageProvider>
          <Suspense fallback={<FullScreenSpinner />}>
            <CourierApp />
          </Suspense>
        </LanguageProvider>
      </ThemeProvider>
    );
  }

  if (isStaffPath) {
    return (
      <ThemeProvider>
        <LanguageProvider>
          <Suspense fallback={<FullScreenSpinner />}>
            <StaffApp />
          </Suspense>
        </LanguageProvider>
      </ThemeProvider>
    );
  }

  if (isDiscoverPath) {
    return (
      <ThemeProvider>
        <LanguageProvider>
          <Suspense fallback={<FullScreenSpinner />}>
            <DiscoverPage />
          </Suspense>
        </LanguageProvider>
      </ThemeProvider>
    );
  }

  return (
    <Provider store={store}>
      <ThemeProvider>
        <LanguageProvider>
          <SessionProvider>
            <SessionGate>
              <div className="w-full bg-gray-100 dark:bg-slate-950 transition-colors duration-300">
                <Suspense fallback={<FullScreenSpinner />}>
                  <AppRoutes/>
                </Suspense>
              </div>
            </SessionGate>
          </SessionProvider>
        </LanguageProvider>
      </ThemeProvider>
    </Provider>
  )
}

export default App