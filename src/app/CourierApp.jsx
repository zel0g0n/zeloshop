import { Suspense } from "react";
import { CourierSessionProvider } from "@/context/CourierSessionContext";
import CourierGate from "@/context/CourierGate";
import { CourierRoutes } from "@/routes/courier.route";
import FullScreenSpinner from "@/components/ui/FullScreenSpinner";

/**
 * KURYER DARAXTI — ALOHIDA FAYLGA CHIQARILDI (v39 tuzatish) va
 * `App.jsx`da LAZY import qilinadi.
 *
 * NEGA: `App.jsx` — ILOVANING ILDIZ komponenti, `main.jsx` uni
 * to'g'ridan-to'g'ri (LAZY EMAS) import qiladi. Agar
 * `CourierSessionProvider`/`CourierGate`/`CourierRoutes` (va ular
 * orqali `CourierOrdersPage`/`CourierOrderCard`) `App.jsx`ning O'ZIDA,
 * oddiy (statik) import sifatida turgan bo'lsa, ular BARCHA
 * foydalanuvchilar (sotuvchi, mijoz — kuryer EMAS, ya'ni 99%+) uchun
 * BOSH sahifa yuklanishi bilan BIRGA yuklab olinardi — bu esa aynan
 * loyihaning o'zida (`seller.route.jsx`dagi izohga qarang) qattiq
 * tanqid qilingan, LCP'ni yomonlashtiradigan xato bo'lardi. Endi bu
 * BUTUN DARAXT faqat `/courier` yo'liga kirilganda, ALOHIDA tarmoq
 * so'rovi orqali yuklanadi.
 */
const CourierApp = () => (
  <CourierSessionProvider>
    <CourierGate>
      <div className="w-full bg-gray-100 dark:bg-slate-950 transition-colors duration-300">
        <Suspense fallback={<FullScreenSpinner />}>
          <CourierRoutes />
        </Suspense>
      </div>
    </CourierGate>
  </CourierSessionProvider>
);

export default CourierApp;
