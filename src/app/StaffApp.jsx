import { Suspense } from "react";
import { StaffSessionProvider } from "@/context/StaffSessionContext";
import StaffGate from "@/context/StaffGate";
import { StaffRoutes } from "@/routes/staff.route";
import FullScreenSpinner from "@/components/ui/FullScreenSpinner";

/**
 * XODIM DARAXTI — `CourierApp.jsx` bilan AYNAN BIR XIL sabab bilan
 * alohida faylga chiqarilgan va `App.jsx`da LAZY import qilinadi: agar
 * `StaffSessionProvider`/`StaffGate`/`StaffRoutes` `App.jsx`ning O'ZIDA
 * oddiy (statik) import sifatida tursa, ular BARCHA foydalanuvchilar
 * (sotuvchi, mijoz, kuryer — xodim EMAS, ya'ni ko'pchilik) uchun BOSH
 * sahifa yuklanishi bilan BIRGA yuklab olinardi. Endi bu BUTUN DARAXT
 * faqat `/staff` yo'liga kirilganda, ALOHIDA tarmoq so'rovi orqali
 * yuklanadi.
 */
const StaffApp = () => (
  <StaffSessionProvider>
    <StaffGate>
      <div className="w-full bg-gray-100 dark:bg-slate-950 transition-colors duration-300">
        <Suspense fallback={<FullScreenSpinner />}>
          <StaffRoutes />
        </Suspense>
      </div>
    </StaffGate>
  </StaffSessionProvider>
);

export default StaffApp;
